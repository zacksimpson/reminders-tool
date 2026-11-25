package com.zacksimpson.reminders.data

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/** Covers the digit-entry state machine ported from RN's TimePicker.tsx — this logic was
 *  fiddly to get right the first time, so it's locked down with tests rather than trusted
 *  by inspection alone. */
class TimePickerLogicTest {

    private fun valid(current: String, next: Char, use24Hour: Boolean = false) =
        TimePickerLogic.isValidNextDigit(current, next, use24Hour)

    // ── First digit ─────────────────────────────────────────────────────────────

    @Test
    fun `any first digit is valid`() {
        for (d in '0'..'9') assertTrue(valid("", d), "digit $d should be a valid first digit")
    }

    // ── Second digit — 12h mode ─────────────────────────────────────────────────

    @Test
    fun `12h leading zero requires second digit 1-9`() {
        assertFalse(valid("0", '0'))
        for (d in '1'..'9') assertTrue(valid("0", d))
    }

    @Test
    fun `12h non-zero first digit caps second digit at 5`() {
        for (d in '0'..'5') assertTrue(valid("3", d))
        for (d in '6'..'9') assertFalse(valid("3", d))
    }

    // ── Second digit — 24h mode ─────────────────────────────────────────────────

    @Test
    fun `24h leading zero allows second digit 0-9`() {
        for (d in '0'..'9') assertTrue(valid("0", d, use24Hour = true))
    }

    @Test
    fun `24h first digit 1 allows second digit 0-9 (hours 10-19)`() {
        for (d in '0'..'9') assertTrue(valid("1", d, use24Hour = true))
    }

    @Test
    fun `24h first digit other than 0 or 1 still caps at 5`() {
        for (d in '0'..'5') assertTrue(valid("2", d, use24Hour = true))
        for (d in '6'..'9') assertFalse(valid("2", d, use24Hour = true))
    }

    // ── Third digit ──────────────────────────────────────────────────────────────

    @Test
    fun `3rd digit leading-zero branch validates as HH prefix`() {
        // "09" + digit -> hourOnes=9 (valid), minTens must be 0-5
        assertTrue(valid("09", '5'))
        assertFalse(valid("09", '6'))
        // 12h: hourOnes must be >= 1 (hour 0 invalid)
        assertFalse(valid("00", '0'))
        // 24h: hourOnes 0 is fine (hour 00 valid)
        assertTrue(valid("00", '0', use24Hour = true))
    }

    @Test
    fun `3rd digit normal H-MM branch caps minutes at 59`() {
        // "63" -> h=6, m so far "3", proposed "630" -> m=30, valid
        assertTrue(valid("63", '0'))
        // "69" -> m would be 9x, "699" -> m=99 invalid
        assertFalse(valid("69", '9'))
    }

    @Test
    fun `3rd digit 24h 1x-prefix branch allows building toward hours 16-19`() {
        // "16" + digit -> could become HH=16, minTens=digit (0-5)
        assertTrue(valid("16", '0', use24Hour = true))
        assertFalse(valid("16", '6', use24Hour = true))
    }

    // ── Fourth digit ─────────────────────────────────────────────────────────────

    @Test
    fun `4th digit validates full HH-MM range 12h`() {
        assertTrue(valid("123", '0')) // 12:30
        assertFalse(valid("136", '0')) // hour 13 invalid in 12h (max 12)
    }

    @Test
    fun `4th digit validates full HH-MM range 24h`() {
        assertTrue(valid("235", '9', use24Hour = true)) // 23:59
        assertFalse(valid("245", '9', use24Hour = true)) // hour 24 invalid
    }

    @Test
    fun `4th digit rejects minutes over 59`() {
        assertFalse(valid("126", '0')) // 12:60 invalid
    }

    // ── Full realistic entry sequences ──────────────────────────────────────────

    @Test
    fun `typing 6-3-0 builds a valid 6-30 entry`() {
        var digits = ""
        for (d in "630") {
            assertTrue(valid(digits, d), "'$digits' + '$d' should be valid")
            digits += d
        }
        assertEquals("6:30", TimePickerLogic.buildDisplay(digits))
    }

    @Test
    fun `typing 1-6-0-0 builds a valid 16-00 entry in 24h mode`() {
        var digits = ""
        for (d in "1600") {
            assertTrue(valid(digits, d, use24Hour = true), "'$digits' + '$d' should be valid")
            digits += d
        }
        assertEquals("16:00", TimePickerLogic.buildDisplay(digits))
    }

    // ── Display building ─────────────────────────────────────────────────────────

    @Test
    fun `display padding for each digit count`() {
        assertEquals("  :  ", TimePickerLogic.buildDisplay(""))
        assertEquals("  : 6", TimePickerLogic.buildDisplay("6"))
        assertEquals("  :63", TimePickerLogic.buildDisplay("63"))
        assertEquals("6:30", TimePickerLogic.buildDisplay("630"))
        assertEquals("12:30", TimePickerLogic.buildDisplay("1230"))
    }

    // ── digitsToTime / timeToDisplayParts round-trip ────────────────────────────

    @Test
    fun `digitsToTime applies 12h to 24h adjustment`() {
        assertEquals("18:30", digitsToTime("630", "PM"))
        assertEquals("06:30", digitsToTime("630", "AM"))
        assertEquals("00:15", digitsToTime("1215", "AM")) // 12 AM -> 00
        assertEquals("12:15", digitsToTime("1215", "PM")) // 12 PM stays 12
    }

    @Test
    fun `digitsToTime passes through unchanged in 24h mode`() {
        assertEquals("16:00", digitsToTime("1600", "AM", use24Hour = true))
    }

    @Test
    fun `timeToDisplayParts round-trips through digitsToTime`() {
        for (stored in listOf("00:15", "06:30", "12:15", "18:30", "23:59")) {
            val (digits, ampm) = timeToDisplayParts(stored)
            val roundTripped = digitsToTime(digits, ampm)
            assertEquals(stored, roundTripped, "round-trip failed for $stored")
        }
    }

    @Test
    fun `timeToDisplayParts in 24h mode returns raw digits and AM placeholder`() {
        val (digits, ampm) = timeToDisplayParts("16:05", use24Hour = true)
        assertEquals("1605", digits)
        assertEquals("AM", ampm)
    }
}
