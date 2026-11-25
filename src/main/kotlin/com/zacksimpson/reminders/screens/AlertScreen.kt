package com.zacksimpson.reminders.screens

import android.util.Log
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewModelScope
import com.zacksimpson.reminders.ui.TaskRowView
import com.zacksimpson.reminders.data.todayOverdueTasks
import com.zacksimpson.reminders.data.todayActiveTasks
import com.zacksimpson.reminders.dataStateIn
import com.zacksimpson.reminders.DataState
import com.thelightphone.sdk.ui.LightScrollView
import androidx.compose.runtime.remember
import androidx.compose.runtime.collectAsState
import com.thelightphone.sdk.LightAlert
import com.thelightphone.sdk.LightScreen
import com.thelightphone.sdk.LightViewModel
import com.thelightphone.sdk.SealedLightActivity
import com.thelightphone.sdk.ui.LightBarButton
import com.thelightphone.sdk.ui.LightBottomBar
import com.thelightphone.sdk.ui.LightIcons
import com.thelightphone.sdk.ui.LightText
import com.thelightphone.sdk.ui.LightTextVariant
import com.thelightphone.sdk.ui.LightThemeTokens
import com.thelightphone.sdk.ui.LightTopBar
import com.thelightphone.sdk.ui.LightTopBarCenter
import com.thelightphone.sdk.ui.gridUnitsAsDp
import com.thelightphone.sdk.ui.lightClickable
import com.zacksimpson.reminders.data.AlertInbox
import com.zacksimpson.reminders.data.AlertInfo
import com.zacksimpson.reminders.data.AlertPlanner
import com.zacksimpson.reminders.data.AlertSnoozeStore
import com.zacksimpson.reminders.data.RemindersRepository
import com.zacksimpson.reminders.data.Snooze
import com.zacksimpson.reminders.data.SnoozeChoice
import com.zacksimpson.reminders.data.SnoozePresets
import com.zacksimpson.reminders.data.formatAlertAt
import com.zacksimpson.reminders.ui.OverdueAsteriskIcon
import com.zacksimpson.reminders.ui.RemindersTheme
import com.zacksimpson.reminders.ui.SwipeBackContainer
import com.zacksimpson.reminders.ui.showToast
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId

private const val TAG = "AlertScreen"

private const val CUSTOM_KEY = "custom"

/** taps and back are ignored this long, with no visible change, so a stray tap can't land */
private const val ARM_DELAY_MS = 1_000L

/** the default toast length, the tool waits this long before closing so the toast shows */
private const val TOAST_MS = 1_000L

class AlertViewModel(
    private val repo: RemindersRepository,
    private val snoozes: AlertSnoozeStore,
) : LightViewModel<Unit>() {
    /** the summary screen lists tasks live, so finishing one drops its row */
    val state = repo.dataStateIn(viewModelScope)

    fun complete(taskId: String, then: () -> Unit) {
        viewModelScope.launch {
            val task = repo.appData.first().tasks.firstOrNull { it.id == taskId }
            if (task != null && !task.completed && !task.deleted) repo.toggleTask(taskId)
            then()
        }
    }

    /** false once the task is finished, deleted or moved to another due time */
    fun stillDue(taskId: String, dueAtMillis: Long, then: (Boolean) -> Unit) {
        viewModelScope.launch {
            val task = repo.appData.first().tasks.firstOrNull { it.id == taskId }
            val open = task != null && !task.completed && !task.deleted &&
                AlertPlanner.dueAtMillis(task, ZoneId.systemDefault()) == dueAtMillis
            then(open)
        }
    }

    fun saveSnooze(taskId: String, snooze: Snooze, then: () -> Unit) {
        viewModelScope.launch {
            snoozes.save(taskId, snooze)
            then()
        }
    }
}

/**
 * what the user sees when an alert fires. complete or remind later for a task, the X (or
 * back) just closes it. the task's due time is never changed, remind later only moves the alert.
 */
