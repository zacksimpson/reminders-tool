package com.zacksimpson.reminders.screens

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.thelightphone.sdk.ui.LightScrollView
import com.thelightphone.sdk.ui.LightText
import com.thelightphone.sdk.ui.LightTextVariant
import com.thelightphone.sdk.ui.LightTopBar
import com.thelightphone.sdk.ui.LightTopBarCenter
import com.thelightphone.sdk.ui.gridUnitsAsDp
import com.thelightphone.sdk.ui.lightClickable
import com.zacksimpson.reminders.DataState

/**
 * settings tab: top-level links. Task Behaviors folds Today View / Default List /
 * After Quick Add / Add New Tasks under one screen.
 */
@Composable
fun SettingsTab(
    state: DataState,
    onOpenTaskBehaviors: () -> Unit,
    onOpenAccount: () -> Unit,
    onOpenNotifications: () -> Unit,
    onOpenTimeFormat: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxSize()) {
        LightTopBar(
            leftButton = null,
            center = LightTopBarCenter.Text("Settings"),
            rightButton = null,
            modifier = Modifier.padding(bottom = 1f.gridUnitsAsDp()),
        )

        when (state) {
            is DataState.Loading -> Unit

            is DataState.Corrupt -> LightText(
                text = state.message,
                variant = LightTextVariant.Copy,
                modifier = Modifier.padding(horizontal = 1.5f.gridUnitsAsDp()),
            )

            is DataState.Ready -> {
                LightScrollView(
                    modifier = Modifier.fillMaxSize(),
                ) {
                    SettingsLinkRow("Account", onOpenAccount)
                    SettingsLinkRow("Notifications", onOpenNotifications)
                    SettingsLinkRow("Task Behaviors", onOpenTaskBehaviors)
                    SettingsLinkRow("Time Format", onOpenTimeFormat)
                }
            }
        }
    }
}

/** a settings row that's just a label leading to another screen, no current-value line. */
@Composable
private fun SettingsLinkRow(label: String, onClick: () -> Unit) {
    LightText(
        text = label,
        variant = LightTextVariant.Heading,
        modifier = Modifier
            .fillMaxWidth()
            .lightClickable(onClick = onClick)
            .padding(start = 1.5f.gridUnitsAsDp(), top = 1f.gridUnitsAsDp(), bottom = 1f.gridUnitsAsDp()),
    )
}
