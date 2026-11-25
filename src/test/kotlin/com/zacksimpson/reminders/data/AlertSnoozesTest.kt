package com.zacksimpson.reminders.data

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class AlertSnoozesTest {
    @Test
    fun snoozesSurviveTheRoundTrip() {
        val map = mapOf("a" to Snooze(1L, 2L), "1782218607076-983anbv" to Snooze(30L, 40L))
        assertEquals(map, decodeSnoozes(encodeSnoozes(map)))
    }

    @Test
    fun emptyAndMissingDecodeToNothing() {
        assertTrue(decodeSnoozes(null).isEmpty())
        assertTrue(decodeSnoozes("").isEmpty())
        assertEquals("", encodeSnoozes(emptyMap()))
    }

    @Test
    fun malformedLinesAreSkipped() {
        val raw = "a\t1\t2\nbroken\nb\tx\t3\n\t5\t6\nc\t7\t8"
        assertEquals(mapOf("a" to Snooze(1L, 2L), "c" to Snooze(7L, 8L)), decodeSnoozes(raw))
    }
}
