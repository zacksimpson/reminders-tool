package com.zacksimpson.reminders.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import com.thelightphone.sdk.ui.LightText
import com.thelightphone.sdk.ui.LightTextVariant
import com.thelightphone.sdk.ui.LightThemeTokens
import com.thelightphone.sdk.ui.designVerticalPxToDp
import com.thelightphone.sdk.ui.designVerticalPxToSp
import com.thelightphone.sdk.ui.gridUnitsAsDp
import com.thelightphone.sdk.ui.lightClickable

/**
 * Subheading's size scaled the same way [LightText] scales it, but with the variant's
 * built-in letter-spacing stripped, Subheading's tracking (designed for smaller,
 * secondary text like Fine/Button) reads oddly at field-value prominence, next to
 * Heading-based text elsewhere that has none.
 */
@Composable
private fun fieldValueStyle(): TextStyle {
    val base = LightThemeTokens.typography.subheading
    return base.copy(
        fontSize = base.fontSize.value.designVerticalPxToSp(),
        lineHeight = base.lineHeight.value.designVerticalPxToSp(),
        letterSpacing = TextUnit.Unspecified,
        color = LightThemeTokens.colors.content,
    )
}

/**
 * big tap-to-edit title input: the value (or placeholder) at Heading size with a full
 * underline beneath and no label.
 */
@Composable
fun TitleField(
    value: String,
    placeholder: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .lightClickable(onClick = onClick)
            .padding(
                start = 1.5f.gridUnitsAsDp(),
                top = 0.75f.gridUnitsAsDp(),
                bottom = 0.75f.gridUnitsAsDp(),
            ),
    ) {
        // LightTextVariant.Heading's built-in line height (1.35x) reads too loose
        // across a wrap (same issue noted for TaskRowView's title), AkkuratText at
        // Heading's own 38sp size uses the font's natural, tighter line height instead.
        AkkuratText(
            text = value.ifBlank { placeholder },
            fontSizeDesignPx = 38f,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(modifier = Modifier.height(0.4f.gridUnitsAsDp()))
        Spacer(
            modifier = Modifier
                .fillMaxWidth()
                // thicker than the SDK's own INPUT_UNDERLINE_THICKNESS_PX (3f), bumped
                // to match Light Calendar's own title-field underline weight more closely.
                .height(4f.designVerticalPxToDp())
                .background(LightThemeTokens.colors.content),
        )
    }
}

/**
 * label-over-value field row (List / Date / Time / Recurring). small label above a larger
 * value, no underline.
 */
@Composable
fun TapField(
    label: String,
    value: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    // values like a picked list/date are short and benefit from truncating rather than
    // wrapping; longer status text (e.g. "Last synced <date>, <time>") needs to wrap
    // instead, or it silently loses the end of the string behind an ellipsis.
    singleLine: Boolean = true,
    // full Heading size instead of the smaller field-value size used on the task screens
    largeValue: Boolean = false,
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .lightClickable(onClick = onClick)
            .padding(horizontal = 1.5f.gridUnitsAsDp(), vertical = 0.75f.gridUnitsAsDp()),
    ) {
        LightText(text = label, variant = LightTextVariant.Detail)
        if (largeValue) {
            LightText(
                text = value,
                variant = LightTextVariant.Heading,
                maxLines = if (singleLine) 1 else Int.MAX_VALUE,
                overflow = if (singleLine) TextOverflow.Ellipsis else TextOverflow.Clip,
                modifier = Modifier.padding(top = 0.25f.gridUnitsAsDp()),
            )
        } else {
            Text(
                text = value,
                style = fieldValueStyle(),
                maxLines = if (singleLine) 1 else Int.MAX_VALUE,
                overflow = if (singleLine) TextOverflow.Ellipsis else TextOverflow.Clip,
                modifier = Modifier.padding(top = 0.25f.gridUnitsAsDp()),
            )
        }
    }
}

/**
 * field row with a value that can be cleared (Date / Time / Recurring once set), shows
 * "None" with a no-op tap when [value] is null, otherwise the value plus a clear-field icon
 * button. shared by Add Task and Task Detail.
 */
@Composable
fun ClearableField(label: String, value: String?, onClick: () -> Unit, onClear: () -> Unit) {
    if (value == null) {
        TapField(label = label, value = "None", onClick = onClick)
        return
    }
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .lightClickable(onClick = onClick)
            .padding(
                start = 1.5f.gridUnitsAsDp(),
                top = 0.75f.gridUnitsAsDp(),
                end = 1.5f.gridUnitsAsDp(),
                bottom = 0.75f.gridUnitsAsDp(),
            ),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Column {
            LightText(text = label, variant = LightTextVariant.Detail)
            Text(
                text = value,
                style = fieldValueStyle(),
                modifier = Modifier.padding(top = 0.25f.gridUnitsAsDp()),
            )
        }
        ClearIcon(
            size = 17.dp,
            // top offset centers against the value line below the label, not the
            // label itself, the label's own line sits above this icon's top edge.
            modifier = Modifier
                .lightClickable(onClick = onClear)
                .padding(top = 1.72f.gridUnitsAsDp(), start = 1f.gridUnitsAsDp()),
        )
    }
}
