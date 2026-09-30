/** An id-keyed, soft-deletable row that can be reconciled by mergeCollection:
 *  `updatedAt` alone decides which side wins a merge. */
export interface SyncableDocument {
  id: string;
  updatedAt: number;
}

/** `merged` is the union of both sides (newer `updatedAt` wins per id); `toPush` is
 *  the subset that needs writing to Firestore. */
export interface CollectionMergeResult<T> {
  merged: T[];
  toPush: T[];
}

/** Result of reconciling the singleton Settings document. */
export interface SettingsMergeResult<S> {
  merged: S;
  needsPush: boolean;
}

/** `keep` is everything that isn't a stale tombstone; `purge` is old, soft-deleted
 *  rows ready to be removed for good, both locally and from Firestore. */
export interface TombstonePurgeResult<T> {
  keep: T[];
  purge: T[];
}

/**
 * Pure last-write-wins merge for phone<->desktop sync. Whole-document, not
 * per-field: a delete just sets `deleted = true` and bumps `updatedAt` like any other
 * mutation, so comparing `updatedAt` per id is enough.
 */
export function mergeCollection<T extends SyncableDocument>(
  local: T[],
  remote: T[]
): CollectionMergeResult<T> {
  const localById = new Map(local.map((item) => [item.id, item]));
  const remoteById = new Map(remote.map((item) => [item.id, item]));
  const ids = new Set([...localById.keys(), ...remoteById.keys()]);

  const merged: T[] = [];
  const toPush: T[] = [];

  for (const id of ids) {
    const l = localById.get(id);
    const r = remoteById.get(id);
    if (!r) {
      const doc = l as T;
      merged.push(doc);
      toPush.push(doc);
    } else if (!l) {
      merged.push(r);
    } else if (l.updatedAt > r.updatedAt) {
      merged.push(l);
      toPush.push(l);
    } else if (r.updatedAt > l.updatedAt) {
      merged.push(r);
    } else {
      merged.push(l); // Equal timestamps: already in sync, keep either, push neither.
    }
  }
  return { merged, toPush };
}

/** Merge for a pull of only remote changes, pushes local edits made after
 *  `pushSince`. */
export function mergeDelta<T extends SyncableDocument>(
  local: T[],
  remoteChanged: T[],
  pushSince: number
): CollectionMergeResult<T> {
  const remoteById = new Map(remoteChanged.map((item) => [item.id, item]));
  const localIds = new Set(local.map((item) => item.id));

  const merged: T[] = [];
  const toPush: T[] = [];

  for (const l of local) {
    const r = remoteById.get(l.id);
    if (!r) {
      merged.push(l);
      if (l.updatedAt > pushSince) {
        toPush.push(l);
      }
    } else if (r.updatedAt > l.updatedAt) {
      merged.push(r);
    } else if (l.updatedAt > r.updatedAt) {
      merged.push(l);
      toPush.push(l);
    } else {
      merged.push(l);
    }
  }
  merged.push(...remoteChanged.filter((r) => !localIds.has(r.id)));
  return { merged, toPush };
}

/**
 * Splits tombstones old enough to purge for good from everything else. Only call
 * this after a full merge, where `docs` reflects every document on both sides: a
 * delta pass only knows about *changed* remote rows, so a tombstone it never saw
 * again would look purgeable when it's really just untouched since last time.
 */
export function partitionStaleTombstones<
  T extends SyncableDocument & { deleted: boolean },
>(docs: T[], now: number, purgeAfterMs: number): TombstonePurgeResult<T> {
  const keep: T[] = [];
  const purge: T[] = [];
  for (const doc of docs) {
    if (doc.deleted && now - doc.updatedAt >= purgeAfterMs) {
      purge.push(doc);
    } else {
      keep.push(doc);
    }
  }
  return { keep, purge };
}

/** `remote` is null when the user has never synced settings before: local always
 *  wins that case (and needs pushing) since there's nothing to compare against. */
export function mergeSettings<S extends { updatedAt: number }>(
  local: S,
  remote: S | null
): SettingsMergeResult<S> {
  if (!remote) {
    return { merged: local, needsPush: true };
  }
  if (local.updatedAt > remote.updatedAt) {
    return { merged: local, needsPush: true };
  }
  if (remote.updatedAt > local.updatedAt) {
    return { merged: remote, needsPush: false };
  }
  return { merged: local, needsPush: false };
}
