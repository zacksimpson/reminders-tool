package com.zacksimpson.reminders.ui

import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.key
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.dp
import com.thelightphone.sdk.ui.LightIcon
import com.thelightphone.sdk.ui.LightIcons
import com.thelightphone.sdk.ui.LightText
import com.thelightphone.sdk.ui.LightTextVariant
import com.thelightphone.sdk.ui.gridUnitsAsDp
import com.thelightphone.sdk.ui.lightClickable
import com.zacksimpson.reminders.data.Subtask

/** what the subtask rows are showing: checkboxes, or move arrows while reordering. */
enum class SubtaskMode { NORMAL, REORDER }

/** subtasks list + add button, shared by Add Task (draft) and Task Detail (live).
 *  long-press reorders, swipe a row left to reveal its delete icon, right to hide it. */
@Composable
fun SubtasksSection(
    subtasks: List<Subtask>,
    onAdd: () -> Unit,
    onRename: (Subtask) -> Unit,
    onToggle: (String) -> Unit,
    onDelete: (String) -> Unit,
    mode: SubtaskMode,
    onModeChange: (SubtaskMode) -> Unit,
    revealedId: String?,
    onRevealChange: (String?) -> Unit,
    onMove: (id: String, delta: Int) -> Unit,
) {
    Column {
        LightText(
            text = "Subtasks",
            variant = LightTextVariant.Detail,
            modifier = Modifier.padding(
                start = 1.5f.gridUnitsAsDp(),
                top = 1.5f.gridUnitsAsDp(),
                bottom = 0.5f.gridUnitsAsDp(),
            ),
        )
        subtasks.forEachIndexed { index, subtask ->
            // keyed so a row's swipe handler stays tied to its own subtask when rows above it go away
            key(subtask.id) {
                SubtaskRow(
                    subtask = subtask,
                    mode = mode,
                    revealed = subtask.id == revealedId,
                    isFirst = index == 0,
                    isLast = index == subtasks.lastIndex,
                    onRename = { onRename(subtask) },
                    onToggle = { onToggle(subtask.id) },
                    onDelete = {
                        onRevealChange(null)
                        onDelete(subtask.id)
                    },
                    onStartReorder = {
                        onRevealChange(null)
                        onModeChange(SubtaskMode.REORDER)
                    },
                    onReveal = { onRevealChange(subtask.id) },
                    onHide = { onRevealChange(null) },
                    onMoveUp = { onMove(subtask.id, -1) },
                    onMoveDown = { onMove(subtask.id, 1) },
                )
            }
        }
        if (mode != SubtaskMode.NORMAL) return@Column
        // just the icon, no label, the tappable row still spans full width, so tapping
        // the empty space to the right of the icon also works, not just the icon itself.
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .lightClickable(onClick = onAdd)
                .padding(top = 0.785f.gridUnitsAsDp(), bottom = 0.5f.gridUnitsAsDp()),
        ) {
            // same size and top offset as the checkbox in SubtaskRow, so the + sits where the next
            // subtask's checkbox would.
            PlusCircleIcon(
                size = 17.dp,
                // start matches SubtaskRow's own start so this lines up under the
                // checkbox above.
                modifier = Modifier.padding(start = 1.4f.gridUnitsAsDp()),
            )
        }
    }
}

