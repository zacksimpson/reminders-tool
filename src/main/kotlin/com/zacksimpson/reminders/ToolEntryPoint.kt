package com.zacksimpson.reminders

import com.thelightphone.sdk.EntryPoint
import com.thelightphone.sdk.LightAlert
import com.thelightphone.sdk.LightEntryPoint
import com.thelightphone.sdk.shared.LightServerData
import com.zacksimpson.reminders.data.AlertInbox
import com.zacksimpson.reminders.ui.AppVisibility
import kotlinx.coroutines.flow.StateFlow

/** app-level entry point. reminders are local alerts, so push handling stays the no-op default. */
@EntryPoint
object ToolEntryPoint : LightEntryPoint {
    override suspend fun onToolCreate(serverData: StateFlow<LightServerData?>) {
    }

    override suspend fun onAlert(alert: LightAlert): Boolean {
        AlertInbox.receive(alert, toolOnScreen = AppVisibility.focused)
        // the main screen shows it, so a reboot shouldn't deliver it again
        return true
    }
}
