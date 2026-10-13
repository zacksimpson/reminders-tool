package com.zacksimpson.reminders

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.lifecycle.viewModelScope
import com.thelightphone.sdk.InitialScreen
import com.thelightphone.sdk.LightScreen
import com.thelightphone.sdk.LightViewModel
import com.thelightphone.sdk.LightWork
import com.thelightphone.sdk.SealedLightActivity
import com.thelightphone.sdk.SimpleLightScreen
import com.thelightphone.sdk.ui.LightBarButton
import com.thelightphone.sdk.ui.LightBottomBar
import com.thelightphone.sdk.ui.LightIcons
import com.thelightphone.sdk.ui.LightThemeTokens
import com.zacksimpson.reminders.data.AuthRepository
import com.zacksimpson.reminders.data.AuthState
import com.zacksimpson.reminders.data.RemindersRepository
import com.zacksimpson.reminders.data.SYNC_JOB_KEY
import com.zacksimpson.reminders.data.SYNC_NOW_TAG
import com.zacksimpson.reminders.data.authStateIn
import com.zacksimpson.reminders.screens.AccountScreen
import com.zacksimpson.reminders.screens.AddTaskScreen
import com.zacksimpson.reminders.screens.ListAction
import com.zacksimpson.reminders.screens.ListActionsScreen
import com.zacksimpson.reminders.screens.ListDetailScreen
import com.zacksimpson.reminders.screens.ListsTab
import com.zacksimpson.reminders.screens.NotificationsScreen
import com.zacksimpson.reminders.screens.SettingsTab
import com.zacksimpson.reminders.screens.TaskAction
import com.zacksimpson.reminders.screens.TaskActionsScreen
import com.zacksimpson.reminders.screens.TaskBehaviorsScreen
import com.zacksimpson.reminders.screens.TaskDetailScreen
import com.zacksimpson.reminders.screens.TodayTab
import com.zacksimpson.reminders.ui.RemindersTheme
import com.zacksimpson.reminders.ui.TextEditorRequest
import com.zacksimpson.reminders.ui.TextEditorScreen
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch
import java.time.LocalDate
import kotlin.time.Duration.Companion.minutes

enum class Tab { LISTS, TODAY, SETTINGS }

class MainViewModel(
    private val repo: RemindersRepository,
    private val authRepo: AuthRepository,
) : LightViewModel<Unit>() {
    val selectedTab = MutableStateFlow(Tab.LISTS)
    val state = repo.dataStateIn(viewModelScope)
    val authState = authRepo.authStateIn(viewModelScope)

    /** forces the Today tab's date/overdue math to re-run: once a minute while visible,
     *  and immediately whenever this screen is (re)shown (e.g. app resumed from
     *  background overnight). */
    val refreshTick = MutableStateFlow(0)

    // lives here rather than as Composable remember state: Content() gets recomposed
    // fresh whenever a pushed screen pops back to it, which discards remember-based
    // state. the ViewModel survives that round trip.
    val todayShowCompleted = MutableStateFlow(false)

    // same reasoning as todayShowCompleted.
    val listsReordering = MutableStateFlow(false)

    init {
        viewModelScope.launch {
            while (true) {
                delay(60_000)
                refreshTick.value++
            }
        }
    }

    override fun onScreenShow(screen: SimpleLightScreen<Unit>) {
        super.onScreenShow(screen)
        refreshTick.value++
    }

    fun select(tab: Tab) {
        selectedTab.value = tab
    }

    fun addList(title: String) {
        viewModelScope.launch { repo.addList(title) }
    }

    fun toggleTask(id: String) {
        viewModelScope.launch { repo.toggleTask(id) }
    }

    fun toggleTodayShowCompleted() {
        todayShowCompleted.value = !todayShowCompleted.value
    }

    fun startListsReordering() {
        listsReordering.value = true
    }

    fun stopListsReordering() {
        listsReordering.value = false
    }

    fun moveListUp(id: String) {
        viewModelScope.launch { repo.moveListUp(id) }
    }

    fun moveListDown(id: String) {
        viewModelScope.launch { repo.moveListDown(id) }
    }

    override fun onCleared() {
        authRepo.close()
    }
}

