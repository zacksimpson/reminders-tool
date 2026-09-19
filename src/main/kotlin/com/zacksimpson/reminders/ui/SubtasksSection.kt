package com.zacksimpson.reminders.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.unit.dp
import com.thelightphone.sdk.ui.LightText
import com.thelightphone.sdk.ui.LightTextVariant
import com.thelightphone.sdk.ui.gridUnitsAsDp
import com.thelightphone.sdk.ui.lightClickable
import com.zacksimpson.reminders.data.Subtask

/** subtasks list + an add button. shared by Add Task and Task Detail, the caller
 *  decides whether mutations are draft (Add) or immediate (Edit). */
@Composable
fun SubtasksSection(
    subtasks: List<Subtask>,
    onAdd: () -> Unit,
    onRename: (Subtask) -> Unit,
    onToggle: (String) -> Unit,
    onDelete: (String) -> Unit,
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
        subtasks.forEach { subtask ->
            SubtaskRow(subtask, onRename = { onRename(subtask) }, onToggle = { onToggle(subtask.id) }, onDelete = { onDelete(subtask.id) })
        }
        // just the icon, no label, the tappable row still spans full width, so tapping
        // the empty space to the right of the icon also works, not just the icon itself.
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .lightClickable(onClick = onAdd)
                .padding(top = 0.6f.gridUnitsAsDp(), bottom = 0.5f.gridUnitsAsDp()),
        ) {
            // matches TaskCheckboxIcon's size so the two circles read the same size.
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
private fun SubtaskRow(subtask: Subtask, onRename: () -> Unit, onToggle: () -> Unit, onDelete: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(start = 0.5f.gridUnitsAsDp(), end = FIELD_END_INSET.gridUnitsAsDp()),
        verticalAlignment = Alignment.Top,
    ) {
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
                    top = 0.68f.gridUnitsAsDp(),
                    bottom = 0.1f.gridUnitsAsDp(),
                )
                .alpha(if (subtask.completed) 0.4f else 1f),
        )
        LightText(
            text = subtask.title,
            variant = LightTextVariant.Paragraph,
            modifier = Modifier
                .weight(1f)
                .lightClickable(onClick = onRename)
                .padding(vertical = 0.65f.gridUnitsAsDp())
                .alpha(if (subtask.completed) 0.4f else 1f),
        )
        DeleteIcon(
            size = 14.dp,
            modifier = Modifier
                .lightClickable(onClick = onDelete)
                .padding(start = 0.5f.gridUnitsAsDp(), top = 0.75f.gridUnitsAsDp(), bottom = 0.6f.gridUnitsAsDp()),
        )
    }
}
