package com.zacksimpson.reminders.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.thelightphone.sdk.SealedLightActivity
import com.thelightphone.sdk.SimpleLightScreen
import com.thelightphone.sdk.ui.LightBarButton
import com.thelightphone.sdk.ui.LightIcons
import com.thelightphone.sdk.ui.LightScrollView
import com.thelightphone.sdk.ui.LightText
import com.thelightphone.sdk.ui.LightTextVariant
import com.thelightphone.sdk.ui.LightThemeTokens
import com.thelightphone.sdk.ui.LightTopBar
import com.thelightphone.sdk.ui.LightTopBarCenter
import com.thelightphone.sdk.ui.gridUnitsAsDp
import com.thelightphone.sdk.ui.lightClickable
import com.zacksimpson.reminders.ui.RemindersTheme
import com.zacksimpson.reminders.ui.SwipeBackContainer
import com.zacksimpson.reminders.ui.UnderlinedHeading

data class PickerOption(val key: String, val label: String)

/**
 * single-select list. tapping an option returns its key as the screen result, the current
 * selection is underlined. returns nothing if backed out.
 */
class OptionPickerScreen(
    sealedActivity: SealedLightActivity,
    private val title: String,
    private val options: List<PickerOption>,
    private val selectedKey: String,
) : SimpleLightScreen<String>(sealedActivity) {

    @Composable
    override fun Content() {
        RemindersTheme {
            SwipeBackContainer(onSwipeBack = { goBack(null) }) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .background(LightThemeTokens.colors.background),
            ) {
                LightTopBar(
                    leftButton = LightBarButton.LightIcon(LightIcons.BACK, onClick = { goBack(null) }),
                    center = LightTopBarCenter.Text(title),
                    rightButton = null,
                    modifier = Modifier.padding(bottom = 1f.gridUnitsAsDp()),
                )
                LightScrollView(
                    modifier = Modifier.fillMaxSize(),
                ) {
                    options.forEach { option ->
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .lightClickable { goBack(option.key) }
                                .padding(
                                    start = 1.5f.gridUnitsAsDp(),
                                    top = 0.75f.gridUnitsAsDp(),
                                    bottom = 0.75f.gridUnitsAsDp(),
                                ),
                        ) {
                            UnderlinedHeading(
                                text = option.label,
                                underlined = option.key == selectedKey,
                            )
                        }
                    }
                }
            }
            }
        }
    }
}