@Composable
private fun SubtaskRow(
    subtask: Subtask,
    mode: SubtaskMode,
    revealed: Boolean,
    isFirst: Boolean,
    isLast: Boolean,
    onRename: () -> Unit,
    onToggle: () -> Unit,
    onDelete: () -> Unit,
    onStartReorder: () -> Unit,
    onReveal: () -> Unit,
    onHide: () -> Unit,
    onMoveUp: () -> Unit,
    onMoveDown: () -> Unit,
) {
    val reordering = mode == SubtaskMode.REORDER
    val showDelete = revealed && !reordering
    val swipeThresholdPx = with(LocalDensity.current) { 2.5f.gridUnitsAsDp().toPx() }
    Row(
        modifier = Modifier
            .fillMaxWidth()
            // swipe left reveals the delete icon, right hides it, fires without lifting
            .pointerInput(reordering, revealed) {
                if (reordering) return@pointerInput
                var total = 0f
                var fired = false
                detectHorizontalDragGestures(
                    onDragStart = { total = 0f; fired = false },
                    onDragCancel = { total = 0f; fired = false },
                    onHorizontalDrag = { _, dx ->
                        total += dx
                        if (!fired) {
                            if (total <= -swipeThresholdPx && !revealed) {
                                fired = true
                                onReveal()
                            } else if (total >= swipeThresholdPx && revealed) {
                                fired = true
                                onHide()
                            }
                        }
                    },
                )
            }
            .padding(start = 0.5f.gridUnitsAsDp(), end = FIELD_END_INSET.gridUnitsAsDp()),
        verticalAlignment = Alignment.Top,
    ) {
        if (!reordering && !showDelete) {
            // top offset tuned against this row's Paragraph text, not copied from
            // TaskRowView's checkbox, different line metrics (AkkuratText there).
            TaskCheckboxIcon(
                checked = subtask.completed,
                size = 17.dp,
                modifier = Modifier
                    .lightClickable(onClick = onToggle)
                    .padding(
                        start = 0.9f.gridUnitsAsDp(),
                        end = 0.9f.gridUnitsAsDp(),
                        top = 0.785f.gridUnitsAsDp(),
                        bottom = 0.1f.gridUnitsAsDp(),
                    )
                    .alpha(if (subtask.completed) 0.4f else 1f),
            )
        }
        LightText(
            text = subtask.title,
            variant = LightTextVariant.Paragraph,
            modifier = Modifier
                .weight(1f)
                .combinedClickable(
                    enabled = !reordering,
                    onClick = onRename,
                    onLongClick = onStartReorder,
                )
                // replaces the left margin the checkbox normally provides, same as
                // TaskRowView does while reordering.
                .padding(start = if (reordering || showDelete) 1f.gridUnitsAsDp() else 0.dp, top = 0.65f.gridUnitsAsDp(), bottom = 0.65f.gridUnitsAsDp())
                .alpha(if (subtask.completed) 0.4f else 1f),
        )
        if (reordering) {
            SubtaskReorderArrows(isFirst = isFirst, isLast = isLast, onMoveUp = onMoveUp, onMoveDown = onMoveDown)
        } else if (showDelete) {
            DeleteIcon(
                size = 14.dp,
                modifier = Modifier
                    .lightClickable(onClick = onDelete)
                    .padding(start = 0.5f.gridUnitsAsDp(), top = 0.905f.gridUnitsAsDp(), bottom = 0.445f.gridUnitsAsDp()),
            )
        }
    }
}

private const val ARROW_SIZE = 1.4f

/** smaller up/down arrows for the subtask rows, the shared [ReorderArrows] is sized for
 *  the taller task and list rows. */
@Composable
private fun SubtaskReorderArrows(isFirst: Boolean, isLast: Boolean, onMoveUp: () -> Unit, onMoveDown: () -> Unit) {
    // per-icon offsets center both arrows on the first text line and line the ink up with the delete icon
    Row(modifier = Modifier.offset(x = 0.21f.gridUnitsAsDp())) {
        LightIcon(
            icon = LightIcons.UP,
            size = ARROW_SIZE,
            modifier = Modifier
                .offset(y = 0.475f.gridUnitsAsDp())
                .alpha(if (isFirst) 0.3f else 1f)
                .lightClickable(enabled = !isFirst, onClick = onMoveUp)
                .padding(start = 0.5f.gridUnitsAsDp(), end = 0.5f.gridUnitsAsDp(), top = 0.485f.gridUnitsAsDp(), bottom = 0.515f.gridUnitsAsDp()),
        )
        LightIcon(
            icon = LightIcons.DOWN,
            size = ARROW_SIZE,
            modifier = Modifier
                .alpha(if (isLast) 0.3f else 1f)
                .lightClickable(enabled = !isLast, onClick = onMoveDown)
                .padding(start = 0.5f.gridUnitsAsDp(), top = 0.445f.gridUnitsAsDp(), bottom = 0.555f.gridUnitsAsDp()),
        )
    }
}
