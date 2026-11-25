package com.zacksimpson.reminders.screens

import android.Manifest
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewModelScope
import com.thelightphone.sdk.LightScreen
import com.thelightphone.sdk.LightViewModel
import com.thelightphone.sdk.SealedLightActivity
import com.thelightphone.sdk.rememberPermissionRequestLauncher
import com.thelightphone.sdk.ui.LightBarButton
import com.thelightphone.sdk.ui.LightIcons
import com.thelightphone.sdk.ui.LightThemeTokens
import com.thelightphone.sdk.ui.LightTopBar
import com.thelightphone.sdk.ui.LightTopBarCenter
import com.thelightphone.sdk.ui.gridUnitsAsDp
import com.zacksimpson.reminders.data.AlertSync
import com.zacksimpson.reminders.data.NotificationPrefs
import com.zacksimpson.reminders.data.NotificationSettings
import com.zacksimpson.reminders.data.formatTime
import com.zacksimpson.reminders.ui.RemindersTheme
import com.zacksimpson.reminders.ui.SwipeBackContainer
import com.zacksimpson.reminders.ui.TapField
import com.zacksimpson.reminders.ui.ToggleSwitch
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class NotificationsViewModel(private val prefs: NotificationPrefs) : LightViewModel<Unit>() {
    val settings = prefs.settings.stateIn(viewModelScope, SharingStarted.Eagerly, NotificationSettings())

    fun setEnabled(value: Boolean) {
        viewModelScope.launch { prefs.setEnabled(value) }
    }

    fun setSummaryEnabled(value: Boolean) {
        viewModelScope.launch { prefs.setSummaryEnabled(value) }
    }

    fun setSummaryTime(value: String) {
        viewModelScope.launch { prefs.setSummaryTime(value) }
    }
}

/**
 * reminders fire at each task's time, plus an optional morning summary. both need
 * notifications allowed, so the screen offers to request it when it's missing.
 */
class NotificationsScreen(
    sealedActivity: SealedLightActivity,
) : LightScreen<Unit, NotificationsViewModel>(sealedActivity) {

    // bumped on every return so the permission state is read again after a grant
    private var resumeCount by mutableIntStateOf(0)

    override val viewModelClass: Class<NotificationsViewModel>
        get() = NotificationsViewModel::class.java

    override fun createViewModel() = NotificationsViewModel(NotificationPrefs(lightContext.dataStore))

    override fun willShow() {
        super.willShow()
        resumeCount++
        AlertSync.requestNow()
    }

    @Composable
    override fun Content() {
        RemindersTheme {
            SwipeBackContainer(onSwipeBack = { goBack(null) }) {
                val settings by viewModel.settings.collectAsState()
                val postLauncher = rememberPermissionRequestLauncher(Manifest.permission.POST_NOTIFICATIONS)
                val canPost = remember(resumeCount) { lightContext.notifications.canPostNotifications() }

                fun askForMissingPermission() {
                    if (!canPost) postLauncher?.launch()
                }

                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(LightThemeTokens.colors.background),
                ) {
                    LightTopBar(
                        leftButton = LightBarButton.LightIcon(LightIcons.BACK, onClick = { goBack(null) }),
                        center = LightTopBarCenter.Text("Notifications"),
                        rightButton = null,
                        modifier = Modifier.padding(bottom = 1f.gridUnitsAsDp()),
                    )

                    ToggleSwitch(
                        label = "Enable Notifications",
                        value = settings.enabled,
                        onValueChange = {
                            viewModel.setEnabled(it)
                            if (it) askForMissingPermission()
                        },
                    )

                    if (settings.enabled) {
                        if (!canPost) {
                            TapField(
                                label = "Not allowed yet",
                                value = "Allow notifications",
                                onClick = ::askForMissingPermission,
                            )
                        }

                        ToggleSwitch(
                            label = "Today's Tasks",
                            value = settings.summaryEnabled,
                            onValueChange = { viewModel.setSummaryEnabled(it) },
                        )

                        if (settings.summaryEnabled) {
                            TapField(
                                label = "Notification Time",
                                value = formatTime(settings.summaryTime),
                                largeValue = true,
                                onClick = {
                                    navigateTo(
                                        screenFactory = { TimePickerScreen(it, settings.summaryTime) },
                                        resultCallback = { result -> result?.let { viewModel.setSummaryTime(it) } },
                                    )
                                },
                            )
                        }
                    }
                }
            }
        }
    }
}
