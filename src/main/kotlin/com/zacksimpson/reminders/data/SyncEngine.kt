package com.zacksimpson.reminders.data

import kotlinx.coroutines.flow.first
import kotlinx.serialization.KSerializer
import kotlinx.serialization.json.jsonObject

class SyncException(message: String) : Exception(message)

/**
 * one sync pass: pull remote, merge with local via [SyncLogic], push what local won.
 * most passes only pull changes, with a full pull every [FULL_SYNC_INTERVAL_MS] to
 * catch documents an offline device stamped with an old updatedAt. a full pass also
 * purges tombstones older than [TOMBSTONE_PURGE_AFTER_MS] for good, locally and on
 * Firestore, so deleted rows don't pile up forever.
 */
class SyncEngine(
    private val remindersRepo: RemindersRepository,
    private val authRepo: AuthRepository,
    private val firestore: FirestoreClient,
) {
    suspend fun sync() {
        val uid = (authRepo.state.first() as? AuthState.SignedIn)?.uid
            ?: throw SyncException("Not signed in")

        val startedAt = System.currentTimeMillis()
        val cursor = authRepo.syncCursor()
        val previousStart = cursor.startedAt
        val lastFullAt = cursor.lastFullAt
        val clockWentBack = previousStart != null && previousStart > startedAt
        val full = previousStart == null || lastFullAt == null || clockWentBack ||
            startedAt - lastFullAt >= FULL_SYNC_INTERVAL_MS

        val local = remindersRepo.snapshotForSync()
        val remoteSettings = firestore.getDocument(uid, "settings", "singleton")
            ?.let { firestoreModelJson.decodeFromJsonElement(Settings.serializer(), it.fields) }

        val listsResult: CollectionMergeResult<ReminderList>
        val tasksResult: CollectionMergeResult<Task>
        if (full || previousStart == null) {
            listsResult = SyncLogic.mergeCollection(
                local.lists,
                fetchAll(uid, "lists", ReminderList.serializer()),
            )
            tasksResult = SyncLogic.mergeCollection(
                local.tasks,
                fetchAll(uid, "tasks", Task.serializer()),
            )
        } else {
            val fetchFrom = previousStart - FETCH_OVERLAP_MS
            val pushFrom = previousStart - PUSH_OVERLAP_MS
            listsResult = SyncLogic.mergeDelta(
                local.lists,
                fetchChanged(uid, "lists", fetchFrom, ReminderList.serializer()),
                pushFrom,
            )
            tasksResult = SyncLogic.mergeDelta(
                local.tasks,
                fetchChanged(uid, "tasks", fetchFrom, Task.serializer()),
                pushFrom,
            )
        }
        val settingsResult = SyncLogic.mergeSettings(local.settings, remoteSettings)

        // purging is only safe right after a full merge, see partitionStaleTombstones
        val lists = withTombstonesPurged(listsResult, full, startedAt)
        val tasks = withTombstonesPurged(tasksResult, full, startedAt)

        remindersRepo.applySyncedState(lists.toPersist, tasks.toPersist, settingsResult.merged)

        lists.toPush.forEach { pushDocument(uid, "lists", it.id, ReminderList.serializer(), it) }
        tasks.toPush.forEach { pushDocument(uid, "tasks", it.id, Task.serializer(), it) }
        if (settingsResult.needsPush) {
            pushDocument(uid, "settings", "singleton", Settings.serializer(), settingsResult.merged)
        }
        lists.toPurge.forEach { firestore.deleteDocument(uid, "lists", it.id) }
        tasks.toPurge.forEach { firestore.deleteDocument(uid, "tasks", it.id) }

        authRepo.recordSyncSuccess(startedAt, full)
    }

    /** on a full pass, splits a merge result's tombstones old enough to purge out of
     *  what gets persisted and pushed; a delta pass never purges, see
     *  [SyncLogic.partitionStaleTombstones]. */
    private fun <T> withTombstonesPurged(
        result: CollectionMergeResult<T>,
        full: Boolean,
        now: Long,
    ): PurgeOutcome<T> where T : SyncableDocument, T : SoftDeletable {
        if (!full) return PurgeOutcome(result.merged, result.toPush, emptyList())
        val (keep, purge) = SyncLogic.partitionStaleTombstones(result.merged, now, TOMBSTONE_PURGE_AFTER_MS)
        val purgedIds = purge.map { it.id }.toSet()
        return PurgeOutcome(keep, result.toPush.filterNot { it.id in purgedIds }, purge)
    }

    private data class PurgeOutcome<T>(val toPersist: List<T>, val toPush: List<T>, val toPurge: List<T>)

    private suspend fun <T> fetchAll(uid: String, collection: String, serializer: KSerializer<T>): List<T> =
        firestore.listDocuments(uid, collection)
            .map { firestoreModelJson.decodeFromJsonElement(serializer, it.fields) }

    private suspend fun <T> fetchChanged(
        uid: String,
        collection: String,
        since: Long,
        serializer: KSerializer<T>,
    ): List<T> =
        firestore.listChangedSince(uid, collection, since)
            .map { firestoreModelJson.decodeFromJsonElement(serializer, it.fields) }

    private suspend fun <T> pushDocument(
        uid: String,
        collection: String,
        docId: String,
        serializer: KSerializer<T>,
        value: T,
    ) {
        val fields = firestoreModelJson.encodeToJsonElement(serializer, value).jsonObject
        firestore.setDocument(uid, collection, docId, fields)
    }

    private companion object {
        const val FULL_SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000L

        // other devices stamp updatedAt from their own clocks, so look back a little
        const val FETCH_OVERLAP_MS = 10 * 60 * 1000L
        const val PUSH_OVERLAP_MS = 60 * 1000L

        // a device offline longer than this that never saw a deletion could resurrect
        // it once its tombstone is gone, seven days is long enough that's unlikely
        const val TOMBSTONE_PURGE_AFTER_MS = 7 * 24 * 60 * 60 * 1000L
    }
}
