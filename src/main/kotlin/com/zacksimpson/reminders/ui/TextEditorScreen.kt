package com.zacksimpson.reminders.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.text.input.rememberTextFieldState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.thelightphone.sdk.SealedLightActivity
import com.thelightphone.sdk.SimpleLightScreen
import com.thelightphone.sdk.rememberKeyboardOptions
import com.thelightphone.sdk.ui.LightTextInputEditor
import com.thelightphone.sdk.ui.LightThemeTokens

data class TextEditorRequest(
    val title: String,
    val initialValue: String = "",
    val autoCapitalize: Boolean = true,
)

/**
 * reusable single-line text entry backed by the LightOS keyboard. returns the entered
 * text as the screen result on submit, or nothing if the user backs out.
 *
 * push it with `navigateTo({ TextEditorScreen(it, TextEditorRequest("...")) }) { text -> ... }`.
 */
class TextEditorScreen(
    sealedActivity: SealedLightActivity,
    private val request: TextEditorRequest,
) : SimpleLightScreen<String>(sealedActivity) {

    @Composable
    override fun Content() {
        val textState = rememberTextFieldState(request.initialValue)
        val keyboardOptions = rememberKeyboardOptions()
        RemindersTheme {
            SwipeBackContainer(onSwipeBack = { goBack(null) }) {
            LightTextInputEditor(
                title = request.title,
                state = textState,
                keyboardOptionsFlow = keyboardOptions,
                onSubmit = { goBack(it.toString()) },
                onBack = { goBack(null) },
                submitLabel = "DONE",
                autoCapitalize = request.autoCapitalize,
                // default is multi-line, where Return inserts "\n", every field here is
                // single-line, so Return should submit instead.
                singleLine = true,
                // editorKey defaults to `title`, keying the embedded keyboard's
                // viewModel() call. this screen has no per-screen ViewModelStoreOwner, so
                // a fixed key reused across pushes (e.g. add one task, then another) would
                // hand back the first push's now-abandoned TextFieldState, the keyboard
                // renders but keystrokes go nowhere. `this` is unique per push. qualified
                // since unqualified `this` here resolves to SwipeBackContainer's BoxScope.
                editorKey = this@TextEditorScreen,
                modifier = Modifier.background(LightThemeTokens.colors.background),
            )
            }
        }
    }
}
