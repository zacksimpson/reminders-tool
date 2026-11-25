package com.zacksimpson.reminders.data

import android.util.Log
import com.thelightphone.sdk.LightAlert
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import java.lang.ref.WeakReference

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

    // the alert handed out and who has it, so it isn't lost if that screen is destroyed first
    private var held: LightAlert? = null
    private var holder: WeakReference<Any>? = null

    // the screen shown last, the only one that shows alerts. an older one can still be alive in
    // the background and would push the alert somewhere nobody can see it.
    private var current: WeakReference<Any>? = null

    /** [owner] just came on screen, so it takes over showing alerts, including one an older screen holds */
    @Synchronized
    fun becomeCurrent(owner: Any) {
        current = WeakReference(owner)
        val alert = held ?: return
        if (holder?.get() === owner) return
        Log.w("AlertInbox", "moved ${alert.id} to the screen now showing")
        held = null
        holder = null
        showing = false
        _pending.update { list -> listOf(alert) + list.filterNot { it.id == alert.id } }
    }

    @Synchronized
    fun isCurrent(owner: Any): Boolean = current?.get() === owner

    /**
     * the next waiting alert, held for [owner] until it's handled or [release]d. the flag is set
     * before the queue changes, since collectors can run inside that change and must see it.
     */
    @Synchronized
    fun takeNext(owner: Any): LightAlert? {
        if (showing) return null
        val next = _pending.value.firstOrNull() ?: return null
        showing = true
        held = next
        holder = WeakReference(owner)
        _pending.update { list -> list.filterNot { it === next } }
        return next
    }

    /** the alert [owner] held was dealt with, or had nothing left to show */
    @Synchronized
    fun handled(owner: Any) {
        if (holder?.get() !== owner) return
        held = null
        holder = null
        showing = false
    }

    /** [owner] is going away, so an alert it was still showing goes back to the front of the queue */
    @Synchronized
    fun release(owner: Any) {
        if (current?.get() === owner) current = null
        val alert = held ?: return
        if (holder?.get() !== owner) return
        Log.w("AlertInbox", "requeued ${alert.id}, its screen was destroyed first")
        held = null
        holder = null
        showing = false
        _pending.update { list -> listOf(alert) + list.filterNot { it.id == alert.id } }
    }
}
