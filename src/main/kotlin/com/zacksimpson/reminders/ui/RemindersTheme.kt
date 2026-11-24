package com.zacksimpson.reminders.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.platform.LocalWindowInfo
import com.thelightphone.sdk.ui.LightTheme
import com.thelightphone.sdk.ui.LightThemeController

@Composable
fun RemindersTheme(content: @Composable () -> Unit) {
    val colors by LightThemeController.colors.collectAsState()
    val windowInfo = LocalWindowInfo.current
    // a flow, not a plain read, so it still updates while the tool is in the background
    LaunchedEffect(windowInfo) {
        snapshotFlow { windowInfo.isWindowFocused }.collect { AppVisibility.focused = it }
    }
    LightTheme(colors = colors, content = content)
}