class AlertScreen(
    sealedActivity: SealedLightActivity,
    private val alert: LightAlert,
    private val info: AlertInfo,
) : LightScreen<Unit, AlertViewModel>(sealedActivity) {

    private var armed by mutableStateOf(false)
    private var busy = false
    private var listOpened by mutableStateOf(false)

    override val viewModelClass: Class<AlertViewModel>
        get() = AlertViewModel::class.java

    override fun createViewModel() = AlertViewModel(
        RemindersRepository(lightContext.dataStore),
        AlertSnoozeStore(lightContext.dataStore),
    )

    override fun goBack(result: Unit?) = dismiss()

    private fun dismiss() {
        if (!armed || busy) return
        busy = true
        AlertInbox.closeDelayMs = 0
        alert.dismiss()
        leave()
    }

    private fun leave() {
        super.goBack(Unit)
    }

    private fun complete(task: AlertInfo.Reminder) {
        if (!armed || busy) return
        busy = true
        viewModel.complete(task.taskId) {
            showToast("completed")
            AlertInbox.closeDelayMs = TOAST_MS
            alert.dismiss()
            leave()
        }
    }

    // the alert stays open underneath, so back returns to it unless the task changed meanwhile
    private fun openList(listId: String, title: String?) {
        if (!armed || busy) return
        listOpened = true
        navigateTo(screenFactory = { ListDetailScreen(it, listId, title ?: "List") })
    }

    // the list goes back without a result, so check the task when this screen shows again
    override fun willShow() {
        super.willShow()
        val task = info as? AlertInfo.Reminder
        if (task == null) {
            // the summary reads the tasks live, nothing to recheck
            listOpened = false
            return
        }
        if (!listOpened) return
        listOpened = false
        viewModel.stillDue(task.taskId, task.dueAtMillis) { open ->
            if (!open) {
                alert.dismiss()
                leave()
            }
        }
    }

    private fun remindLater(task: AlertInfo.Reminder) {
        if (!armed || busy) return
        val now = System.currentTimeMillis()
        val zone = ZoneId.systemDefault()
        val choices = SnoozePresets.choices(now, zone)
        val options = choices.map { c -> PickerOption(c.key, c.label, detail = formatAlertAt(c.atMillis, now, zone)) } +
            PickerOption(CUSTOM_KEY, "Custom")
        navigateTo(
            screenFactory = { OptionPickerScreen(it, "Remind Later", options, selectedKey = "") },
            resultCallback = { key ->
                if (key == CUSTOM_KEY) {
                    pickCustomDate(task)
                } else {
                    choices.firstOrNull { it.key == key }?.let { saveSnooze(task, it) }
                }
            },
        )
    }

    // backing out of either picker lands back on the presets
    private fun pickCustomDate(task: AlertInfo.Reminder) {
        val today = LocalDate.now()
        navigateTo(
            screenFactory = { DatePickerScreen(it, today.toString(), minDate = today) },
            resultCallback = { date -> if (date != null) pickCustomTime(task, date) else remindLater(task) },
        )
    }

    private fun pickCustomTime(task: AlertInfo.Reminder, date: String) {
        val zone = ZoneId.systemDefault()
        val seed = LocalTime.now().plusHours(1).let { "%02d:%02d".format(it.hour, it.minute) }
        navigateTo(
            screenFactory = {
                TimePickerScreen(
                    it,
                    seed,
                    canSave = { time ->
                        runCatching { SnoozePresets.customAt(date, time, zone) > System.currentTimeMillis() }
                            .getOrDefault(false)
                    },
                )
            },
            resultCallback = { time ->
                if (time != null) {
                    val at = SnoozePresets.customAt(date, time, zone)
                    saveSnooze(task, SnoozeChoice(CUSTOM_KEY, "Custom", at))
                } else {
                    remindLater(task)
                }
            },
        )
    }

    private fun saveSnooze(task: AlertInfo.Reminder, choice: SnoozeChoice) {
        busy = true
        viewModel.saveSnooze(task.taskId, Snooze(task.dueAtMillis, choice.atMillis)) {
            runCatching {
                lightContext.notifications.schedule(alert.id, choice.atMillis, AlertPlanner.TITLE, task.title)
            }.onFailure { Log.e(TAG, "couldn't schedule the snooze", it) }
            showToast("saved")
            AlertInbox.closeDelayMs = TOAST_MS
            alert.dismiss()
            leave()
        }
    }

    @Composable
    override fun Content() {
        RemindersTheme {
            LaunchedEffect(Unit) {
                delay(ARM_DELAY_MS)
                armed = true
            }
            SwipeBackContainer(onSwipeBack = { dismiss() }) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(LightThemeTokens.colors.background),
                ) {
                    LightTopBar(
                        leftButton = null,
                        center = LightTopBarCenter.Text(if (info is AlertInfo.Summary) "Today's Tasks" else "Reminders"),
                        rightButton = null,
                    )
                    when (val shown = info) {
                        is AlertInfo.Reminder -> ReminderBody(shown)
                        AlertInfo.Summary -> SummaryBody()
                    }
                    LightBottomBar(
                        items = listOf(LightBarButton.LightIcon(LightIcons.CLOSE, onClick = { dismiss() })),
                    )
                }
            }
        }
    }

    @Composable
    private fun ColumnScope.ReminderBody(task: AlertInfo.Reminder) {
        Column(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .padding(horizontal = 1.5f.gridUnitsAsDp()),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            // fixed start, so a longer title pushes the details down and the title stays put
            Spacer(Modifier.height(3f.gridUnitsAsDp()))
            // the whole block opens the task's list, with no visual hint
            Column(
                modifier = Modifier.fillMaxWidth().lightClickable(onClick = { openList(task.listId, task.listTitle) }),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.Top,
                    horizontalArrangement = Arrangement.Center,
                ) {
                    if (task.snoozed) {
                        OverdueAsteriskIcon(size = 22.dp, modifier = Modifier.padding(top = 14.dp, end = 10.dp))
                    }
                    LightText(
                        text = task.title,
                        variant = LightTextVariant.Heading,
                        align = TextAlign.Center,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f, fill = false),
                    )
                }
                Spacer(Modifier.height(0.5f.gridUnitsAsDp()))
                AlertDetails(task.listTitle, task.due)
            }
            Spacer(Modifier.weight(1f))
            // the gap is trimmed from complete's bottom and added below, so remind later rises
            AlertAction("COMPLETE", bottomPadding = 0.55f) { complete(task) }
            AlertAction("REMIND LATER") { remindLater(task) }
            Spacer(Modifier.height(3.7f.gridUnitsAsDp()))
        }
    }

    @Composable
    private fun ColumnScope.SummaryBody() {
        val state by viewModel.state.collectAsState()
        val data = (state as? DataState.Ready)?.data
        val tasks = data?.tasks.orEmpty()
        val shown = todayOverdueTasks(tasks, data?.settings?.showOverdue ?: true) +
            todayActiveTasks(tasks, remember { LocalDate.now().toString() })
        val empty = data != null && shown.isEmpty()
        // done once nothing is left, but not while a list is open on top of this screen
        LaunchedEffect(empty, listOpened) {
            if (empty && !listOpened && !busy) {
                busy = true
                AlertInbox.closeDelayMs = 0
                alert.dismiss()
                leave()
            }
        }
        LightScrollView(modifier = Modifier.weight(1f).fillMaxWidth()) {
            shown.forEach { task ->
                val listTitle = data?.lists?.firstOrNull { it.id == task.listId }?.title
                TaskRowView(
                    task = task,
                    listTitle = listTitle ?: "",
                    onToggle = { if (armed && !busy) viewModel.complete(task.id) {} },
                    onPress = { openList(task.listId, listTitle) },
                )
            }
        }
    }
}

