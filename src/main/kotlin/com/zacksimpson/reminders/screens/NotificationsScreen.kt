package com.zacksimpson.reminders.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import com.thelightphone.sdk.LightScreen
import com.thelightphone.sdk.LightViewModel
import com.thelightphone.sdk.SealedLightActivity
import com.thelightphone.sdk.ui.LightBarButton
import com.thelightphone.sdk.ui.LightIcons
import com.thelightphone.sdk.ui.LightThemeTokens
import com.thelightphone.sdk.ui.LightTopBar
import com.thelightphone.sdk.ui.LightTopBarCenter
import com.thelightphone.sdk.ui.gridUnitsAsDp
import com.zacksimpson.reminders.data.formatTime
import com.zacksimpson.reminders.ui.RemindersTheme
import com.zacksimpson.reminders.ui.SwipeBackContainer
import com.zacksimpson.reminders.ui.TapField
import com.zacksimpson.reminders.ui.ToggleSwitch
import kotlinx.coroutines.flow.MutableStateFlow

class NotificationsViewModel : LightViewModel<Unit>() {
    val enabled = MutableStateFlow(false)
    val todaysTasksEnabled = MutableStateFlow(false)
    val todaysTasksTime = MutableStateFlow("09:00")

    fun setEnabled(value: Boolean) {
        enabled.value = value
    }

    fun setTodaysTasksEnabled(value: Boolean) {
        todaysTasksEnabled.value = value
    }

    fun setTodaysTasksTime(value: String) {
        todaysTasksTime.value = value
    }
}

/**
 * notification settings, labels only. not wired to anything real yet since the SDK
 * has no exact-time local alarm.
 */
class NotificationsScreen(
    sealedActivity: SealedLightActivity,
) : LightScreen<Unit, NotificationsViewModel>(sealedActivity) {

    override val viewModelClass: Class<NotificationsViewModel>
        get() = NotificationsViewModel::class.java

    override fun createViewModel() = NotificationsViewModel()

    @Composable
    override fun Content() {
        RemindersTheme {
            SwipeBackContainer(onSwipeBack = { goBack(null) }) {
            val enabled by viewModel.enabled.collectAsState()
            val todaysTasksEnabled by viewModel.todaysTasksEnabled.collectAsState()
            val todaysTasksTime by viewModel.todaysTasksTime.collectAsState()

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
                    value = enabled,
                    onValueChange = { viewModel.setEnabled(it) },
                )

                if (enabled) {
                    ToggleSwitch(
                        label = "Today's Tasks",
                        value = todaysTasksEnabled,
                        onValueChange = { viewModel.setTodaysTasksEnabled(it) },
                    )

                    if (todaysTasksEnabled) {
                        TapField(
                            label = "Notification Time",
                            value = formatTime(todaysTasksTime),
                            largeValue = true,
                            onClick = {
                                navigateTo(
                                    screenFactory = { TimePickerScreen(it, todaysTasksTime) },
                                    resultCallback = { result -> result?.let { viewModel.setTodaysTasksTime(it) } },
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
