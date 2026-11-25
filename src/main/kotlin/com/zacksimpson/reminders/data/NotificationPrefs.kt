package com.zacksimpson.reminders.data

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

/** notification settings stay out of the synced settings, permissions are per phone */
class NotificationPrefs(private val dataStore: DataStore<Preferences>) {
    val settings: Flow<NotificationSettings> = dataStore.data.map { p ->
        NotificationSettings(
            enabled = p[ENABLED] ?: false,
            summaryEnabled = p[SUMMARY_ENABLED] ?: false,
            summaryTime = p[SUMMARY_TIME] ?: DEFAULT_SUMMARY_TIME,
        )
    }

    suspend fun setEnabled(value: Boolean) {
        dataStore.edit { it[ENABLED] = value }
    }

    suspend fun setSummaryEnabled(value: Boolean) {
        dataStore.edit { it[SUMMARY_ENABLED] = value }
    }

    suspend fun setSummaryTime(value: String) {
        dataStore.edit { it[SUMMARY_TIME] = value }
    }

    private companion object {
        const val DEFAULT_SUMMARY_TIME = "09:00"
        val ENABLED = booleanPreferencesKey("notifications_enabled")
        val SUMMARY_ENABLED = booleanPreferencesKey("notifications_summary_enabled")
        val SUMMARY_TIME = stringPreferencesKey("notifications_summary_time")
    }
}
