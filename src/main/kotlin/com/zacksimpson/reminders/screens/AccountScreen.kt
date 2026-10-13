package com.zacksimpson.reminders.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewModelScope
import com.thelightphone.sdk.LightJobState
import com.thelightphone.sdk.LightScreen
import com.thelightphone.sdk.LightViewModel
import com.thelightphone.sdk.LIGHT_FAIL_REASON
import com.thelightphone.sdk.LightWork
import com.thelightphone.sdk.SealedLightActivity
import com.thelightphone.sdk.SealedLightContext
import com.thelightphone.sdk.ui.LightBarButton
import com.thelightphone.sdk.ui.LightIcons
import com.thelightphone.sdk.ui.LightText
import com.thelightphone.sdk.ui.LightTextVariant
import com.thelightphone.sdk.ui.LightThemeTokens
import com.thelightphone.sdk.ui.LightTopBar
import com.thelightphone.sdk.ui.LightTopBarCenter
import com.thelightphone.sdk.ui.gridUnitsAsDp
import com.thelightphone.sdk.ui.lightClickable
import com.zacksimpson.reminders.data.AuthException
import com.zacksimpson.reminders.data.AuthRepository
import com.zacksimpson.reminders.data.AuthState
import com.zacksimpson.reminders.data.SYNC_JOB_KEY
import com.zacksimpson.reminders.data.SYNC_MANUAL_KEY
import com.zacksimpson.reminders.data.SYNC_OFFLINE_REASON
import com.zacksimpson.reminders.data.SYNC_NOW_TAG
import com.zacksimpson.reminders.data.authStateIn
import com.zacksimpson.reminders.data.formatLastSyncedAt
import com.zacksimpson.reminders.ui.RemindersTheme
import com.zacksimpson.reminders.ui.SwipeBackContainer
import com.zacksimpson.reminders.ui.TapField
import com.zacksimpson.reminders.ui.TextEditorRequest
import com.zacksimpson.reminders.ui.TextEditorScreen
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class AccountViewModel(
    private val authRepo: AuthRepository,
    private val lightContext: SealedLightContext,
) : LightViewModel<Unit>() {
    val authState = authRepo.authStateIn(viewModelScope, cachedAuthState)
    val email = MutableStateFlow("")
    val password = MutableStateFlow("")
    val error = MutableStateFlow<String?>(null)
    val isBusy = MutableStateFlow(false)
    val lastSyncedAt = authRepo.lastSyncedAt.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), cachedLastSyncedAt)

    init {
        // no warm caller to seed from like the list/task screens (only this screen reads
        // auth state), so we remember the last-observed value across pushes.
        viewModelScope.launch { authState.collect { cachedAuthState = it } }
        viewModelScope.launch { lastSyncedAt.collect { cachedLastSyncedAt = it } }
    }

    /** shared by MainScreen's on-open poke and this screen's own "Sync now" tap, both
     *  enqueue under the same tag so either one's outcome shows up here. */
    private val syncJobState = LightWork.observe(lightContext, SYNC_NOW_TAG)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), LightJobState.NotScheduled)

    val isSyncing = syncJobState
        .map { it is LightJobState.Enqueued || it is LightJobState.Running }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), false)

    /** true once the job gives up for good (see [SyncJob]'s [AuthException] handling),
     *  shows "Error. Tap to try again" instead of leaving "Syncing…" up forever. */
    val syncFailed = syncJobState
        .map { it is LightJobState.Failed && !it.isOffline() }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), false)

    /** the manual sync was refused because the device has no connection. */
    val syncOffline = syncJobState
        .map { it is LightJobState.Failed && it.isOffline() }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), false)

    private fun LightJobState.Failed.isOffline() = outputData[LIGHT_FAIL_REASON] == SYNC_OFFLINE_REASON

    fun syncNow() {
        LightWork.enqueue(lightContext, SYNC_JOB_KEY, mapOf(SYNC_MANUAL_KEY to "true"), tag = SYNC_NOW_TAG)
    }

    fun setEmail(value: String) {
        email.value = value
        error.value = null
    }

    fun setPassword(value: String) {
        password.value = value
        error.value = null
    }

    fun signIn() {
        val e = email.value.trim()
        val p = password.value
        if (e.isEmpty() || p.isEmpty() || isBusy.value) return
        isBusy.value = true
        error.value = null
        viewModelScope.launch {
            try {
                authRepo.signIn(e, p)
                password.value = ""
            } catch (ex: AuthException) {
                error.value = ex.message
            } catch (ex: Exception) {
                android.util.Log.e("AccountViewModel", "Sign-in failed", ex)
                error.value = "Couldn't reach the server — check your connection."
            } finally {
                isBusy.value = false
            }
        }
    }

    fun signOut() {
        viewModelScope.launch { authRepo.signOut() }
    }

    override fun onCleared() {
        authRepo.close()
    }

    private companion object {
        var cachedAuthState: AuthState = AuthState.Loading
        var cachedLastSyncedAt: Long? = null
    }
}

/**
 * sign in with the same account used on reminders-web, for phone<->desktop sync (see
 * SYNC_PLAN.md). LightTextInputEditor has no password-masking mode, so the entry screen
 * shows the password in plain text while typing; this screen's own row masks it as
 * bullets once captured.
 */
