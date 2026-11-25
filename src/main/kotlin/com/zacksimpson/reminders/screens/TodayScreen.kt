package com.zacksimpson.reminders.screens

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.res.painterResource
import com.thelightphone.sdk.ui.LightBarButton
import com.thelightphone.sdk.ui.LightScrollView
import com.thelightphone.sdk.ui.LightText
import com.thelightphone.sdk.ui.LightTextVariant
import com.thelightphone.sdk.ui.LightTopBar
import com.thelightphone.sdk.ui.LightTopBarCenter
import com.thelightphone.sdk.ui.gridUnitsAsDp
import com.thelightphone.sdk.ui.lightClickable
import com.zacksimpson.reminders.DataState
import com.zacksimpson.reminders.R
import com.zacksimpson.reminders.data.Task
import com.zacksimpson.reminders.data.isOverdue
import com.zacksimpson.reminders.data.todayActiveTasks
import com.zacksimpson.reminders.data.todayOverdueTasks
import com.zacksimpson.reminders.ui.TaskRowView
import java.time.LocalDate

/**
 * today tab: overdue tasks, then today's active tasks, then a collapsible completed
 * section. [refreshTick] forces the date/overdue computations below to re-run on a
 * schedule (see MainViewModel), Compose only recomposes on state change, so without
 * this a screen left open across midnight, or resumed from background, would keep
 * showing stale overdue/today status.
 */
@Composable
fun TodayTab(
    state: DataState,
    showOverdue: Boolean,
    refreshTick: Int,
    showCompleted: Boolean,
    onToggleShowCompleted: () -> Unit,
    onAddTask: () -> Unit,
    onOpenTask: (Task) -> Unit,
    onLongPressTask: (Task) -> Unit,
    onToggle: (String) -> Unit,
) {
    Column(modifier = Modifier.fillMaxSize()) {
        LightTopBar(
            leftButton = null,
            center = LightTopBarCenter.Text("Today"),
            rightButton = LightBarButton.Icon(painterResource(R.drawable.ic_plus), onClick = onAddTask, sizeUnits = 1.2f),
            modifier = Modifier.padding(bottom = 1f.gridUnitsAsDp()),
        )

        when (state) {
            is DataState.Loading -> Unit

            is DataState.Corrupt -> LightText(
                text = state.message,
                variant = LightTextVariant.Copy,
                modifier = Modifier.padding(horizontal = 1.5f.gridUnitsAsDp()),
            )

            is DataState.Ready -> {
                val today = remember(refreshTick) { LocalDate.now() }
                val todayStr = today.toString()
                val tasks = state.data.tasks
                fun listTitle(listId: String) = state.data.lists.firstOrNull { it.id == listId }?.title ?: ""

                val overdueTasks = todayOverdueTasks(tasks, showOverdue)
                val activeTasks = todayActiveTasks(tasks, todayStr)
                val completedTasks = tasks
                    .filter { it.completed && (it.date == todayStr || (showOverdue && isOverdue(it.date, it.time))) }
                    .sortedByDescending { it.completedAt ?: 0L }

                if (overdueTasks.isEmpty() && activeTasks.isEmpty() && completedTasks.isEmpty()) {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        LightText(text = "no tasks today", variant = LightTextVariant.Paragraph)
                    }
                } else {
                    LightScrollView(
                        modifier = Modifier.fillMaxSize(),
                    ) {
                        overdueTasks.forEach { task ->
                            TaskRowView(
                                task = task,
                                listTitle = listTitle(task.listId),
                                onToggle = { onToggle(task.id) },
                                onPress = { onOpenTask(task) },
                                onLongPress = { onLongPressTask(task) },
                            )
                        }
                        activeTasks.forEach { task ->
                            TaskRowView(
                                task = task,
                                listTitle = listTitle(task.listId),
                                onToggle = { onToggle(task.id) },
                                onPress = { onOpenTask(task) },
                                onLongPress = { onLongPressTask(task) },
                            )
                        }

                        if (completedTasks.isNotEmpty()) {
                            LightText(
                                text = "Completed (${completedTasks.size})",
                                variant = LightTextVariant.Paragraph,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .lightClickable { onToggleShowCompleted() }
                                    .alpha(0.5f)
                                    .padding(start = 1.5f.gridUnitsAsDp(), top = 1f.gridUnitsAsDp(), bottom = 1f.gridUnitsAsDp()),
                            )
                            if (showCompleted) {
                                completedTasks.forEach { task ->
                                    TaskRowView(
                                        task = task,
                                        listTitle = listTitle(task.listId),
                                        onToggle = { onToggle(task.id) },
                                        onPress = { onOpenTask(task) },
                                        onLongPress = { onLongPressTask(task) },
                                        dimmed = true,
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
