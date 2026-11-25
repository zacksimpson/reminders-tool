package com.zacksimpson.reminders.data

import java.time.LocalTime
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class TimePickerLogicTest {
    @Test
    fun aLeadingZeroIsNotAFinishedTimeUntilTheFourthDigit() {
        assertFalse(TimePickerLogic.isComplete("090"))
        assertFalse(TimePickerLogic.isComplete("012"))
        assertTrue(TimePickerLogic.isComplete("0900"))
        assertTrue(TimePickerLogic.isComplete("930"))
        assertTrue(TimePickerLogic.isComplete("1230"))
        assertFalse(TimePickerLogic.isComplete("12"))
        assertFalse(TimePickerLogic.isComplete(""))
    }

    @Test
    fun everyFinishedTimeTheNumpadAllowsIsARealClockTime() {
        var checked = 0
        fun walk(digits: String) {
            if (TimePickerLogic.isComplete(digits)) {
                for (ampm in listOf("AM", "PM")) {
                    val parsed = LocalTime.parse(digitsToTime(digits, ampm, use24Hour = false))
                    assertEquals(if (ampm == "AM") parsed.hour < 12 else parsed.hour >= 12, true, "$digits $ampm")
                    checked++
                }
            }
            if (digits.length < 4) {
                for (d in '0'..'9') if (TimePickerLogic.isValidNextDigit(digits, d, use24Hour = false)) walk(digits + d)
            }
        }
        walk("")
        assertTrue(checked > 1000, "checked $checked")
    }
}
