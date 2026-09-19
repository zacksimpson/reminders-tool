package com.zacksimpson.reminders.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
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
import com.thelightphone.sdk.LightScreen
import com.thelightphone.sdk.LightViewModel
import com.thelightphone.sdk.SealedLightActivity
import com.thelightphone.sdk.ui.LightBarButton
import com.thelightphone.sdk.ui.LightIcon
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
import com.zacksimpson.reminders.data.AfterAddBehavior
import com.zacksimpson.reminders.data.AppData
import com.zacksimpson.reminders.data.Recurrence
import com.zacksimpson.reminders.data.ReminderList
import com.zacksimpson.reminders.data.RemindersLogic
import com.zacksimpson.reminders.data.RemindersRepository
import com.zacksimpson.reminders.data.Subtask
import com.zacksimpson.reminders.data.formatDisplayDate
import com.zacksimpson.reminders.data.formatRecurrence
import com.zacksimpson.reminders.data.formatTime
import com.zacksimpson.reminders.data.generateId
import com.zacksimpson.reminders.dataStateIn
import com.zacksimpson.reminders.ui.ClearableField
import com.zacksimpson.reminders.ui.RemindersTheme
import com.zacksimpson.reminders.ui.SubtaskMode
import com.zacksimpson.reminders.ui.SubtasksSection
import com.zacksimpson.reminders.ui.SwipeBackContainer
import com.zacksimpson.reminders.ui.TapField
import com.zacksimpson.reminders.ui.TextEditorRequest
import com.zacksimpson.reminders.ui.TextEditorScreen
import com.zacksimpson.reminders.ui.TitleField
import com.zacksimpson.reminders.ui.ToastScreen
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch

class AddTaskViewModel(
    private val repo: RemindersRepository,
    defaultListId: String,
    private val defaultDate: String?,
    initialData: AppData?,
) : LightViewModel<Unit>() {
    val title = MutableStateFlow("")
    val selectedListId = MutableStateFlow(defaultListId)
    val date = MutableStateFlow(defaultDate)
    val time = MutableStateFlow<String?>(null)
    val recurrence = MutableStateFlow<Recurrence?>(null)
    val subtasks = MutableStateFlow<List<Subtask>>(emptyList())
    val subtaskMode = MutableStateFlow(SubtaskMode.NORMAL)
    val revealedSubtaskId = MutableStateFlow<String?>(null)
    val state = repo.dataStateIn(viewModelScope, initialData?.let { DataState.Ready(it) } ?: DataState.Loading)

    fun setTitle(value: String) {
        title.value = value
    }

    fun setListId(id: String) {
        selectedListId.value = id
    }

    fun setDate(value: String) {
        date.value = value
    }

    fun clearDate() {
        date.value = null
        time.value = null
        recurrence.value = null
    }

    fun setTime(value: String) {
        time.value = value
    }

    fun clearTime() {
        time.value = null
    }

    fun setRecurrence(value: Recurrence) {
        recurrence.value = value
    }

    fun clearRecurrence() {
        recurrence.value = null
    }

    fun addSubtask(text: String) {
        val t = text.trim()
        if (t.isEmpty()) return
        subtasks.value = subtasks.value + Subtask(generateId(), t, completed = false, createdAt = System.currentTimeMillis())
    }

    fun renameSubtask(id: String, text: String) {
        val t = text.trim()
        if (t.isEmpty()) return
        subtasks.value = subtasks.value.map { if (it.id == id) it.copy(title = t) else it }
    }

    fun toggleSubtask(id: String) {
        subtasks.value = subtasks.value.map { if (it.id == id) it.copy(completed = !it.completed) else it }
    }

    fun removeSubtask(id: String) {
        subtasks.value = subtasks.value.filter { it.id != id }
    }

    fun moveSubtask(id: String, delta: Int) {
        subtasks.value = RemindersLogic.moveSubtask(subtasks.value, id, delta)
    }

    fun save(onSaved: () -> Unit) {
        val t = title.value.trim()
        if (t.isEmpty()) return
        viewModelScope.launch {
            repo.addTask(
                title = t,
                listId = selectedListId.value,
                date = date.value,
                time = time.value,
                recurrence = recurrence.value,
                subtasks = subtasks.value,
            )
            onSaved()
        }
    }

    /** clears the form for another quick add, keeps the selected list. */
    fun resetForNextAdd() {
        title.value = ""
        date.value = defaultDate
        time.value = null
        recurrence.value = null
        subtasks.value = emptyList()
        subtaskMode.value = SubtaskMode.NORMAL
        revealedSubtaskId.value = null
    }
}

