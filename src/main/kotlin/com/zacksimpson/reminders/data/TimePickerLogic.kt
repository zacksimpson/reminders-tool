package com.zacksimpson.reminders.data

/**
 * digit-entry validation for the time-picker numpad.
 *
 * display slots (right-to-left fill):
 * 1 digit  "6"    ->  "  : 6"
 * 2 digits "63"   ->  "  :63"
 * 3 digits "630"  ->  "6:30"
 * 4 digits "1230" ->  "12:30"
 */
object TimePickerLogic {

    private fun isValid2Digits(proposed: String, use24Hour: Boolean): Boolean {
        val b = proposed[1].digitToInt()
        if (proposed[0] == '0') {
            // 24h: 00-09 all valid; 12h: 01-09
            return b >= (if (use24Hour) 0 else 1) && b <= 9
        }
        // in 24h mode, "1" followed by 6-9 is valid (hours 16-19)
        if (use24Hour && proposed[0] == '1') {
            return b <= 9
        }
        // otherwise second digit is minutes-tens (0-5)
        return b <= 5
    }

    private fun isValid3Digits(proposed: String, use24Hour: Boolean): Boolean {
        val firstDigit = proposed[0].digitToInt()
        // leading zero case: "0yz" -> on way to "0yzw" = 0y:zw
        if (firstDigit == 0) {
            val hourOnes = proposed[1].digitToInt()
            val minTens = proposed[2].digitToInt()
            val minHourOnes = if (use24Hour) 0 else 1
            return hourOnes >= minHourOnes && hourOnes <= 9 && minTens in 0..5
        }
        // in 24h mode, "1x" (x=6-9) is building a 4-digit time, e.g. "160" -> "1600".
        if (use24Hour) {
            val h = proposed.substring(0, 2).toInt()
            val minTens = proposed[2].digitToInt()
            if (h in 10..23 && minTens in 0..5) {
                return true
            }
        }
        // normal H:MM case: first digit is hour (1-9), last two are minutes
        val m = proposed.substring(1).toInt()
        return firstDigit in 1..9 && m in 0..59
    }

    private fun isValid4Digits(proposed: String, use24Hour: Boolean): Boolean {
        val h = proposed.substring(0, 2).toInt()
        val m = proposed.substring(2).toInt()
        val maxH = if (use24Hour) 23 else 12
        val minH = if (use24Hour) 0 else 1
        return h in minH..maxH && m in 0..59
    }

    /** a full time is 4 digits, or 3 that don't start with 0 (a leading 0 is still on the way to 4) */
    fun isComplete(digits: String): Boolean =
        digits.length == 4 || (digits.length == 3 && digits[0] != '0')

    /** whether appending [next] to [current] produces a digit string that's still a valid
     *  prefix toward some eventual 3- or 4-digit time. */
    fun isValidNextDigit(current: String, next: Char, use24Hour: Boolean): Boolean {
        val proposed = current + next
        return when (proposed.length) {
            1 -> true
            2 -> isValid2Digits(proposed, use24Hour)
            3 -> isValid3Digits(proposed, use24Hour)
            4 -> isValid4Digits(proposed, use24Hour)
            else -> false
        }
    }

    /** raw typed digits -> the "H:MM"/"HH:MM"/partial display string, space-padded so the
     *  colon stays in a stable position as digits are typed. */
    fun buildDisplay(digits: String): String = when (digits.length) {
        0 -> "  :  "
        1 -> "  : ${digits[0]}"
        2 -> "  :$digits"
        3 -> "${digits[0]}:${digits.substring(1)}"
        4 -> "${digits.substring(0, 2)}:${digits.substring(2)}"
        else -> "  :  "
    }
}