class AccountScreen(
    sealedActivity: SealedLightActivity,
) : LightScreen<Unit, AccountViewModel>(sealedActivity) {

    override val viewModelClass: Class<AccountViewModel>
        get() = AccountViewModel::class.java

    override fun createViewModel() =
        AccountViewModel(AuthRepository(lightContext.dataStore), lightContext)

    @Composable
    override fun Content() {
        RemindersTheme {
            SwipeBackContainer(onSwipeBack = { goBack(null) }) {
            val authState by viewModel.authState.collectAsState()
            val email by viewModel.email.collectAsState()
            val password by viewModel.password.collectAsState()
            val error by viewModel.error.collectAsState()
            val isBusy by viewModel.isBusy.collectAsState()
            val lastSyncedAt by viewModel.lastSyncedAt.collectAsState()
            val isSyncing by viewModel.isSyncing.collectAsState()
            val syncFailed by viewModel.syncFailed.collectAsState()
            val syncOffline by viewModel.syncOffline.collectAsState()

            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .background(LightThemeTokens.colors.background),
            ) {
                LightTopBar(
                    leftButton = LightBarButton.LightIcon(LightIcons.BACK, onClick = { goBack(null) }),
                    center = LightTopBarCenter.Text("Account"),
                    rightButton = null,
                    modifier = Modifier.padding(bottom = 1f.gridUnitsAsDp()),
                )

                LightText(
                    text = "About Desktop Sync",
                    variant = LightTextVariant.Heading,
                    modifier = Modifier
                        .fillMaxWidth()
                        .lightClickable(onClick = { navigateTo(screenFactory = { AboutDesktopSyncScreen(it) }) })
                        .padding(
                            start = 1.5f.gridUnitsAsDp(),
                            top = 1f.gridUnitsAsDp(),
                            end = 1.5f.gridUnitsAsDp(),
                            // matches the email row's bottom margin (see SignedIn()) so
                            // the gap is consistent with the gap before "Last Synced".
                            bottom = 1.5f.gridUnitsAsDp(),
                        ),
                )

                when (val s = authState) {
                    is AuthState.SignedIn -> SignedIn(
                        email = s.email,
                        lastSyncedAt = lastSyncedAt,
                        isSyncing = isSyncing,
                        syncFailed = syncFailed,
                        syncOffline = syncOffline,
                        onSyncNow = { viewModel.syncNow() },
                        onSignOut = { viewModel.signOut() },
                        modifier = Modifier.weight(1f),
                    )

                    // loading folds into SignedOut instead of blanking the screen.
                    AuthState.Loading, AuthState.SignedOut -> {
                        TapField(
                            label = "Email",
                            value = email.ifEmpty { "Tap to enter" },
                            onClick = {
                                navigateTo(
                                    screenFactory = {
                                        TextEditorScreen(it, TextEditorRequest("Email", email, initialCaps = false))
                                    },
                                    resultCallback = { viewModel.setEmail(it) },
                                )
                            },
                        )
                        TapField(
                            label = "Password",
                            // own row masks the captured value, entry screen itself still
                            // shows it in the clear while typing (see class doc).
                            value = if (password.isEmpty()) "Tap to enter" else "•".repeat(password.length),
                            onClick = {
                                navigateTo(
                                    screenFactory = {
                                        TextEditorScreen(it, TextEditorRequest("Password", password, initialCaps = false))
                                    },
                                    resultCallback = { viewModel.setPassword(it) },
                                )
                            },
                        )
                        if (error != null) {
                            LightText(
                                text = error ?: "",
                                variant = LightTextVariant.Detail,
                                modifier = Modifier.padding(horizontal = 1.5f.gridUnitsAsDp(), vertical = 0.5f.gridUnitsAsDp()),
                            )
                        }
                        if (email.isNotBlank() && password.isNotBlank()) {
                            LightText(
                                text = if (isBusy) "SIGNING IN…" else "SIGN IN",
                                variant = LightTextVariant.Button,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .lightClickable(enabled = !isBusy) { viewModel.signIn() }
                                    .padding(horizontal = 1.5f.gridUnitsAsDp(), vertical = 1f.gridUnitsAsDp()),
                            )
                        }
                    }
                }
            }
            }
        }
    }

    @Composable
    private fun SignedIn(
        email: String,
        lastSyncedAt: Long?,
        isSyncing: Boolean,
        syncFailed: Boolean,
        syncOffline: Boolean,
        onSyncNow: () -> Unit,
        onSignOut: () -> Unit,
        modifier: Modifier = Modifier,
    ) {
        Column(modifier = modifier.fillMaxWidth()) {
            Column(modifier = Modifier.weight(1f)) {
                LightText(
                    text = "Signed in",
                    variant = LightTextVariant.Detail,
                    modifier = Modifier.padding(horizontal = 1.5f.gridUnitsAsDp()),
                )
                LightText(
                    text = email,
                    // Copy, not Heading, long email addresses need to fit on one line.
                    variant = LightTextVariant.Copy,
                    modifier = Modifier.padding(
                        start = 1.5f.gridUnitsAsDp(),
                        top = 0.25f.gridUnitsAsDp(),
                        end = 1.5f.gridUnitsAsDp(),
                        bottom = 1.5f.gridUnitsAsDp(),
                    ),
                )
                TapField(
                    label = "Last Synced",
                    value = when {
                        isSyncing -> "Syncing…"
                        syncOffline -> "Device offline. Connect to a network and tap to try again"
                        syncFailed -> "Error. Tap to try again"
                        lastSyncedAt != null -> formatLastSyncedAt(lastSyncedAt)
                        else -> "Never, tap to sync now"
                    },
                    onClick = onSyncNow,
                    singleLine = false,
                )
            }
            // pinned to bottom and centered, same shape as ConfirmScreen's confirm
            // button. not LightBottomBar, its Text variant forces Fine-variant styling
            // which would regress this button's look.
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 1.8f.gridUnitsAsDp()),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                LightText(
                    text = "SIGN OUT",
                    variant = LightTextVariant.Button,
                    modifier = Modifier.lightClickable(onClick = onSignOut),
                )
            }
        }
    }
}
