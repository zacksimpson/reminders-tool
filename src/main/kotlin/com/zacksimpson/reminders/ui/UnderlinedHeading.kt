package com.zacksimpson.reminders.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import com.thelightphone.sdk.ui.LightThemeTokens
import com.thelightphone.sdk.ui.designVerticalPxToDp
import com.thelightphone.sdk.ui.gridUnitsAsDp

/**
 * heading text with a drawn underline the width of the text, same weight as the
 * task title field. the underline space is always reserved so selecting a row doesn't
 * shift the rows below it.
 */
@Composable
fun UnderlinedHeading(text: String, underlined: Boolean, modifier: Modifier = Modifier) {
    Column(modifier = modifier.width(IntrinsicSize.Max)) {
        // natural line height (same trick as the title field), Heading's 1.35x leaves a big
        // gap under the letters before the underline even starts.
        AkkuratText(text = text, fontSizeDesignPx = 38f)
        Spacer(modifier = Modifier.height(0.1f.gridUnitsAsDp()))
        Spacer(
            modifier = Modifier
                .fillMaxWidth()
                .height(4f.designVerticalPxToDp())
                .background(if (underlined) LightThemeTokens.colors.content else Color.Transparent),
        )
    }
}
