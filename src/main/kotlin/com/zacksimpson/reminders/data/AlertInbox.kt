package com.zacksimpson.reminders.data

import com.thelightphone.sdk.LightAlert
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

/** alerts that have arrived and not been shown yet, oldest first */
object AlertInbox {
    private val _pending = MutableStateFlow<List<LightAlert>>(emptyList())
    val pending: StateFlow<List<LightAlert>> = _pending.asStateFlow()

    /** true while an alert screen is up */
    @Volatile
    var showing = false

    /** set when alerts arrive while the tool wasn't on screen, so it closes once they're handled */
    @Volatile
    var closeWhenDone = false

    /** how long the tool waits before closing, so a toast shown by the last alert isn't cut off */
    @Volatile
    var closeDelayMs = 0L

    fun receive(alert: LightAlert, toolOnScreen: Boolean) {
        if (_pending.value.isEmpty() && !showing && !toolOnScreen) closeWhenDone = true
        _pending.update { current -> current.filterNot { it.id == alert.id } + alert }
    }

    fun takeNext(): LightAlert? {
        var next: LightAlert? = null
        _pending.update { current ->
            next = current.firstOrNull()
            current.drop(1)
        }
        return next
    }
}
