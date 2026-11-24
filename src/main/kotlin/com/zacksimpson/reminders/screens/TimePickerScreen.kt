package com.zacksimpson.reminders.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.thelightphone.sdk.SealedLightActivity
import com.thelightphone.sdk.SimpleLightScreen
import com.thelightphone.sdk.ui.LightIcon
import com.thelightphone.sdk.ui.LightIcons
import com.thelightphone.sdk.ui.LightText
import com.thelightphone.sdk.ui.LightTextVariant
import com.thelightphone.sdk.ui.LightThemeTokens
import com.thelightphone.sdk.ui.gridUnitsAsDp
import com.thelightphone.sdk.ui.lightClickable
import com.zacksimpson.reminders.data.TimePickerLogic
import com.zacksimpson.reminders.data.digitsToTime
import com.zacksimpson.reminders.data.timeToDisplayParts
import com.zacksimpson.reminders.ui.AkkuratText
import com.zacksimpson.reminders.ui.RemindersTheme

/**
 * numpad time entry, see [TimePickerLogic] for the digit-validation state machine.
 * SAVE closes with the confirmed "HH:MM" (24h) result, the dismiss (✕), only available
 * with zero digits typed, closes with null.
 */
class TimePickerScreen(
    sealedActivity: SealedLightActivity,
    private val initialValue: String?,
    private val use24Hour: Boolean = false,
    /** times this rejects can't be saved, the SAVE slot stays blank like mid-entry */
    private val canSave: (String) -> Boolean = { true },
) : SimpleLightScreen<String?>(sealedActivity) {

    @Composable
    override fun Content() {
        RemindersTheme {
            val seed = remember { initialValue?.let { timeToDisplayParts(it, use24Hour) } }
            var digits by remember { mutableStateOf(seed?.first ?: "") }
            var ampm by remember { mutableStateOf(seed?.second ?: "AM") }

            val hasDigits = digits.isNotEmpty()
            val canConfirm = (digits.length == 3 || digits.length == 4) &&
                canSave(digitsToTime(digits, ampm, use24Hour))

            fun tapDigit(d: Char) {
                if (digits.length >= 4) return
                if (TimePickerLogic.isValidNextDigit(digits, d, use24Hour)) digits += d
            }

            fun backspace() {
                digits = digits.dropLast(1)
            }

            fun confirm() {
                goBack(digitsToTime(digits, ampm, use24Hour))
            }

            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .background(LightThemeTokens.colors.background),
            ) {
                // no LightTopBar, an empty one still reserves 3 grid units of height,
                // pushing this block lower than intended. AM/PM pinned to the row's
                // edges, time display centered over the same Box via contentAlignment
                // so it doesn't shift as digits are typed.
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(
                            top = 0.75f.gridUnitsAsDp(),
                            bottom = 0.5f.gridUnitsAsDp(),
                            start = 1.5f.gridUnitsAsDp(),
                            end = 1.5f.gridUnitsAsDp(),
                        ),
                    contentAlignment = Alignment.Center,
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        AmPmSlot("AM", ampm, use24Hour) { ampm = "AM" }
                        AmPmSlot("PM", ampm, use24Hour) { ampm = "PM" }
                    }
                    AkkuratText(
                        text = TimePickerLogic.buildDisplay(digits),
                        fontSizeDesignPx = 115f, // near Title size
                        fontWeight = FontWeight.Light,
                        align = TextAlign.Center,
                        modifier = Modifier.fillMaxWidth(),
                    )
                }

                // each digit column is weight(1f), so the 3 columns split the row width
                // evenly, more side padding narrows the row and pulls them closer together.
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxWidth()
                        .padding(
                            start = 3f.gridUnitsAsDp(),
                            end = 3f.gridUnitsAsDp(),
                            bottom = 1f.gridUnitsAsDp(),
                        ),
                    verticalArrangement = Arrangement.SpaceEvenly,
                ) {
                    listOf("123", "456", "789").forEach { row ->
                        NumRow {
                            row.forEach { d -> NumBtn(d.toString()) { tapDigit(d) } }
                        }
                    }
                    NumRow {
                        // matches NumBtn's own vertical padding so all four rows line up.
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .padding(vertical = 0.2f.gridUnitsAsDp()),
                            contentAlignment = Alignment.Center,
                        ) {
                            when {
                                canConfirm -> LightText(
                                    text = "SAVE",
                                    variant = LightTextVariant.Paragraph,
                                    modifier = Modifier.lightClickable { confirm() },
                                )
                                hasDigits -> Unit // blank while mid-entry, no button shown
                                else -> LightIcon(
                                    icon = LightIcons.CLOSE,
                                    size = 2.2f, // matches the 48px numpad digits visually
                                    modifier = Modifier.lightClickable { goBack(null) },
                                )
                            }
                        }
                        NumBtn("0") { tapDigit('0') }
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .padding(vertical = 0.2f.gridUnitsAsDp()),
                            contentAlignment = Alignment.Center,
                        ) {
                            if (hasDigits) {
                                LightIcon(
                                    icon = LightIcons.BACK,
                                    size = 2.4f,
                                    modifier = Modifier.lightClickable { backspace() },
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun NumRow(content: @Composable androidx.compose.foundation.layout.RowScope.() -> Unit) {
    // CenterVertically matters on the bottom row, where the small SAVE text and the
    // much taller "0" digit would otherwise misalign under Row's default Top alignment.
    Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, content = content)
}

@Composable
private fun androidx.compose.foundation.layout.RowScope.NumBtn(digit: String, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .weight(1f)
            .lightClickable(onClick = onClick)
            .padding(vertical = 0.2f.gridUnitsAsDp()),
        contentAlignment = Alignment.Center,
    ) {
        AkkuratText(text = digit, fontSizeDesignPx = 48f) // between Heading/Subtitle sizes
    }
}

@Composable
private fun androidx.compose.foundation.layout.RowScope.AmPmSlot(
    value: String,
    selected: String,
    use24Hour: Boolean,
    onClick: () -> Unit,
) {
    if (use24Hour) {
        Box(modifier = Modifier.width(60.dp).height(34.dp))
        return
    }
    Box(
        modifier = Modifier
            .width(60.dp)
            .lightClickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            LightText(text = value, variant = LightTextVariant.Copy)
            Box(
                modifier = Modifier
                    .padding(top = 0.15f.gridUnitsAsDp())
                    .width(32.dp)
                    .height(3.dp)
                    .background(if (selected == value) LightThemeTokens.colors.content else Color.Transparent),
            )
        }
    }
}
