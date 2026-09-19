package com.zacksimpson.reminders.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
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
import com.thelightphone.sdk.ui.verticalGridUnitsAsDp
import com.zacksimpson.reminders.DataState
import com.zacksimpson.reminders.data.AppData
import com.zacksimpson.reminders.data.ReminderList
import com.zacksimpson.reminders.data.RemindersLogic
import com.zacksimpson.reminders.data.RemindersRepository
import com.zacksimpson.reminders.data.Recurrence
import com.zacksimpson.reminders.data.Task
import com.zacksimpson.reminders.data.formatDisplayDate
import com.zacksimpson.reminders.data.formatRecurrence
import com.zacksimpson.reminders.data.formatTime
import com.zacksimpson.reminders.dataStateIn
import com.zacksimpson.reminders.ui.ClearableField
import com.zacksimpson.reminders.ui.ConfirmScreen
import com.zacksimpson.reminders.ui.RemindersTheme
import com.zacksimpson.reminders.ui.SubtasksSection
import com.zacksimpson.reminders.ui.SwipeBackContainer
import com.zacksimpson.reminders.ui.TapField
import com.zacksimpson.reminders.ui.TextEditorRequest
import com.zacksimpson.reminders.ui.TextEditorScreen
import com.zacksimpson.reminders.ui.TitleField
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

class TaskDetailViewModel(
    private val repo: RemindersRepository,
    private val taskId: String,
    initialData: AppData?,
) : LightViewModel<Unit>() {
    val title = MutableStateFlow("")
    val selectedListId = MutableStateFlow("")
    val date = MutableStateFlow<String?>(null)
    val time = MutableStateFlow<String?>(null)
    val recurrence = MutableStateFlow<Recurrence?>(null)
    val seeded = MutableStateFlow(false)
    val isReordering = MutableStateFlow(false)
    val notFound = MutableStateFlow(false)
    val state = repo.dataStateIn(viewModelScope, initialData?.let { DataState.Ready(it) } ?: DataState.Loading)

    init {
        // draft fields are seeded once from the task's state at open time, then evolve
        // independently until Save. subtasks are not drafted, they read/write live.
        viewModelScope.launch {
            val first = state.first { it !is DataState.Loading }
            val task = (first as? DataState.Ready)?.data?.tasks?.firstOrNull { it.id == taskId }
            if (task == null) {
                notFound.value = true
            } else {
                title.value = task.title
                selectedListId.value = task.listId
                date.value = task.date
                time.value = task.time
                recurrence.value = task.recurrence
            }
            seeded.value = true
        }
    }

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

    fun save(onSaved: () -> Unit) {
        val t = title.value.trim()
        if (t.isEmpty()) return
        viewModelScope.launch {
            repo.updateTask(taskId) {
                it.copy(
                    title = t,
                    listId = selectedListId.value,
                    date = date.value,
                    time = time.value,
                    recurrence = recurrence.value,
                )
            }
            onSaved()
        }
    }

    fun delete(onDeleted: () -> Unit) {
        viewModelScope.launch {
            repo.deleteTask(taskId)
            onDeleted()
        }
    }

    // subtask mutations are immediate/live, the task already exists so there's no
    // "draft" to hold them in (unlike Add Task, which is creating a brand-new task).
    fun addSubtask(text: String) {
        val t = text.trim()
        if (t.isEmpty()) return
        viewModelScope.launch { repo.addSubtask(taskId, t) }
    }

    fun renameSubtask(id: String, text: String) {
        val t = text.trim()
        if (t.isEmpty()) return
        viewModelScope.launch {
            repo.updateTask(taskId) { task ->
                task.copy(subtasks = task.subtasks.map { if (it.id == id) it.copy(title = t) else it })
            }
        }
    }

    fun toggleSubtask(id: String) {
        viewModelScope.launch { repo.toggleSubtask(taskId, id) }
    }

    fun removeSubtask(id: String) {
        viewModelScope.launch { repo.deleteSubtask(taskId, id) }
    }

    fun moveSubtask(id: String, delta: Int) {
        viewModelScope.launch { repo.moveSubtask(taskId, id, delta) }
    }
}

