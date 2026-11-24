package com.zacksimpson.reminders.ui

/** whether the tool's window has focus right now, kept up to date by the theme wrapper */
object AppVisibility {
    @Volatile
    var focused = false
}
