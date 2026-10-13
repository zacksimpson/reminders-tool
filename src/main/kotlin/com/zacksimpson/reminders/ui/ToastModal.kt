package com.zacksimpson.reminders.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import com.thelightphone.sdk.ui.LightModal
import com.thelightphone.sdk.ui.LightModalManager
import com.thelightphone.sdk.ui.LightText
import com.thelightphone.sdk.ui.LightTextVariant
import com.thelightphone.sdk.ui.LightThemeTokens
import kotlinx.coroutines.CompletableDeferred
import kotlin.time.Duration
import kotlin.time.Duration.Companion.seconds

/** full-screen message that dismisses itself, shown through the SDK's [LightModalManager]. */
private class ToastModal(private val message: String) : LightModal {
    private val dismissed = CompletableDeferred<Unit>()

    override val onExpired: () -> Unit = {}
    override fun dismiss() { dismissed.complete(Unit) }
    override suspend fun awaitDismiss() { dismissed.await() }

    @Composable
    override fun Content() {
        RemindersTheme {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(LightThemeTokens.colors.background),
                contentAlignment = Alignment.Center,
            ) {
                LightText(text = message, variant = LightTextVariant.Subtitle)
            }
        }
    }
}

fun showToast(message: String, duration: Duration = 1.seconds) {
    LightModalManager.show(ToastModal(message), duration)
}