/**
 * full task edit screen: title, list, date/time/recurring, subtasks, delete.
 *
 * Save is an explicit checkmark tap, not auto-save-on-back: the SDK's system back gesture
 * calls goBack() directly with no hook to save first, matches the explicit-Save pattern
 * already used on Add Task.
 */
class TaskDetailScreen(
    sealedActivity: SealedLightActivity,
    private val taskId: String,
    private val initialData: AppData? = null,
) : LightScreen<Unit, TaskDetailViewModel>(sealedActivity) {

    override val viewModelClass: Class<TaskDetailViewModel>
        get() = TaskDetailViewModel::class.java

    override fun createViewModel() =
        TaskDetailViewModel(RemindersRepository(lightContext.dataStore), taskId, initialData)

    @Composable
    override fun Content() {
        RemindersTheme {
            val seeded by viewModel.seeded.collectAsState()
            val isReordering by viewModel.isReordering.collectAsState()
            val notFound by viewModel.notFound.collectAsState()
            val title by viewModel.title.collectAsState()
            val listId by viewModel.selectedListId.collectAsState()
            val date by viewModel.date.collectAsState()
            val time by viewModel.time.collectAsState()
            val recurrence by viewModel.recurrence.collectAsState()
            val state by viewModel.state.collectAsState()

            val ready = state as? DataState.Ready
            val liveTask = ready?.data?.tasks?.firstOrNull { it.id == taskId }
            val lists = ready?.data?.lists.orEmpty()
            val listOrder = ready?.data?.settings?.listOrder
            val selectedListTitle = lists.firstOrNull { it.id == listId }?.title ?: "Inbox"

            SwipeBackContainer(onSwipeBack = { goBack(null) }) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .background(LightThemeTokens.colors.background),
            ) {
                LightTopBar(
                    leftButton = LightBarButton.LightIcon(LightIcons.BACK, onClick = { goBack(null) }),
                    center = LightTopBarCenter.Text("Edit"),
                    // ACCEPT's artwork fills its box edge-to-edge, unlike BACK's, sized
                    // down to match BACK's visual weight.
                    rightButton = if (isReordering) {
                        LightBarButton.Text("DONE", onClick = { viewModel.isReordering.value = false })
                    } else {
                        LightBarButton.LightIcon(
                            LightIcons.ACCEPT,
                            onClick = { viewModel.save { goBack(null) } },
                            sizeUnits = 1.5f,
                        )
                    },
                    modifier = Modifier.padding(bottom = 1f.gridUnitsAsDp()),
                )

                when {
                    !seeded -> Unit

                    notFound -> Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        LightText(text = "task not found", variant = LightTextVariant.Paragraph)
                    }

                    else -> LightScrollView(
                        modifier = Modifier.fillMaxSize(),
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
                            subtasks = liveTask?.subtasks.orEmpty(),
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
                            isReordering = isReordering,
                            onStartReorder = { viewModel.isReordering.value = true },
                            onMove = { id, delta -> viewModel.moveSubtask(id, delta) },
                        )

                        Spacer(modifier = Modifier.height(1.5f.verticalGridUnitsAsDp()))
                        DeleteRow(task = liveTask, onDeleted = { viewModel.delete { goBack(null) } })
                    }
                }
            }
            }
        }
    }

    @Composable
    private fun DeleteRow(task: Task?, onDeleted: () -> Unit) {
        LightText(
            text = "DELETE",
            variant = LightTextVariant.Button,
            modifier = Modifier
                .fillMaxWidth()
                .lightClickable {
                    if (task == null) return@lightClickable
                    val message = if (task.recurrence != null) {
                        "This is a recurring task. Delete all occurrences?"
                    } else {
                        "Are you sure you want to delete \"${task.title}\"?"
                    }
                    navigateTo(
                        screenFactory = { ConfirmScreen(it, message, "Delete") },
                        resultCallback = { confirmed -> if (confirmed == true) onDeleted() },
                    )
                }
                .padding(horizontal = 1.5f.gridUnitsAsDp(), vertical = 1.8f.gridUnitsAsDp()),
            align = TextAlign.Center,
        )
    }
}
