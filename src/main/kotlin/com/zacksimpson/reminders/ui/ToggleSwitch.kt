package com.zacksimpson.reminders.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import com.thelightphone.sdk.ui.LightIcon
import com.thelightphone.sdk.ui.LightIcons
import com.thelightphone.sdk.ui.LightText
import com.thelightphone.sdk.ui.LightTextVariant
import com.thelightphone.sdk.ui.gridUnitsAsDp
import com.thelightphone.sdk.ui.lightClickable

private const val ICON_SIZE = 1.8f
private const val ICON_GAP = 1f

/**
 * Settings-row toggle: the SDK's own TOGGLE_ON/TOGGLE_OFF glyphs on the left, label (plus
 * an optional description subtitle) on the right.
 */
@Composable
fun ToggleSwitch(
    label: String,
    value: Boolean,
    onValueChange: (Boolean) -> Unit,
    description: String? = null,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .lightClickable { onValueChange(!value) }
            .padding(horizontal = 1.5f.gridUnitsAsDp(), vertical = 1f.gridUnitsAsDp()),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            LightIcon(
                icon = if (value) LightIcons.TOGGLE_STATE_ON else LightIcons.TOGGLE_STATE_OFF,
                size = ICON_SIZE,
                modifier = Modifier.padding(end = ICON_GAP.gridUnitsAsDp()),
            )
            LightText(text = label, variant = LightTextVariant.Heading)
        }
        if (description != null) {
            LightText(
                text = description,
                variant = LightTextVariant.Detail,
                modifier = Modifier.padding(
                    start = (ICON_SIZE + ICON_GAP).gridUnitsAsDp(),
                    top = 0.15f.gridUnitsAsDp(),
                ),
            )
        }
    }
}
