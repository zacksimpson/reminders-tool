package com.zacksimpson.reminders.data

import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.temporal.ChronoUnit

data class SnoozeChoice(val key: String, val label: String, val atMillis: Long)

/** the remind later options, worked out from when the alert is on screen */
object SnoozePresets {
    private val SLOTS = listOf(
        LocalTime.of(9, 0) to "This Morning",
        LocalTime.of(15, 0) to "This Afternoon",
        LocalTime.of(18, 0) to "This Evening",
    )
    private val TOMORROW_MORNING = LocalTime.of(9, 0)

    fun choices(now: Long, zone: ZoneId): List<SnoozeChoice> {
        val minute = Instant.ofEpochMilli(now).truncatedTo(ChronoUnit.MINUTES)
        val local = minute.atZone(zone)
        return listOf(
            SnoozeChoice("hour", "In 1 Hour", minute.plus(1, ChronoUnit.HOURS).toEpochMilli()),
            nextSlot(local),
            SnoozeChoice("tomorrow", "Tomorrow", minute.plus(24, ChronoUnit.HOURS).toEpochMilli()),
        )
    }

    /** the next of the day's slots, or tomorrow morning once the last one has passed */
    private fun nextSlot(now: ZonedDateTime): SnoozeChoice {
        val today = now.toLocalDate()
        SLOTS.forEach { (time, label) ->
            val at = today.atTime(time).atZone(now.zone)
            if (at.isAfter(now)) return SnoozeChoice("slot", label, at.toInstant().toEpochMilli())
        }
        val at = today.plusDays(1).atTime(TOMORROW_MORNING).atZone(now.zone)
        return SnoozeChoice("slot", "Tomorrow Morning", at.toInstant().toEpochMilli())
    }

    /** epoch millis for a picked "YYYY-MM-DD" and "HH:MM" */
    fun customAt(date: String, time: String, zone: ZoneId): Long =
        LocalDate.parse(date).atTime(LocalTime.parse(time)).atZone(zone).toInstant().toEpochMilli()
}
