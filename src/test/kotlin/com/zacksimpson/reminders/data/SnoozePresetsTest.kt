package com.zacksimpson.reminders.data

import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import kotlin.test.Test
import kotlin.test.assertEquals

class SnoozePresetsTest {
    private val zone = ZoneId.of("UTC")

    private fun at(date: String, time: String, seconds: Int = 0) =
        LocalDate.parse(date).atTime(LocalTime.parse(time).withSecond(seconds)).atZone(zone).toInstant().toEpochMilli()

    private fun choices(date: String, time: String) = SnoozePresets.choices(at(date, time), zone)

    @Test
    fun beforeNineTheSlotIsThisMorning() {
        val slot = choices("2026-11-05", "07:30")[1]
        assertEquals("This morning", slot.label)
        assertEquals(at("2026-11-05", "09:00"), slot.atMillis)
    }

    @Test
    fun midMorningTheSlotIsThisAfternoon() {
        val slot = choices("2026-11-05", "10:30")[1]
        assertEquals("This afternoon", slot.label)
        assertEquals(at("2026-11-05", "15:00"), slot.atMillis)
    }

    @Test
    fun midAfternoonTheSlotIsThisEvening() {
        val slot = choices("2026-11-05", "16:00")[1]
        assertEquals("This evening", slot.label)
        assertEquals(at("2026-11-05", "18:00"), slot.atMillis)
    }

    @Test
    fun aSlotRightNowIsAlreadyPast() {
        assertEquals("This evening", choices("2026-11-05", "15:00")[1].label)
        assertEquals("Tomorrow morning", choices("2026-11-05", "18:00")[1].label)
    }

    @Test
    fun afterSixTheSlotIsTomorrowMorning() {
        val slot = choices("2026-11-05", "21:10")[1]
        assertEquals("Tomorrow morning", slot.label)
        assertEquals(at("2026-11-06", "09:00"), slot.atMillis)
    }

    @Test
    fun oneHourAndTomorrowCountFromThisMinute() {
        val now = at("2026-11-05", "10:30", seconds = 40)
        val got = SnoozePresets.choices(now, zone)
        assertEquals(at("2026-11-05", "11:30"), got[0].atMillis)
        assertEquals(at("2026-11-06", "10:30"), got[2].atMillis)
        assertEquals(listOf("In 1 hour", "This afternoon", "Tomorrow"), got.map { it.label })
    }

    @Test
    fun aPickedDateAndTimeBecomeOneMoment() {
        assertEquals(at("2026-11-07", "14:05"), SnoozePresets.customAt("2026-11-07", "14:05", zone))
    }
}
