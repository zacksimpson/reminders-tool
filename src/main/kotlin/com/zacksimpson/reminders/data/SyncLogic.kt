package com.zacksimpson.reminders.data

/** [merged] is the union of both sides (newer [SyncableDocument.updatedAt] wins per
 *  id); [toPush] is the subset that needs writing to Firestore. */
data class CollectionMergeResult<T>(val merged: List<T>, val toPush: List<T>)

/** result of reconciling the singleton Settings document. */
data class SettingsMergeResult(val merged: Settings, val needsPush: Boolean)

/** [keep] is everything that isn't a stale tombstone; [purge] is old, soft-deleted rows
 *  ready to be removed for good, both locally and from Firestore. */
data class TombstonePurgeResult<T>(val keep: List<T>, val purge: List<T>)

/**
 * pure last-write-wins merge for phone<->desktop sync (SYNC_PLAN.md §3 step 4).
 * whole-document, not per-field: a delete just sets `deleted = true` and bumps
 * `updatedAt` like any other mutation, so comparing `updatedAt` per id is enough.
 * [SyncEngine] is the impure layer that fetches real data and applies the result.
 */
object SyncLogic {
    fun <T : SyncableDocument> mergeCollection(local: List<T>, remote: List<T>): CollectionMergeResult<T> {
        val localById = local.associateBy { it.id }
        val remoteById = remote.associateBy { it.id }

        val merged = mutableListOf<T>()
        val toPush = mutableListOf<T>()

        for (docId in localById.keys + remoteById.keys) {
            val l = localById[docId]
            val r = remoteById[docId]
            when {
                r == null -> requireNotNull(l).let { merged += it; toPush += it }
                l == null -> merged += r
                l.updatedAt > r.updatedAt -> { merged += l; toPush += l }
                r.updatedAt > l.updatedAt -> merged += r
                else -> merged += l // equal timestamps: already in sync, keep either, push neither.
            }
        }
        return CollectionMergeResult(merged, toPush)
    }

    /** merge for a pull of only remote changes, pushes local edits made after [pushSince]. */
    fun <T : SyncableDocument> mergeDelta(
        local: List<T>,
        remoteChanged: List<T>,
        pushSince: Long,
    ): CollectionMergeResult<T> {
        val remoteById = remoteChanged.associateBy { it.id }
        val localIds = local.map { it.id }.toSet()

        val merged = mutableListOf<T>()
        val toPush = mutableListOf<T>()

        for (l in local) {
            val r = remoteById[l.id]
            when {
                r == null -> {
                    merged += l
                    if (l.updatedAt > pushSince) toPush += l
                }
                r.updatedAt > l.updatedAt -> merged += r
                l.updatedAt > r.updatedAt -> { merged += l; toPush += l }
                else -> merged += l
            }
        }
        merged += remoteChanged.filter { it.id !in localIds }
        return CollectionMergeResult(merged, toPush)
    }

    /**
     * splits tombstones old enough to purge for good from everything else. only call
     * this after a full merge, where [docs] reflects every document on both sides:
     * a delta pass only knows about *changed* remote rows, so a tombstone it never
     * saw again would look purgeable when it's really just untouched since last time.
     */
    fun <T> partitionStaleTombstones(
        docs: List<T>,
        now: Long,
        purgeAfterMs: Long,
    ): TombstonePurgeResult<T> where T : SyncableDocument, T : SoftDeletable {
        val (purge, keep) = docs.partition { it.deleted && now - it.updatedAt >= purgeAfterMs }
        return TombstonePurgeResult(keep, purge)
    }

    /** [remote] is null when the user has never synced settings before, local always
     *  wins that case (and needs pushing) since there's nothing to compare against. */
    fun mergeSettings(local: Settings, remote: Settings?): SettingsMergeResult = when {
        remote == null -> SettingsMergeResult(local, needsPush = true)
        local.updatedAt > remote.updatedAt -> SettingsMergeResult(local, needsPush = true)
        remote.updatedAt > local.updatedAt -> SettingsMergeResult(remote, needsPush = false)
        else -> SettingsMergeResult(local, needsPush = false)
    }
}