/** new-task form: Title, List, Date, Time, Recurring, Subtasks. Time/Recurring only
 *  appear once a Date is set. */
class AddTaskScreen(
    sealedActivity: SealedLightActivity,
    private val defaultListId: String,
    private val defaultDate: String? = null,
    private val initialData: AppData? = null,
    // false when opened from inside a list's own "+", you're already looking at that
    // list so After Quick Add doesn't apply, just toast and dismiss back to it.
    private val honorAfterAddBehavior: Boolean = true,
    // true for the Today tab's "+" and the bottom-bar global "+": plain title-only top
    // bar, no swipe-back, bottom footer with a centered ✕ and a right-aligned SAVE,
    // instead of the top-bar back-chevron + checkmark used when opened from inside a
    // list's own "+".
    private val isModal: Boolean = true,
) : LightScreen<Unit, AddTaskViewModel>(sealedActivity) {

    override val viewModelClass: Class<AddTaskViewModel>
        get() = AddTaskViewModel::class.java

    override fun createViewModel() =
        AddTaskViewModel(RemindersRepository(lightContext.dataStore), defaultListId, defaultDate, initialData)

    @Composable
    override fun Content() {
        RemindersTheme {
            val title by viewModel.title.collectAsState()
            val listId by viewModel.selectedListId.collectAsState()
            val date by viewModel.date.collectAsState()
            val time by viewModel.time.collectAsState()
            val recurrence by viewModel.recurrence.collectAsState()
            val subtasks by viewModel.subtasks.collectAsState()
            val subtaskMode by viewModel.subtaskMode.collectAsState()
            val revealedSubtaskId by viewModel.revealedSubtaskId.collectAsState()
            val state by viewModel.state.collectAsState()
            val lists = (state as? DataState.Ready)?.data?.lists.orEmpty()
            val listOrder = (state as? DataState.Ready)?.data?.settings?.listOrder
            val selectedListTitle = lists.firstOrNull { it.id == listId }?.title ?: "Inbox"

            val onSave: () -> Unit = {
                viewModel.save {
                    val d = (viewModel.state.value as? DataState.Ready)?.data
                    if (honorAfterAddBehavior && d?.settings?.afterAddBehavior == AfterAddBehavior.GO_TO_LIST) {
                        goBack(null)
                        navigateTo(screenFactory = { ListDetailScreen(it, listId, selectedListTitle, initialData = d) })
                    } else {
                        navigateTo(
                            screenFactory = { ToastScreen(it, "added") },
                            resultCallback = {
                                if (honorAfterAddBehavior) viewModel.resetForNextAdd() else goBack(null)
                            },
                        )
                    }
                }
            }

            val screenContent: @Composable () -> Unit = {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .background(LightThemeTokens.colors.background),
            ) {
                LightTopBar(
                    leftButton = if (isModal) null else LightBarButton.LightIcon(LightIcons.BACK, onClick = { goBack(null) }),
                    center = LightTopBarCenter.Text("New Task"),
                    rightButton = if (subtaskMode == SubtaskMode.REORDER) {
                        LightBarButton.Text("DONE", onClick = { viewModel.subtaskMode.value = SubtaskMode.NORMAL })
                    } else if (!isModal && title.isNotBlank()) {
                        // ACCEPT's artwork fills its box edge-to-edge, unlike BACK's,
                        // sized down to match BACK's visual weight.
                        LightBarButton.LightIcon(LightIcons.ACCEPT, onClick = onSave, sizeUnits = 1.5f)
                    } else {
                        null
                    },
                    modifier = Modifier.padding(bottom = 1f.gridUnitsAsDp()),
                )

                LightScrollView(
                    modifier = Modifier.weight(1f).fillMaxWidth(),
                ) {
                    TitleField(
                        value = title,
                        placeholder = "Task name",
                        onClick = {
                            navigateTo(
                                screenFactory = { TextEditorScreen(it, TextEditorRequest("Task name", title)) },
                                resultCallback = { viewModel.setTitle(it) },
                            )
                        },
                    )

                    TapField(
                        label = "List",
                        value = selectedListTitle,
                        onClick = {
                            navigateTo(
                                screenFactory = { activity ->
                                    OptionPickerScreen(
                                        activity,
                                        "List",
                                        RemindersLogic.applyOrder(lists, ReminderList::id, listOrder) { it.order }
                                            .map { PickerOption(it.id, it.title) },
                                        listId,
                                    )
                                },
                                resultCallback = { key -> viewModel.setListId(key) },
                            )
                        },
                    )

                    ClearableField(
                        label = "Date",
                        value = date?.let(::formatDisplayDate),
                        onClick = {
                            navigateTo(
                                screenFactory = { DatePickerScreen(it, date) },
                                resultCallback = { result -> result?.let { viewModel.setDate(it) } },
                            )
                        },
                        onClear = { viewModel.clearDate() },
                    )
                    if (date != null) {
                        ClearableField(
                            label = "Time",
                            value = time?.let { formatTime(it) },
                            onClick = {
                                navigateTo(
                                    screenFactory = { TimePickerScreen(it, time) },
                                    resultCallback = { result -> result?.let { viewModel.setTime(it) } },
                                )
                            },
                            onClear = { viewModel.clearTime() },
                        )
                        ClearableField(
                            label = "Recurring",
                            value = recurrence?.let(::formatRecurrence),
                            onClick = {
                                navigateTo(
                                    screenFactory = { RecurrencePickerScreen(it, recurrence) },
                                    resultCallback = { result -> result?.let { viewModel.setRecurrence(it) } },
                                )
                            },
                            onClear = { viewModel.clearRecurrence() },
                        )
                    }

                    SubtasksSection(
                        subtasks = subtasks,
                        onAdd = {
                            navigateTo(
                                screenFactory = { TextEditorScreen(it, TextEditorRequest("Subtask")) },
                                resultCallback = { text -> viewModel.addSubtask(text) },
                            )
                        },
                        onRename = { subtask ->
                            navigateTo(
                                screenFactory = { TextEditorScreen(it, TextEditorRequest("Subtask", subtask.title)) },
                                resultCallback = { text -> viewModel.renameSubtask(subtask.id, text) },
                            )
                        },
                        onToggle = { viewModel.toggleSubtask(it) },
                        onDelete = { viewModel.removeSubtask(it) },
                        mode = subtaskMode,
                        onModeChange = { viewModel.subtaskMode.value = it },
                        revealedId = revealedSubtaskId,
                        onRevealChange = { viewModel.revealedSubtaskId.value = it },
                        onMove = { id, delta -> viewModel.moveSubtask(id, delta) },
                    )
                }

                // modal-only footer: centered ✕ dismiss, right-aligned SAVE (non-modal
                // uses the top-bar back-chevron + checkmark instead).
                if (isModal) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 1f.gridUnitsAsDp()),
                    ) {
                        LightIcon(
                            // 2.2f (TimePickerScreen's dismiss size) was tuned against
                            // that screen's 48px numpad digits, too heavy paired with
                            // SAVE's small Button-variant text here.
                            icon = LightIcons.CLOSE,
                            size = 1.5f,
                            modifier = Modifier
                                .align(Alignment.Center)
                                .lightClickable { goBack(null) },
                        )
                        LightText(
                            text = "SAVE",
                            variant = LightTextVariant.Button,
                            modifier = Modifier
                                .align(Alignment.CenterEnd)
                                .padding(end = 2f.gridUnitsAsDp())
                                .lightClickable(onClick = onSave),
                        )
                    }
                }
            }
            }

            if (isModal) {
                screenContent()
            } else {
                SwipeBackContainer(onSwipeBack = { goBack(null) }) { screenContent() }
            }
        }
    }
}