/** boot screen: the four-tab host, Lists, Today, Settings, and the Add action. */
@InitialScreen
class MainScreen(sealedActivity: SealedLightActivity) :
    LightScreen<Unit, MainViewModel>(sealedActivity) {

    override val viewModelClass: Class<MainViewModel>
        get() = MainViewModel::class.java

    override fun createViewModel() = MainViewModel(
        RemindersRepository(lightContext.dataStore),
        AuthRepository(lightContext.dataStore),
    )

    // scheduling lives here, on the Screen, not in MainViewModel: a SealedLightContext
    // is only reachable via LightScreen's protected lightContext. the periodic sync only
    // exists while signed in; signing out cancels it. the one-shot poke is guarded to once
    // per process since this re-runs on every return to MainScreen. enqueuePeriodic stays
    // unguarded; its UPDATE policy is idempotent by design.
    private fun updateSyncSchedule(auth: AuthState) {
        when (auth) {
            is AuthState.SignedIn -> {
                LightWork.enqueuePeriodic(lightContext, SYNC_JOB_KEY, repeatInterval = 15.minutes)
                if (!hasPokedSyncOnLaunch) {
                    hasPokedSyncOnLaunch = true
                    LightWork.enqueue(lightContext, SYNC_JOB_KEY, tag = SYNC_NOW_TAG)
                }
            }
            AuthState.SignedOut -> LightWork.cancel(lightContext, SYNC_JOB_KEY)
            AuthState.Loading -> Unit
        }
    }

    private companion object {
        var hasPokedSyncOnLaunch = false
    }

    @Composable
    override fun Content() {
        RemindersTheme {
            val authState by viewModel.authState.collectAsState()
            LaunchedEffect(authState) { updateSyncSchedule(authState) }

            val tab by viewModel.selectedTab.collectAsState()
            val dataState by viewModel.state.collectAsState()
            val refreshTick by viewModel.refreshTick.collectAsState()
            val todayShowCompleted by viewModel.todayShowCompleted.collectAsState()
            val listsReordering by viewModel.listsReordering.collectAsState()
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .background(LightThemeTokens.colors.background),
            ) {
                Box(modifier = Modifier.weight(1f).fillMaxWidth()) {
                    when (tab) {
                        Tab.LISTS -> ListsTab(
                            state = dataState,
                            isReordering = listsReordering,
                            onAddList = {
                                navigateTo(
                                    screenFactory = { TextEditorScreen(it, TextEditorRequest("New list")) },
                                    resultCallback = { name ->
                                        name.trim().takeIf(String::isNotEmpty)?.let(viewModel::addList)
                                    },
                                )
                            },
                            onOpenList = { list ->
                                val data = (viewModel.state.value as? DataState.Ready)?.data
                                navigateTo(screenFactory = { ListDetailScreen(it, list.id, list.title, initialData = data) })
                            },
                            onLongPressList = { list ->
                                navigateTo(
                                    screenFactory = { ListActionsScreen(it, list.id) },
                                    resultCallback = { result ->
                                        when (result) {
                                            ListAction.START_REORDER -> viewModel.startListsReordering()
                                        }
                                    },
                                )
                            },
                            onStopReordering = { viewModel.stopListsReordering() },
                            onMoveListUp = { viewModel.moveListUp(it) },
                            onMoveListDown = { viewModel.moveListDown(it) },
                        )

                        Tab.TODAY -> TodayTab(
                            state = dataState,
                            showOverdue = (dataState as? DataState.Ready)?.data?.settings?.showOverdue ?: true,
                            refreshTick = refreshTick,
                            showCompleted = todayShowCompleted,
                            onToggleShowCompleted = { viewModel.toggleTodayShowCompleted() },
                            onAddTask = {
                                val data = (viewModel.state.value as? DataState.Ready)?.data
                                val defaultListId = data?.settings?.defaultListId ?: "inbox"
                                navigateTo(
                                    screenFactory = {
                                        AddTaskScreen(it, defaultListId, LocalDate.now().toString(), initialData = data)
                                    },
                                )
                            },
                            onOpenTask = { task ->
                                val data = (viewModel.state.value as? DataState.Ready)?.data
                                navigateTo(screenFactory = { TaskDetailScreen(it, task.id, initialData = data) })
                            },
                            onLongPressTask = { task ->
                                val actionsData = (viewModel.state.value as? DataState.Ready)?.data
                                navigateTo(
                                    screenFactory = { TaskActionsScreen(it, task.id, actionsData) },
                                    // TaskActionsScreen already shows the "deleted" toast
                                    // itself before returning.
                                    resultCallback = { result ->
                                        when (result) {
                                            TaskAction.DELETED -> Unit
                                            // reordering only makes sense within a single list, so
                                            // Today pushes that task's List Detail screen already
                                            // in reorder mode; a back-press lands back on Today.
                                            TaskAction.START_REORDER -> {
                                                val data = (viewModel.state.value as? DataState.Ready)?.data
                                                val listTitle = data?.lists?.firstOrNull { it.id == task.listId }?.title ?: "List"
                                                navigateTo(
                                                    screenFactory = {
                                                        ListDetailScreen(
                                                            it,
                                                            task.listId,
                                                            listTitle,
                                                            startInReorderMode = true,
                                                            initialData = data,
                                                        )
                                                    },
                                                )
                                            }
                                        }
                                    },
                                )
                            },
                            onToggle = { viewModel.toggleTask(it) },
                        )
                        Tab.SETTINGS -> SettingsTab(
                            state = dataState,
                            onOpenTaskBehaviors = {
                                val data = (viewModel.state.value as? DataState.Ready)?.data
                                navigateTo(screenFactory = { TaskBehaviorsScreen(it, data) })
                            },
                            onOpenAccount = {
                                navigateTo(screenFactory = { AccountScreen(it) })
                            },
                            onOpenNotifications = {
                                navigateTo(screenFactory = { NotificationsScreen(it) })
                            },
                        )
                    }
                }
                LightBottomBar(
                    items = listOf(
                        LightBarButton.LightIcon(LightIcons.LIST, onClick = { viewModel.select(Tab.LISTS) }),
                        LightBarButton.Icon(
                            painterResource(R.drawable.ic_today),
                            onClick = { viewModel.select(Tab.TODAY) },
                            sizeUnits = 1.9f,
                        ),
                        // Add is an action, not a tab, it opens the New Task screen.
                        LightBarButton.LightIcon(LightIcons.ADD, onClick = {
                            val data = (viewModel.state.value as? DataState.Ready)?.data
                            val defaultListId = data?.settings?.defaultListId ?: "inbox"
                            navigateTo(screenFactory = { AddTaskScreen(it, defaultListId, initialData = data) })
                        }),
                        LightBarButton.LightIcon(LightIcons.SETTINGS, onClick = { viewModel.select(Tab.SETTINGS) }),
                    ),
                )
            }
        }
    }
}
