package com.zacksimpson.reminders.data

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

/** 12 or 24 hour times, a device setting that stays out of the synced settings */
class TimeFormatPrefs(private val dataStore: DataStore<Preferences>) {
    val use24Hour: Flow<Boolean> = dataStore.data.map { it[USE_24_HOUR] ?: false }

    suspend fun setUse24Hour(value: Boolean) {
        dataStore.edit { it[USE_24_HOUR] = value }
    }

    private companion object {
        val USE_24_HOUR = booleanPreferencesKey("time_use_24_hour")
    }
}

/** the current choice, read by the time formatters and the time picker */
object TimeFormat {
    var use24Hour by mutableStateOf(false)
}
