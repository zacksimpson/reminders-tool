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
import { mergeCollection, mergeSettings } from "./syncLogic";

export class SyncException extends Error {}

export interface SyncDeps {
  applySyncedState: (
    lists: ReminderList[],
    tasks: Task[],
    settings: Settings
  ) => Promise<void>;
  firestore: FirestoreClient;
  snapshotForSync: () => SyncSnapshot;
  uid: string;
}

async function fetchCollection<T>(
  firestore: FirestoreClient,
  uid: string,
  collection: string,
  normalize: (raw: T) => T
): Promise<T[]> {
  const docs = await firestore.listDocuments(uid, collection);
  return docs.map((doc) => normalize(doc.fields as unknown as T));
}

/**
 * Orchestrates one full sync pass: pull remote, reconcile with local via
 * syncLogic's pure merge, push whatever local won, persist the result back to
 * RemindersContext. Mirrors the native rewrite's SyncEngine.
 */
export async function runSync(deps: SyncDeps): Promise<void> {
  const { firestore, uid, snapshotForSync, applySyncedState } = deps;
  const local = snapshotForSync();

  const remoteLists = await fetchCollection<ReminderList>(
    firestore,
    uid,
    "lists",
    normalizeList
  );
  const remoteTasks = await fetchCollection<Task>(
    firestore,
    uid,
    "tasks",
    normalizeTask
  );
  const remoteSettingsDoc = await firestore.getDocument(
    uid,
    "settings",
    "singleton"
  );
  const remoteSettings = remoteSettingsDoc
    ? normalizeSettings(remoteSettingsDoc.fields as unknown as Settings)
    : null;

  const listsResult = mergeCollection(local.lists, remoteLists);
  const tasksResult = mergeCollection(local.tasks, remoteTasks);
  const settingsResult = mergeSettings(local.settings, remoteSettings);

  await applySyncedState(
    listsResult.merged,
    tasksResult.merged,
    settingsResult.merged
  );

  await Promise.all(
    listsResult.toPush.map((list) =>
      firestore.setDocument(
        uid,
        "lists",
        list.id,
        list as unknown as Record<string, JsonValue>
      )
    )
  );
  await Promise.all(
    tasksResult.toPush.map((task) =>
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
}
