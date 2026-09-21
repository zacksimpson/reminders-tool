package com.zacksimpson.reminders.data

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/** Unit tests for [SyncLogic]'s pure last-write-wins merge (SYNC_PLAN.md §3 step 4). */
class SyncLogicTest {

    private fun list(id: String, updatedAt: Long, deleted: Boolean = false, order: Int = 0) =
        ReminderList(id = id, title = id, createdAt = updatedAt, order = order, updatedAt = updatedAt, deleted = deleted)

    // ── mergeCollection ──────────────────────────────────────────────────────────

    @Test
    fun `document only on local side is kept and queued to push`() {
        val result = SyncLogic.mergeCollection(local = listOf(list("a", 1)), remote = emptyList())

        assertEquals(listOf("a"), result.merged.map { it.id })
        assertEquals(listOf("a"), result.toPush.map { it.id })
    }

    @Test
    fun `document only on remote side is adopted locally and not pushed`() {
        val result = SyncLogic.mergeCollection(local = emptyList(), remote = listOf(list("a", 1)))

        assertEquals(listOf("a"), result.merged.map { it.id })
        assertTrue(result.toPush.isEmpty())
    }

    @Test
    fun `newer local copy wins and is pushed`() {
        val result = SyncLogic.mergeCollection(
            local = listOf(list("a", updatedAt = 5, order = 9)),
            remote = listOf(list("a", updatedAt = 1, order = 0)),
        )

        assertEquals(9, result.merged.single().order)
        assertEquals(listOf("a"), result.toPush.map { it.id })
    }

    @Test
    fun `newer remote copy wins and is not pushed`() {
        val result = SyncLogic.mergeCollection(
            local = listOf(list("a", updatedAt = 1, order = 0)),
            remote = listOf(list("a", updatedAt = 5, order = 9)),
        )

        assertEquals(9, result.merged.single().order)
        assertTrue(result.toPush.isEmpty())
    }

    @Test
    fun `equal timestamps are treated as already in sync`() {
        val result = SyncLogic.mergeCollection(
            local = listOf(list("a", updatedAt = 5)),
            remote = listOf(list("a", updatedAt = 5)),
        )

        assertEquals(listOf("a"), result.merged.map { it.id })
        assertTrue(result.toPush.isEmpty())
    }

    @Test
    fun `a newer local delete is kept as a tombstone and pushed, not resurrected`() {
        // The exact scenario RemindersRepository's soft-delete methods exist for: the
        // remote copy still looks "alive," but the local tombstone is newer and must win.
        val result = SyncLogic.mergeCollection(
            local = listOf(list("a", updatedAt = 10, deleted = true)),
            remote = listOf(list("a", updatedAt = 1, deleted = false)),
        )

        assertTrue(result.merged.single().deleted)
        assertEquals(listOf("a"), result.toPush.map { it.id })
    }

    @Test
    fun `merges multiple independent documents by id`() {
        val result = SyncLogic.mergeCollection(
            local = listOf(list("a", 1), list("b", 5)),
            remote = listOf(list("b", 1), list("c", 1)),
        )

        assertEquals(setOf("a", "b", "c"), result.merged.map { it.id }.toSet())
        assertEquals(setOf("a", "b"), result.toPush.map { it.id }.toSet()) // a: local-only; b: local newer
    }

    // ── mergeSettings ────────────────────────────────────────────────────────────

    @Test
    fun `settings with no remote copy yet is pushed as-is`() {
        val local = Settings(updatedAt = 1)
        val result = SyncLogic.mergeSettings(local, remote = null)

        assertEquals(local, result.merged)
        assertTrue(result.needsPush)
    }

    @Test
    fun `newer local settings wins and needs push`() {
        val local = Settings(defaultListId = "work", updatedAt = 5)
        val remote = Settings(defaultListId = "inbox", updatedAt = 1)

        val result = SyncLogic.mergeSettings(local, remote)

        assertEquals("work", result.merged.defaultListId)
        assertTrue(result.needsPush)
    }

    @Test
    fun `newer remote settings wins and does not need push`() {
        val local = Settings(defaultListId = "work", updatedAt = 1)
        val remote = Settings(defaultListId = "inbox", updatedAt = 5)

        val result = SyncLogic.mergeSettings(local, remote)

        assertEquals("inbox", result.merged.defaultListId)
        assertTrue(!result.needsPush)
    }

    @Test
    fun `equal settings timestamps keep local without pushing`() {
        val local = Settings(defaultListId = "work", updatedAt = 5)
        val remote = Settings(defaultListId = "inbox", updatedAt = 5)

        val result = SyncLogic.mergeSettings(local, remote)

        assertEquals("work", result.merged.defaultListId)
        assertTrue(!result.needsPush)
    }

    // ── mergeDelta ───────────────────────────────────────────────────────────────

    @Test
    fun `delta merge keeps an untouched local document and pushes nothing`() {
        val result = SyncLogic.mergeDelta(
            local = listOf(list("a", updatedAt = 5)),
            remoteChanged = emptyList(),
            pushSince = 10,
        )

        assertEquals(listOf("a"), result.merged.map { it.id })
        assertTrue(result.toPush.isEmpty())
    }

    @Test
    fun `delta merge pushes a local document edited since the last sync`() {
        val result = SyncLogic.mergeDelta(
            local = listOf(list("a", updatedAt = 20), list("b", updatedAt = 5)),
            remoteChanged = emptyList(),
            pushSince = 10,
        )

        assertEquals(listOf("a"), result.toPush.map { it.id })
        assertEquals(listOf("a", "b"), result.merged.map { it.id })
    }

    @Test
    fun `delta merge adopts a remote document that is new locally`() {
        val result = SyncLogic.mergeDelta(
            local = emptyList(),
            remoteChanged = listOf(list("a", updatedAt = 5)),
            pushSince = 10,
        )

        assertEquals(listOf("a"), result.merged.map { it.id })
        assertTrue(result.toPush.isEmpty())
    }

    @Test
    fun `delta merge takes a newer remote copy without pushing`() {
        val result = SyncLogic.mergeDelta(
            local = listOf(list("a", updatedAt = 1, order = 0)),
            remoteChanged = listOf(list("a", updatedAt = 5, order = 9)),
            pushSince = 10,
        )

        assertEquals(9, result.merged.single().order)
        assertTrue(result.toPush.isEmpty())
    }

    @Test
    fun `delta merge pushes a local copy that beats the changed remote copy`() {
        val result = SyncLogic.mergeDelta(
            local = listOf(list("a", updatedAt = 8, order = 9)),
            remoteChanged = listOf(list("a", updatedAt = 3, order = 0)),
            pushSince = 10,
        )

        assertEquals(9, result.merged.single().order)
        assertEquals(listOf("a"), result.toPush.map { it.id })
    }

    @Test
    fun `delta merge treats equal timestamps as already in sync`() {
        val result = SyncLogic.mergeDelta(
            local = listOf(list("a", updatedAt = 5)),
            remoteChanged = listOf(list("a", updatedAt = 5)),
            pushSince = 10,
        )

        assertEquals(1, result.merged.size)
        assertTrue(result.toPush.isEmpty())
    }
}
