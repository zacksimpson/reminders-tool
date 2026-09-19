package com.zacksimpson.reminders.data

import kotlinx.serialization.builtins.ListSerializer
import java.time.LocalDate
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull
import kotlin.test.assertTrue

/** Unit tests for the pure data-layer logic and serialization: ordering, recurrence,
 *  and JSON round-trip. */
class RemindersLogicTest {

    private fun task(id: String, listId: String, order: Int) =
        Task(id = id, title = id, listId = listId, createdAt = 0L, order = order)

    // ── moveSubtask ────────────────────────────────────────────────────────────

    private fun subs(vararg ids: String) = ids.map { Subtask(id = it, title = it, createdAt = 0L) }

    @Test
    fun moveSubtaskDownSwapsWithNext() {
        val moved = RemindersLogic.moveSubtask(subs("a", "b", "c"), "a", 1)
        assertEquals(listOf("b", "a", "c"), moved.map { it.id })
    }

    @Test
    fun moveSubtaskUpSwapsWithPrevious() {
        val moved = RemindersLogic.moveSubtask(subs("a", "b", "c"), "c", -1)
        assertEquals(listOf("a", "c", "b"), moved.map { it.id })
    }

    @Test
    fun moveSubtaskPastEitherEndIsNoOp() {
        val list = subs("a", "b", "c")
        assertEquals(list, RemindersLogic.moveSubtask(list, "a", -1))
        assertEquals(list, RemindersLogic.moveSubtask(list, "c", 1))
    }

    @Test
    fun moveSubtaskUnknownIdIsNoOp() {
        val list = subs("a", "b")
        assertEquals(list, RemindersLogic.moveSubtask(list, "zzz", 1))
    }

    // ── applyOrder (LIST_TASK_ORDER_MIGRATION.md fallback rule) ────────────────

    @Test
    fun `applyOrder falls back to fallback sort when orderIds is null or empty`() {
        val items = listOf(task("a", "inbox", 2), task("b", "inbox", 0), task("c", "inbox", 1))
        val expected = listOf("b", "c", "a")
        assertEquals(expected, RemindersLogic.applyOrder(items, Task::id, null) { it.order }.map { it.id })
        assertEquals(expected, RemindersLogic.applyOrder(items, Task::id, emptyList()) { it.order }.map { it.id })
    }

    @Test
    fun `applyOrder sorts known ids by their position in orderIds`() {
        val items = listOf(task("a", "inbox", 0), task("b", "inbox", 1), task("c", "inbox", 2))
        val result = RemindersLogic.applyOrder(items, Task::id, listOf("c", "a", "b")) { it.order }
        assertEquals(listOf("c", "a", "b"), result.map { it.id })
    }

    @Test
    fun `applyOrder appends ids missing from orderIds after known ones, sorted by fallback`() {
        val items = listOf(task("a", "inbox", 5), task("b", "inbox", 0), task("c", "inbox", 1))
        // orderIds only knows about "a"; "b" and "c" are new and fall back to `order`.
        val result = RemindersLogic.applyOrder(items, Task::id, listOf("a")) { it.order }
        assertEquals(listOf("a", "b", "c"), result.map { it.id })
    }

    @Test
    fun `applyOrder ignores stale ids in orderIds that no longer match an item`() {
        val items = listOf(task("a", "inbox", 0), task("b", "inbox", 1))
        val result = RemindersLogic.applyOrder(items, Task::id, listOf("gone", "b", "a")) { it.order }
        assertEquals(listOf("b", "a"), result.map { it.id })
    }

    // ── Ordering ──────────────────────────────────────────────────────────────

    @Test
    fun `bottom order on empty list is 0`() {
        assertEquals(0, RemindersLogic.computeOrder(emptyList(), "inbox", AddPosition.BOTTOM))
    }

    @Test
    fun `top order on empty list is -1`() {
        assertEquals(-1, RemindersLogic.computeOrder(emptyList(), "inbox", AddPosition.TOP))
    }

    @Test
    fun `bottom order is max existing plus one`() {
        val tasks = listOf(task("a", "inbox", 0), task("b", "inbox", 5), task("c", "other", 9))
        assertEquals(6, RemindersLogic.computeOrder(tasks, "inbox", AddPosition.BOTTOM))
    }

    @Test
    fun `top order is min of zero and existing minus one`() {
        // existing orders in list are [2,3]; min(0,2,3) = 0; result -1 (matches RN reducer seed of 0)
        val tasks = listOf(task("a", "inbox", 2), task("b", "inbox", 3))
        assertEquals(-1, RemindersLogic.computeOrder(tasks, "inbox", AddPosition.TOP))
        // with a negative existing order, min wins
        val tasks2 = listOf(task("a", "inbox", -4), task("b", "inbox", 3))
        assertEquals(-5, RemindersLogic.computeOrder(tasks2, "inbox", AddPosition.TOP))
    }

    @Test
    fun `order ignores other lists`() {
        val tasks = listOf(task("a", "inbox", 0), task("b", "work", 99))
        assertEquals(1, RemindersLogic.computeOrder(tasks, "inbox", AddPosition.BOTTOM))
    }

    // ── Recurrence advancement ─────────────────────────────────────────────────

    private val everyDay = Recurrence(1, RecurrenceUnit.DAY)
    private val every3Weeks = Recurrence(3, RecurrenceUnit.WEEK)

    @Test
    fun `next occurrence advances at least one interval even if in the future`() {
        // start is well in the future relative to today; do-while still advances once
        val today = LocalDate.of(2026, 1, 1)
        val next = RemindersLogic.nextOccurrenceDate("2026-06-10", everyDay, today)
        assertEquals("2026-06-11", next)
    }

