package com.zacksimpson.reminders.data

import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId

private val MONTHS = listOf(
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
)

/** "YYYY-MM-DD" -> "Jan 5". hardcoded English abbreviations (not locale-dependent). */
fun formatDate(dateStr: String): String {
    val (_, mo, d) = dateStr.split("-").map(String::toInt)
    return "${MONTHS[mo - 1]} $d"
}

/** "YYYY-MM-DD" -> "Jan 5, 2024", used in field rows (vs. the shorter [formatDate] used
 *  in task-row meta lines). */
fun formatDisplayDate(dateStr: String): String {
    val (y, mo, d) = dateStr.split("-").map(String::toInt)
    return "${MONTHS[mo - 1]} $d, $y"
}

/** epoch millis -> "Jan 5, 2:30 PM", for the Settings "last synced" row. */
fun formatLastSyncedAt(epochMillis: Long): String {
    val dt = LocalDateTime.ofInstant(Instant.ofEpochMilli(epochMillis), ZoneId.systemDefault())
    val dateStr = "%04d-%02d-%02d".format(dt.year, dt.monthValue, dt.dayOfMonth)
    val timeStr = "%02d:%02d".format(dt.hour, dt.minute)
    return "${formatDate(dateStr)}, ${formatTime(timeStr)}"
}

/** "HH:MM" 24h -> "h:mm AM/PM", or unchanged for the 24 hour setting */
fun formatTime(time24: String, use24Hour: Boolean = TimeFormat.use24Hour): String {
    if (use24Hour) return time24
    val (hStr, mStr) = time24.split(":")
    val h = hStr.toInt()
    val ampm = if (h >= 12) "PM" else "AM"
    val h12 = if (h % 12 == 0) 12 else h % 12
    return "$h12:$mStr $ampm"
}

/**
 * TimePicker digits ("HMM" or "HHMM") + AM/PM -> "HH:MM" 24h for storage. always applies
 * the 12h->24h hour adjustment when [use24Hour] is false, regardless of digit count.
 */
fun digitsToTime(digits: String, ampm: String, use24Hour: Boolean = false): String {
    var h: Int
    val m: String
    if (digits.length == 3) {
        h = digits[0].digitToInt()
        m = digits.substring(1)
    } else {
        h = digits.substring(0, 2).toInt()
        m = digits.substring(2, 4)
    }
    if (!use24Hour) {
        if (ampm == "PM" && h != 12) h += 12
        if (ampm == "AM" && h == 12) h = 0
    }
    return "${h.toString().padStart(2, '0')}:$m"
}

/** "HH:MM" 24h -> TimePicker digits + AM/PM, for seeding the picker from an existing time. */
fun timeToDisplayParts(time24: String, use24Hour: Boolean = false): Pair<String, String> {
    val (hStr, mStr) = time24.split(":")
    if (use24Hour) return Pair("$hStr$mStr", "AM")
    var h = hStr.toInt()
    val ampm = if (h >= 12) "PM" else "AM"
    if (h > 12) h -= 12
    if (h == 0) h = 12
    return Pair("${h.toString().padStart(2, '0')}$mStr", ampm)
}

/** true if the task's date/time is in the past. */
fun isOverdue(date: String?, time: String?): Boolean {
    if (date == null) return false
    val today = LocalDate.now()
    if (time != null) {
        val (y, mo, d) = date.split("-").map(String::toInt)
        val (h, m) = time.split(":").map(String::toInt)
        return LocalDateTime.of(y, mo, d, h, m).isBefore(LocalDateTime.now())
    }
    return LocalDate.parse(date).isBefore(today)
}

/**
 * sort order for same-day tasks. when only one of the two has a time set, the untimed
 * one sorts first, falls back to `order` when neither has a time, compares "HH:MM"
 * directly when both do.
 */
fun compareTasksByDateTime(a: Task, b: Task): Int {
    if (a.time == null && b.time == null) return a.order - b.order
    if (a.time == null) return -1
    if (b.time == null) return 1
    return a.time.compareTo(b.time)
}

/** sort order across dates, then by [compareTasksByDateTime] within the same date. */
fun compareTasksByDateThenTime(a: Task, b: Task): Int {
    if (a.date != b.date) return (a.date ?: "").compareTo(b.date ?: "")
    return compareTasksByDateTime(a, b)
}
