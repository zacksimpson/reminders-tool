package com.zacksimpson.reminders.data

import java.time.LocalDate
import java.time.LocalDateTime
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/** Covers isOverdue and the Today-tab sort comparators — both drive what bucket a task
 *  lands in (overdue/active/completed) and how it's ordered, so worth locking down. */
class DateTimeFormatTest {

    private fun task(
        id: String = "t",
        date: String? = null,
        time: String? = null,
        order: Int = 0,
        completed: Boolean = false,
    ) = Task(id = id, title = id, listId = "inbox", date = date, time = time, order = order, completed = completed, createdAt = 0L)

    // ── isOverdue ────────────────────────────────────────────────────────────────

    @Test
    fun `no date is never overdue`() {
        assertFalse(isOverdue(null, null))
        assertFalse(isOverdue(null, "09:00"))
    }

    @Test
    fun `date-only task is overdue once its day has passed`() {
        val yesterday = LocalDate.now().minusDays(1).toString()
        val tomorrow = LocalDate.now().plusDays(1).toString()
        assertTrue(isOverdue(yesterday, null))
        assertFalse(isOverdue(tomorrow, null))
        assertFalse(isOverdue(LocalDate.now().toString(), null), "today (date-only) is not overdue until the day passes")
    }

    @Test
    fun `dated-and-timed task is overdue once that exact moment has passed`() {
        val past = LocalDateTime.now().minusMinutes(5)
        val future = LocalDateTime.now().plusMinutes(5)
        assertTrue(isOverdue(past.toLocalDate().toString(), "%02d:%02d".format(past.hour, past.minute)))
        assertFalse(isOverdue(future.toLocalDate().toString(), "%02d:%02d".format(future.hour, future.minute)))
    }

    // ── compareTasksByDateTime ───────────────────────────────────────────────────

    @Test
    fun `neither timed falls back to manual order`() {
        val a = task(order = 5)
        val b = task(order = 2)
        assertTrue(compareTasksByDateTime(a, b) > 0) // a (order 5) sorts after b (order 2)
    }

    @Test
    fun `both timed compares the time strings`() {
        val early = task(time = "08:00")
        val late = task(time = "17:30")
        assertTrue(compareTasksByDateTime(early, late) < 0)
        assertTrue(compareTasksByDateTime(late, early) > 0)
    }

    @Test
    fun `mixed timed and untimed - untimed sorts first`() {
        // Ported literally from RN's code (not its doc comment, which claims the
        // opposite) — see comment on compareTasksByDateTime.
        val untimed = task(id = "untimed")
        val timed = task(id = "timed", time = "09:00")
        assertTrue(compareTasksByDateTime(untimed, timed) < 0)
        assertTrue(compareTasksByDateTime(timed, untimed) > 0)
    }

    // ── compareTasksByDateThenTime ───────────────────────────────────────────────

    @Test
    fun `different dates sort chronologically before time is considered`() {
        val earlier = task(date = "2026-01-01", time = "23:00")
        val later = task(date = "2026-01-02", time = "01:00")
        assertTrue(compareTasksByDateThenTime(earlier, later) < 0)
    }

    @Test
    fun `same date falls through to time comparison`() {
        val a = task(date = "2026-01-01", time = "08:00")
        val b = task(date = "2026-01-01", time = "17:00")
        assertTrue(compareTasksByDateThenTime(a, b) < 0)
    }

    @Test
    fun `null dates sort before any real date`() {
        val noDate = task(date = null)
        val dated = task(date = "2026-01-01")
        assertTrue(compareTasksByDateThenTime(noDate, dated) < 0)
    }

    @Test
    fun formatTimeFollowsTheTimeFormat() {
        assertEquals("3:30 PM", formatTime("15:30", use24Hour = false))
        assertEquals("12:05 AM", formatTime("00:05", use24Hour = false))
        assertEquals("15:30", formatTime("15:30", use24Hour = true))
        assertEquals("00:05", formatTime("00:05", use24Hour = true))
    }
}