    @Test
    fun `next occurrence skips forward past today when overdue`() {
        val today = LocalDate.of(2026, 7, 2)
        // daily task last dated Jan 1 → first occurrence >= today
        val next = RemindersLogic.nextOccurrenceDate("2026-01-01", everyDay, today)
        assertEquals("2026-07-02", next)
        assertTrue(!LocalDate.parse(next).isBefore(today))
    }

    @Test
    fun `weekly recurrence lands on correct multiple`() {
        val today = LocalDate.of(2026, 1, 1)
        val next = RemindersLogic.nextOccurrenceDate("2026-01-01", every3Weeks, today)
        assertEquals("2026-01-22", next) // +21 days
    }

    @Test
    fun `monthly recurrence clamps end of month`() {
        val d = RemindersLogic.addInterval(LocalDate.of(2026, 1, 31), Recurrence(1, RecurrenceUnit.MONTH))
        assertEquals(LocalDate.of(2026, 2, 28), d)
    }

    @Test
    fun `spawn returns null for non-recurring or dateless task`() {
        val plain = task("a", "inbox", 0)
        assertNull(RemindersLogic.spawnNextOccurrence(plain, LocalDate.now(), { "x" }, { 0L }))
        val recurringNoDate = plain.copy(recurrence = everyDay)
        assertNull(RemindersLogic.spawnNextOccurrence(recurringNoDate, LocalDate.now(), { "x" }, { 0L }))
    }

    @Test
    fun `spawn carries over fields, resets subtasks, uses fresh id`() {
        val original = Task(
            id = "orig",
            title = "Water plants",
            listId = "home",
            date = "2026-01-01",
            time = "09:00",
            recurrence = everyDay,
            subtasks = listOf(Subtask("s1", "kitchen", completed = true, createdAt = 1L)),
            completed = true,
            completedAt = 123L,
            createdAt = 1L,
            order = 4,
        )
        val next = RemindersLogic.spawnNextOccurrence(original, LocalDate.of(2026, 1, 1), { "new-id" }, { 999L })!!
        assertEquals("new-id", next.id)
        assertEquals("Water plants", next.title)
        assertEquals("home", next.listId)
        assertEquals("09:00", next.time)
        assertEquals(everyDay, next.recurrence)
        assertEquals(4, next.order)          // inherits original order
        assertEquals(false, next.completed)
        assertNull(next.completedAt)
        assertEquals("2026-01-02", next.date)
        assertEquals(listOf(Subtask("s1", "kitchen", completed = false, createdAt = 1L)), next.subtasks)
    }

    // ── Recurrence picker stepper ────────────────────────────────────────────────

    @Test
    fun `interval decrements normally and wraps from 1 to 30`() {
        assertEquals(4, RemindersLogic.decrementInterval(5))
        assertEquals(30, RemindersLogic.decrementInterval(1))
    }

    @Test
    fun `interval increments normally and wraps from 30 to 1`() {
        assertEquals(6, RemindersLogic.incrementInterval(5))
        assertEquals(1, RemindersLogic.incrementInterval(30))
    }

    @Test
    fun `interval never leaves the 1 to 30 range across a full wrap cycle`() {
        var interval = 1
        repeat(60) {
            interval = RemindersLogic.incrementInterval(interval)
            assertTrue(interval in 1..30)
        }
    }

    @Test
    fun `recurrence unit cycles day to week to month to year to day`() {
        assertEquals(RecurrenceUnit.WEEK, RemindersLogic.nextRecurrenceUnit(RecurrenceUnit.DAY))
        assertEquals(RecurrenceUnit.MONTH, RemindersLogic.nextRecurrenceUnit(RecurrenceUnit.WEEK))
        assertEquals(RecurrenceUnit.YEAR, RemindersLogic.nextRecurrenceUnit(RecurrenceUnit.MONTH))
        assertEquals(RecurrenceUnit.DAY, RemindersLogic.nextRecurrenceUnit(RecurrenceUnit.YEAR))
    }

    // ── Serialization contract ──────────────────────────────────────────────────

    @Test
    fun `task round-trips through json with enum serial names`() {
        val t = Task(
            id = "1", title = "Test", listId = "inbox",
            date = "2026-07-02", time = "14:30",
            recurrence = Recurrence(2, RecurrenceUnit.MONTH),
            subtasks = listOf(Subtask("s", "sub", true, 5L)),
            completed = true, completedAt = 10L, createdAt = 1L, order = 3,
        )
        val encoded = appJson.encodeToString(Task.serializer(), t)
        assertTrue(encoded.contains("\"month\""), "enum should serialize to its @SerialName")
        assertEquals(t, appJson.decodeFromString(Task.serializer(), encoded))
    }

    @Test
    fun `settings decode fills missing fields with defaults`() {
        // only one field present — others must fall back to defaults (RN merge behavior)
        val partial = """{"showOverdue": false}"""
        val settings = appJson.decodeFromString(Settings.serializer(), partial)
        assertEquals(false, settings.showOverdue)
        assertEquals("inbox", settings.defaultListId)
        assertEquals(AfterAddBehavior.TOAST, settings.afterAddBehavior)
        assertEquals(AddPosition.BOTTOM, settings.addPosition)
    }

    @Test
    fun `unknown keys are ignored, not fatal`() {
        val withExtra = """{"defaultListId":"x","futureField":42}"""
        val settings = appJson.decodeFromString(Settings.serializer(), withExtra)
        assertEquals("x", settings.defaultListId)
    }

    @Test
    fun `truly malformed json throws (so callers can preserve, not overwrite)`() {
        assertFailsWith<Exception> {
            appJson.decodeFromString(ListSerializer(Task.serializer()), "{ not valid json ]")
        }
    }
}
