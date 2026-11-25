package com.zacksimpson.reminders.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewModelScope
import com.thelightphone.sdk.LightScreen
import com.thelightphone.sdk.LightViewModel
import com.thelightphone.sdk.SealedLightActivity
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
import com.zacksimpson.reminders.DataState
import com.zacksimpson.reminders.data.AddPosition
import com.zacksimpson.reminders.data.AfterAddBehavior
import com.zacksimpson.reminders.data.AppData
import com.zacksimpson.reminders.data.ReminderList
import com.zacksimpson.reminders.data.RemindersLogic
import com.zacksimpson.reminders.data.RemindersRepository
import com.zacksimpson.reminders.data.Settings
import com.zacksimpson.reminders.dataStateIn
import com.zacksimpson.reminders.ui.RemindersTheme
import com.zacksimpson.reminders.ui.SwipeBackContainer
import kotlinx.coroutines.launch

val AFTER_ADD_OPTIONS = listOf(
    PickerOption("toast", "Add Next"),
    PickerOption("go-to-list", "Go to List"),
)
val ADD_POSITION_OPTIONS = listOf(
    PickerOption("top", "Top of List"),
    PickerOption("bottom", "Bottom of List"),
)

val TIME_FORMAT_OPTIONS = listOf(
    PickerOption("12", "Standard (AM/PM)"),
    PickerOption("24", "24-Hour"),
)

fun timeFormatKey(use24Hour: Boolean) = if (use24Hour) "24" else "12"

fun afterAddKey(v: AfterAddBehavior) = if (v == AfterAddBehavior.GO_TO_LIST) "go-to-list" else "toast"
fun addPositionKey(v: AddPosition) = if (v == AddPosition.TOP) "top" else "bottom"

private fun afterAddLabel(v: AfterAddBehavior) = AFTER_ADD_OPTIONS.first { it.key == afterAddKey(v) }.label
private fun addPositionLabel(v: AddPosition) = ADD_POSITION_OPTIONS.first { it.key == addPositionKey(v) }.label

class TaskBehaviorsViewModel(
    private val repo: RemindersRepository,
    initialData: AppData?,
) : LightViewModel<Unit>() {
    val state = repo.dataStateIn(viewModelScope, initialData?.let { DataState.Ready(it) } ?: DataState.Loading)

    fun setDefaultList(id: String) = update { it.copy(defaultListId = id) }

    fun setAfterAdd(key: String) = update {
        it.copy(afterAddBehavior = if (key == "go-to-list") AfterAddBehavior.GO_TO_LIST else AfterAddBehavior.TOAST)
    }

    fun setAddPosition(key: String) = update {
        it.copy(addPosition = if (key == "top") AddPosition.TOP else AddPosition.BOTTOM)
    }

    private fun update(transform: (Settings) -> Settings) {
        viewModelScope.launch { repo.updateSettings(transform) }
    }
}

/**
 * Today View / Default List / After Quick Add / Add New Tasks, folded under one parent
 * settings screen.
 */
class TaskBehaviorsScreen(
    sealedActivity: SealedLightActivity,
    private val initialData: AppData? = null,
) : LightScreen<Unit, TaskBehaviorsViewModel>(sealedActivity) {

    override val viewModelClass: Class<TaskBehaviorsViewModel>
        get() = TaskBehaviorsViewModel::class.java

    override fun createViewModel() =
        TaskBehaviorsViewModel(
            RemindersRepository(lightContext.dataStore),
            initialData,
        )

    @Composable
    override fun Content() {
        RemindersTheme {
            SwipeBackContainer(onSwipeBack = { goBack(null) }) {
            val state by viewModel.state.collectAsState()

            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .background(LightThemeTokens.colors.background),
            ) {
                LightTopBar(
                    leftButton = LightBarButton.LightIcon(LightIcons.BACK, onClick = { goBack(null) }),
                    center = LightTopBarCenter.Text("Task Behaviors"),
                    rightButton = null,
                    modifier = Modifier.padding(bottom = 1f.gridUnitsAsDp()),
                )

                val corrupt = state as? DataState.Corrupt
                if (corrupt != null) {
                    LightText(
                        text = corrupt.message,
                        variant = LightTextVariant.Copy,
                        modifier = Modifier.padding(horizontal = 1.5f.gridUnitsAsDp()),
                    )
                } else {
                    // defaults instead of blanking while Loading, same as TodayViewScreen.
                    val ready = state as? DataState.Ready
                    val settings = ready?.data?.settings
                    val lists = ready?.data?.lists.orEmpty()
                    val defaultTitle = lists.firstOrNull { it.id == settings?.defaultListId }?.title ?: "Inbox"
                    LightScrollView(
                        modifier = Modifier.fillMaxSize(),
                    ) {
                        LinkRow("Today View") {
                            navigateTo(screenFactory = { TodayViewScreen(it) })
                        }
                        ValueRow("Default List", defaultTitle) {
                            (viewModel.state.value as? DataState.Ready)?.data?.let { d ->
                                navigateTo(
                                    screenFactory = { activity ->
                                        OptionPickerScreen(
                                            activity,
                                            "Default List",
                                            RemindersLogic.applyOrder(d.lists, ReminderList::id, d.settings.listOrder) { it.order }
                                                .map { PickerOption(it.id, it.title) },
                                            d.settings.defaultListId,
                                        )
                                    },
                                    resultCallback = { key -> viewModel.setDefaultList(key) },
                                )
                            }
                        }
                        ValueRow("After Quick Add", settings?.let { afterAddLabel(it.afterAddBehavior) } ?: "Add Next") {
                            (viewModel.state.value as? DataState.Ready)?.data?.let { d ->
                                navigateTo(
                                    screenFactory = { activity ->
                                        OptionPickerScreen(
                                            activity,
                                            "After Quick Add",
                                            AFTER_ADD_OPTIONS,
                                            afterAddKey(d.settings.afterAddBehavior),
                                        )
                                    },
                                    resultCallback = { key -> viewModel.setAfterAdd(key) },
                                )
                            }
                        }
                        ValueRow("Add New Tasks", settings?.let { addPositionLabel(it.addPosition) } ?: "Bottom of List") {
                            (viewModel.state.value as? DataState.Ready)?.data?.let { d ->
                                navigateTo(
                                    screenFactory = { activity ->
                                        OptionPickerScreen(
                                            activity,
                                            "Add New Tasks",
                                            ADD_POSITION_OPTIONS,
                                            addPositionKey(d.settings.addPosition),
                                        )
                                    },
                                    resultCallback = { key -> viewModel.setAddPosition(key) },
                                )
                            }
                        }
                    }
                }
            }
            }
        }
    }
}

@Composable
private fun ValueRow(label: String, value: String, onClick: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .lightClickable(onClick = onClick)
            .padding(start = 1.5f.gridUnitsAsDp(), top = 1f.gridUnitsAsDp(), bottom = 1f.gridUnitsAsDp()),
    ) {
        LightText(text = label, variant = LightTextVariant.Detail)
        LightText(text = value, variant = LightTextVariant.Heading)
    }
}

@Composable
private fun LinkRow(label: String, onClick: () -> Unit) {
    LightText(
        text = label,
        variant = LightTextVariant.Heading,
        modifier = Modifier
            .fillMaxWidth()
            .lightClickable(onClick = onClick)
            .padding(start = 1.5f.gridUnitsAsDp(), top = 1f.gridUnitsAsDp(), bottom = 1f.gridUnitsAsDp()),
    )
}