/** list and due time on one line, or the list on its own line when they don't fit together */
@Composable
private fun AlertDetails(list: String?, due: String) {
    val measurer = rememberTextMeasurer()
    val style = LightThemeTokens.typography.detail
    BoxWithConstraints(modifier = Modifier.fillMaxWidth()) {
        val single = if (list == null) due else "$list · $due"
        val fits = measurer.measure(single, style, softWrap = false, maxLines = 1).size.width <= constraints.maxWidth
        if (fits || list == null) {
            LightText(
                text = single,
                variant = LightTextVariant.Detail,
                align = TextAlign.Center,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.fillMaxWidth(),
            )
        } else {
            Column(modifier = Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
                LightText(
                    text = list,
                    variant = LightTextVariant.Detail,
                    align = TextAlign.Center,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.fillMaxWidth(),
                )
                LightText(
                    text = due,
                    variant = LightTextVariant.Detail,
                    align = TextAlign.Center,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }
    }
}

@Composable
private fun AlertAction(label: String, bottomPadding: Float = 1.25f, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .lightClickable(onClick = onClick)
            .padding(top = 1.25f.gridUnitsAsDp(), bottom = bottomPadding.gridUnitsAsDp()),
        contentAlignment = Alignment.Center,
    ) {
        LightText(text = label, variant = LightTextVariant.Button)
    }
}
