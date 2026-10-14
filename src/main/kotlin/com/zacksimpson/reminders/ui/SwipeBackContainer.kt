package com.zacksimpson.reminders.ui

import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.pointer.positionChange
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.dp
import kotlin.math.abs

private val EDGE_WIDTH = 10.dp
private val DRAG_THRESHOLD = 80.dp

/**
 * left-edge swipe-to-go-back gesture. the SDK provides none and says not to assume a system back swipe is enabled, and Compose's
 * plain pointerInput has no built-in gesture arbitration for this, so it's hand-rolled here.
 *
 * the gesture lives on a narrow strip along the left edge, layered on top of [content]
 * rather than wrapping it, so it only competes for touches starting there. EDGE_WIDTH is
 * kept small (10dp) to stay inside the dead margin before real tap targets like
 * checkboxes and the back button, which start around 12-13dp from the edge.
 *
 * if Light ever ships real edge-swipe-back support, this file is meant to be replaced
 * wholesale, not evolved, no such plan exists yet.
 */
@Composable
fun SwipeBackContainer(
    enabled: Boolean = true,
    onSwipeBack: () -> Unit,
    content: @Composable BoxScope.() -> Unit,
) {
    val density = LocalDensity.current
    val dragThresholdPx = remember(density) { with(density) { DRAG_THRESHOLD.toPx() } }

    Box(modifier = Modifier.fillMaxSize()) {
        content()

        if (enabled) {
            Box(
                modifier = Modifier
                    .align(Alignment.CenterStart)
                    .fillMaxHeight()
                    .width(EDGE_WIDTH)
                    .pointerInput(onSwipeBack) {
                        var totalX = 0f
                        var totalY = 0f
                        var triggered = false
                        detectHorizontalDragGestures(
                            onDragStart = {
                                totalX = 0f
                                totalY = 0f
                                triggered = false
                            },
                            onHorizontalDrag = { change, dragAmount ->
                                totalX += dragAmount
                                totalY += change.positionChange().y
                                if (!triggered && totalX > dragThresholdPx && abs(totalY) < abs(totalX) * 1.5f) {
                                    triggered = true
                                    onSwipeBack()
                                }
                            },
                        )
                    },
            )
        }
    }
}
