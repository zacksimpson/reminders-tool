package com.zacksimpson.reminders.data

import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

class AlertPlannerTest {
    private val zone = ZoneId.of("UTC")
    private val on = NotificationSettings(enabled = true)

    private fun at(date: String, time: String) =
        LocalDate.parse(date).atTime(LocalTime.parse(time)).atZone(zone).toInstant().toEpochMilli()

    private fun task(
        id: String,
        date: String? = null,
        time: String? = null,
        done: Boolean = false,
        deleted: Boolean = false,
    ) = Task(id = id, title = id, listId = "inbox", date = date, time = time, completed = done, createdAt = 0L, order = 0, deleted = deleted)

    @Test
    fun plansOnlyFutureOpenTimedTasksInOrder() {
        val now = at("2026-11-05", "12:00")
        val tasks = listOf(
            task("later", "2026-11-05", "18:00"),
            task("past", "2026-11-05", "08:00"),
            task("soon", "2026-11-05", "13:00"),
            task("done", "2026-11-05", "14:00", done = true),
            task("gone", "2026-11-05", "14:00", deleted = true),
            task("untimed", "2026-11-05"),
            task("undated"),
        )
        assertEquals(listOf("task-soon", "task-later"), AlertPlanner.plan(tasks, on, now, zone).map { it.id })
    }

    @Test
    fun nothingIsPlannedWhenDisabled() {
        val tasks = listOf(task("a", "2026-11-05", "13:00"))
        assertTrue(AlertPlanner.plan(tasks, NotificationSettings(enabled = false, summaryEnabled = true), 0L, zone).isEmpty())
    }

    @Test
    fun tasksDueAtTheSameTimeShareOneAlert() {
        val tasks = listOf(task("a", "2026-11-05", "13:00"), task("b", "2026-11-05", "13:00"), task("c", "2026-11-05", "14:00"))
        val got = AlertPlanner.taskAlerts(tasks, 0L, zone)
        assertEquals(2, got.size)
        assertEquals("2 reminders due", got[0].text)
        assertEquals("group-${at("2026-11-05", "13:00")}", got[0].id)
        assertEquals("c", got[1].text)
    }

    @Test
    fun capsHowManyAlertsAreScheduled() {
        val tasks = (0 until 80).map { task("t$it", "2026-12-01", "%02d:%02d".format(it / 60 + 8, it % 60)) }
        assertEquals(AlertPlanner.MAX_TASK_ALERTS, AlertPlanner.taskAlerts(tasks, 0L, zone).size)
    }

    @Test
    fun staleIdsAreTheOnesNoLongerPlanned() {
        val planned = listOf(PlannedAlert("task-a", 1L, "t", "a"))
        assertEquals(setOf("task-b"), AlertPlanner.staleIds(setOf("task-a", "task-b"), planned))
    }

    @Test
    fun summaryUsesTodayIfTheTimeHasntPassed() {
        val nine = LocalTime.of(9, 0)
        assertEquals(at("2026-11-05", "09:00"), AlertPlanner.nextSummaryAt(at("2026-11-05", "08:00"), nine, zone))
    }

    @Test
    fun summaryRollsToTomorrowOnceThePointHasPassed() {
        val nine = LocalTime.of(9, 0)
        assertEquals(at("2026-11-06", "09:00"), AlertPlanner.nextSummaryAt(at("2026-11-05", "09:00"), nine, zone))
        assertEquals(at("2026-11-06", "09:00"), AlertPlanner.nextSummaryAt(at("2026-11-05", "20:00"), nine, zone))
    }

    @Test
    fun summaryCountsTasksDatedOnTheDayItFiresAndIgnoresDoneOnes() {
        val settings = NotificationSettings(enabled = true, summaryEnabled = true)
        val tasks = listOf(
            task("a", "2026-11-06"),
            task("b", "2026-11-06", "15:00"),
            task("c", "2026-11-06", done = true),
            task("d", "2026-11-07"),
        )
        val got = AlertPlanner.summaryAlert(tasks, settings, at("2026-11-05", "20:00"), zone)!!
        assertEquals("2 reminders today", got.text)
        assertEquals(at("2026-11-06", "09:00"), got.atMillis)
        assertEquals(AlertPlanner.SUMMARY_ID, got.id)
    }

    @Test
    fun summaryIsSkippedWhenNothingIsDatedThatDay() {
        val settings = NotificationSettings(enabled = true, summaryEnabled = true)
        assertNull(AlertPlanner.summaryAlert(listOf(task("a", "2026-11-09")), settings, at("2026-11-05", "20:00"), zone))
    }

    @Test
    fun summaryIsSkippedWhenItsOwnToggleIsOff() {
        val tasks = listOf(task("a", "2026-11-06"))
        assertNull(AlertPlanner.summaryAlert(tasks, on, at("2026-11-05", "20:00"), zone))
    }

    @Test
    fun oneTaskSummaryReadsAsSingular() {
        val settings = NotificationSettings(enabled = true, summaryEnabled = true)
        val got = AlertPlanner.summaryAlert(listOf(task("a", "2026-11-06")), settings, at("2026-11-05", "20:00"), zone)!!
        assertEquals("1 reminder today", got.text)
    }
}
