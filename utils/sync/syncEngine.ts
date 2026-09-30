import {
  normalizeList,
  normalizeSettings,
  normalizeTask,
  type ReminderList,
  type Settings,
  type SyncSnapshot,
  type Task,
} from "@/contexts/RemindersContext";
import type { FirestoreClient } from "./firestoreClient";
import type { JsonValue } from "./firestoreValue";
import {
  type CollectionMergeResult,
  mergeCollection,
  mergeDelta,
  mergeSettings,
  partitionStaleTombstones,
} from "./syncLogic";

export class SyncException extends Error {}

/** Other devices stamp updatedAt from their own clocks, so look back a little. */
const FETCH_OVERLAP_MS = 10 * 60 * 1000;
const PUSH_OVERLAP_MS = 60 * 1000;

/** A device offline longer than this that never saw a deletion could resurrect it
 *  once its tombstone is gone. Seven days is long enough that's unlikely. */
const TOMBSTONE_PURGE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

export const FULL_SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000;

export interface SyncCursor {
  lastFullAt: number | null;
  startedAt: number | null;
}

export interface SyncDeps {
  applySyncedState: (
    lists: ReminderList[],
    tasks: Task[],
    settings: Settings
  ) => Promise<void>;
  cursor: SyncCursor;
  firestore: FirestoreClient;
  snapshotForSync: () => SyncSnapshot;
  uid: string;
}

/** What the caller needs to record a new cursor once the pass succeeds. */
export interface SyncResult {
  full: boolean;
  startedAt: number;
}

/** A malformed remote document (missing/invalid id or updatedAt, the two fields
 *  mergeCollection actually relies on) is skipped rather than merged in as-is. */
function isValidSyncDoc(raw: { id?: unknown; updatedAt?: unknown }): boolean {
  return (
    typeof raw.id === "string" &&
    raw.id.length > 0 &&
    typeof raw.updatedAt === "number" &&
    Number.isFinite(raw.updatedAt)
  );
}

async function fetchCollection<T extends { id?: unknown; updatedAt?: unknown }>(
  firestore: FirestoreClient,
  uid: string,
  collection: string,
  normalize: (raw: T) => T
): Promise<T[]> {
  const docs = await firestore.listDocuments(uid, collection);
  return docs
    .map((doc) => normalize(doc.fields as unknown as T))
    .filter(isValidSyncDoc);
}

async function fetchChanged<T extends { id?: unknown; updatedAt?: unknown }>(
  firestore: FirestoreClient,
  uid: string,
  collection: string,
  since: number,
  normalize: (raw: T) => T
): Promise<T[]> {
  const docs = await firestore.listChangedSince(uid, collection, since);
  return docs
    .map((doc) => normalize(doc.fields as unknown as T))
    .filter(isValidSyncDoc);
}

interface PurgeOutcome<T> {
  toPersist: T[];
  toPurge: T[];
  toPush: T[];
}

/** On a full pass, splits a merge result's tombstones old enough to purge out of
 *  what gets persisted and pushed. A delta pass never purges, since it only knows
 *  about changed remote rows (see partitionStaleTombstones). */
function withTombstonesPurged<
  T extends { deleted: boolean; id: string; updatedAt: number },
>(
  result: CollectionMergeResult<T>,
  full: boolean,
  now: number
): PurgeOutcome<T> {
  if (!full) {
    return { toPersist: result.merged, toPush: result.toPush, toPurge: [] };
  }
  const { keep, purge } = partitionStaleTombstones(
    result.merged,
    now,
    TOMBSTONE_PURGE_AFTER_MS
  );
  const purgedIds = new Set(purge.map((doc) => doc.id));
  return {
    toPersist: keep,
    toPush: result.toPush.filter((doc) => !purgedIds.has(doc.id)),
    toPurge: purge,
  };
}

/**
 * Orchestrates one sync pass: pull remote, reconcile with local via syncLogic's
 * pure merge, push whatever local won, persist the result back to
 * RemindersContext. Most passes only pull changes, with a full pull every
 * FULL_SYNC_INTERVAL_MS to catch documents an offline device stamped with an old
 * updatedAt. A full pass also purges tombstones older than
 * TOMBSTONE_PURGE_AFTER_MS for good, locally and on Firestore, so deleted rows
 * don't pile up forever. Mirrors the native rewrite's SyncEngine.
 */
export async function runSync(deps: SyncDeps): Promise<SyncResult> {
  const { firestore, uid, snapshotForSync, applySyncedState, cursor } = deps;

  const startedAt = Date.now();
  const { startedAt: previousStart, lastFullAt } = cursor;
  const clockWentBack = previousStart !== null && previousStart > startedAt;
  const full =
    previousStart === null ||
    lastFullAt === null ||
    clockWentBack ||
    startedAt - lastFullAt >= FULL_SYNC_INTERVAL_MS;

  const remoteSettingsDoc = await firestore.getDocument(
    uid,
    "settings",
    "singleton"
  );
  const remoteSettings = remoteSettingsDoc
    ? normalizeSettings(remoteSettingsDoc.fields as unknown as Settings)
    : null;

  // Snapshot local state as late as possible, right before merging, so anything the
  // user changed while the fetches above were in flight isn't clobbered by the merge.
  const local = snapshotForSync();

  let listsResult: CollectionMergeResult<ReminderList>;
  let tasksResult: CollectionMergeResult<Task>;
  if (full) {
    const [remoteLists, remoteTasks] = await Promise.all([
      fetchCollection<ReminderList>(firestore, uid, "lists", normalizeList),
      fetchCollection<Task>(firestore, uid, "tasks", normalizeTask),
    ]);
    listsResult = mergeCollection(local.lists, remoteLists);
    tasksResult = mergeCollection(local.tasks, remoteTasks);
  } else {
    // previousStart is non-null here, full would otherwise be true.
    const fetchFrom = (previousStart as number) - FETCH_OVERLAP_MS;
    const pushFrom = (previousStart as number) - PUSH_OVERLAP_MS;
    const [changedLists, changedTasks] = await Promise.all([
      fetchChanged<ReminderList>(
        firestore,
        uid,
        "lists",
        fetchFrom,
        normalizeList
      ),
      fetchChanged<Task>(firestore, uid, "tasks", fetchFrom, normalizeTask),
    ]);
    listsResult = mergeDelta(local.lists, changedLists, pushFrom);
    tasksResult = mergeDelta(local.tasks, changedTasks, pushFrom);
  }
  const settingsResult = mergeSettings(local.settings, remoteSettings);

  const lists = withTombstonesPurged(listsResult, full, startedAt);
  const tasks = withTombstonesPurged(tasksResult, full, startedAt);

  await applySyncedState(
    lists.toPersist,
    tasks.toPersist,
    settingsResult.merged
  );

  await Promise.all(
    lists.toPush.map((list) =>
      firestore.setDocument(
        uid,
        "lists",
        list.id,
        list as unknown as Record<string, JsonValue>
      )
    )
  );
  await Promise.all(
    tasks.toPush.map((task) =>
      firestore.setDocument(
        uid,
        "tasks",
        task.id,
        task as unknown as Record<string, JsonValue>
      )
    )
  );
  if (settingsResult.needsPush) {
    await firestore.setDocument(
      uid,
      "settings",
      "singleton",
      settingsResult.merged as unknown as Record<string, JsonValue>
    );
  }
  await Promise.all(
    lists.toPurge.map((list) => firestore.deleteDocument(uid, "lists", list.id))
  );
  await Promise.all(
    tasks.toPurge.map((task) => firestore.deleteDocument(uid, "tasks", task.id))
  );

  return { startedAt, full };
}
