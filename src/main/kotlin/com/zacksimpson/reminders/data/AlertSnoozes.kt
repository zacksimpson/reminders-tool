package com.zacksimpson.reminders.data

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

/** snoozes stay on the phone, they move an alert and never touch a task's due time */
class AlertSnoozeStore(private val dataStore: DataStore<Preferences>) {
    val snoozes: Flow<Map<String, Snooze>> = dataStore.data.map { decodeSnoozes(it[KEY]) }

    suspend fun all(): Map<String, Snooze> = snoozes.first()

    suspend fun save(taskId: String, snooze: Snooze) {
        dataStore.edit { p -> p[KEY] = encodeSnoozes(decodeSnoozes(p[KEY]) + (taskId to snooze)) }
    }

    /** drops snoozes for tasks that are gone, done, or have a new due time */
    suspend fun keepOnly(taskIds: Set<String>) {
        dataStore.edit { p ->
            val current = decodeSnoozes(p[KEY])
            val kept = current.filterKeys { it in taskIds }
            if (kept.size != current.size) p[KEY] = encodeSnoozes(kept)
        }
    }

    private companion object {
        val KEY = stringPreferencesKey("alert_snoozes")
    }
}

internal fun encodeSnoozes(snoozes: Map<String, Snooze>): String =
    snoozes.entries.joinToString("\n") { (id, s) -> "$id\t${s.dueAtMillis}\t${s.untilMillis}" }

internal fun decodeSnoozes(raw: String?): Map<String, Snooze> =
    raw.orEmpty().lineSequence().mapNotNull { line ->
        val parts = line.split("\t")
        val due = parts.getOrNull(1)?.toLongOrNull()
        val until = parts.getOrNull(2)?.toLongOrNull()
        if (parts.size != 3 || parts[0].isEmpty() || due == null || until == null) null
        else parts[0] to Snooze(due, until)
    }.toMap()
