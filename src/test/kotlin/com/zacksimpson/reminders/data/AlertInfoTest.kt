package com.zacksimpson.reminders.data

import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

class AlertInfoTest {
    private val zone = ZoneId.of("UTC")

    private fun at(date: String, time: String) =
        LocalDate.parse(date).atTime(LocalTime.parse(time)).atZone(zone).toInstant().toEpochMilli()

    private fun task(id: String, done: Boolean = false, deleted: Boolean = false) = Task(
        id = id, title = "Do the dishes", listId = "life", date = "2026-11-13", time = "14:30",
        completed = done, createdAt = 0L, order = 0, deleted = deleted,
    )

    private val lists = listOf(ReminderList(id = "life", title = "My Life", createdAt = 0L, order = 0))

    private fun info(id: String, tasks: List<Task>, snoozes: Map<String, Snooze> = emptyMap()) =
        alertInfoFor(id, tasks, lists, snoozes, zone)

    @Test
    fun taskAlertShowsTheTaskAndItsOriginalDueTime() {
        val got = info("task-a", listOf(task("a"))) as AlertInfo.Reminder
        assertEquals("Do the dishes", got.title)
        assertEquals("My Life", got.listTitle)
        assertEquals("Due Nov 13, 2:30 PM", got.due)
        assertEquals(at("2026-11-13", "14:30"), got.dueAtMillis)
        assertEquals(false, got.snoozed)
    }

    @Test
    fun aSnoozeKeepsTheOriginalDueTextAndMarksItSnoozed() {
        val snooze = Snooze(at("2026-11-13", "14:30"), at("2026-11-13", "18:00"))
        val got = info("task-a", listOf(task("a")), mapOf("a" to snooze)) as AlertInfo.Reminder
        assertEquals("Due Nov 13, 2:30 PM", got.due)
        assertEquals(true, got.snoozed)
    }

    @Test
    fun finishedMissingOrUnknownAlertsHaveNothingToShow() {
        assertNull(info("task-a", listOf(task("a", done = true))))
        assertNull(info("task-a", listOf(task("a", deleted = true))))
        assertNull(info("task-zzz", listOf(task("a"))))
        assertNull(info("group-123", listOf(task("a"))))
    }

    private fun dated(id: String, date: LocalDate, time: String? = null, done: Boolean = false) = Task(
        id = id, title = id, listId = "life", date = date.toString(), time = time,
        completed = done, createdAt = 0L, order = 0,
    )

    @Test
    fun summaryShowsWhenSomethingIsDueToday() {
        val tasks = listOf(dated("a", LocalDate.now()))
        assertEquals(AlertInfo.Summary, info(AlertPlanner.SUMMARY_ID, tasks))
    }

    @Test
    fun summaryHasNothingToShowWhenTodayIsDone() {
        val tasks = listOf(dated("a", LocalDate.now(), done = true), dated("b", LocalDate.now().plusDays(1)))
        assertNull(info(AlertPlanner.SUMMARY_ID, tasks))
        assertNull(info(AlertPlanner.SUMMARY_ID, emptyList()))
    }

    @Test
    fun summaryCountsOverdueOnlyWhenTheTodayViewShowsIt() {
        val tasks = listOf(dated("old", LocalDate.now().minusDays(2)))
        assertEquals(AlertInfo.Summary, alertInfoFor(AlertPlanner.SUMMARY_ID, tasks, lists, emptyMap(), zone, showOverdue = true))
        assertNull(alertInfoFor(AlertPlanner.SUMMARY_ID, tasks, lists, emptyMap(), zone, showOverdue = false))
    }

    @Test
    fun aMissingListLeavesTheListOut() {
        val got = alertInfoFor("task-a", listOf(task("a")), emptyList(), emptyMap(), zone) as AlertInfo.Reminder
        assertNull(got.listTitle)
    }

    @Test
    fun alertTimeShowsOnlyTheTimeForToday() {
        val now = at("2026-11-13", "10:30")
        assertEquals("3:00 PM", formatAlertAt(at("2026-11-13", "15:00"), now, zone))
        assertEquals("Nov 14, 9:00 AM", formatAlertAt(at("2026-11-14", "09:00"), now, zone))
        assertTrue(formatAlertAt(at("2026-11-14", "10:30"), now, zone).startsWith("Nov 14"))
    }

    @Test
    fun alertTimeFollowsTheTimeFormat() {
        val now = at("2026-11-13", "10:30")
        assertEquals("15:00", formatAlertAt(at("2026-11-13", "15:00"), now, zone, use24Hour = true))
        assertEquals("Nov 14, 09:00", formatAlertAt(at("2026-11-14", "09:00"), now, zone, use24Hour = true))
    }
}
