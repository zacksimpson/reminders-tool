package com.zacksimpson.reminders.data

import java.time.LocalDate

/**
 * pure domain logic, no storage, no Android, no clock (callers pass date/id/clock in).
 * split out so ordering and recurrence can be unit-tested in isolation.
 */
internal object RemindersLogic {

    /**
     * sorts [items] by position in [orderIds] (a drag/reorder-written id array, e.g.
     * `Settings.listOrder` or `ReminderList.taskOrder`) when present and non-empty;
     * items whose id isn't in it are appended after, sorted by [fallback], matches
     * reminders-web's `applyOrder()` in src/lib/ordering.ts exactly, so the two
     * clients never disagree on order given the same data (LIST_TASK_ORDER_MIGRATION.md).
     */
    fun <T> applyOrder(items: List<T>, id: (T) -> String, orderIds: List<String>?, fallback: (T) -> Int): List<T> {
        if (orderIds.isNullOrEmpty()) return items.sortedBy(fallback)
        val rank = orderIds.withIndex().associate { (index, orderId) -> orderId to index }
        val (known, unknown) = items.partition { rank.containsKey(id(it)) }
        return known.sortedBy { rank.getValue(id(it)) } + unknown.sortedBy(fallback)
    }

    /** moves the subtask [id] by [delta] slots (-1 up, +1 down), unchanged if it would leave the list. */
    fun moveSubtask(subtasks: List<Subtask>, id: String, delta: Int): List<Subtask> {
        val from = subtasks.indexOfFirst { it.id == id }
        val to = from + delta
        if (from < 0 || to !in subtasks.indices) return subtasks
        return subtasks.toMutableList().apply { add(to, removeAt(from)) }
    }

    /** TOP -> below the lowest existing order; BOTTOM -> above the highest. */
    fun computeOrder(tasks: List<Task>, listId: String, position: AddPosition): Int {
        val orders = tasks.filter { it.listId == listId }.map { it.order }
        return if (position == AddPosition.TOP) {
            orders.fold(0) { acc, o -> minOf(acc, o) } - 1
        } else {
            orders.fold(-1) { acc, o -> maxOf(acc, o) } + 1
        }
    }

    /**
     * advance a date by one recurrence interval. `plusMonths`/`plusYears` clamp
     * end-of-month (Jan 31 + 1 month -> Feb 28) rather than overflowing.
     */
    fun addInterval(date: LocalDate, r: Recurrence): LocalDate = when (r.unit) {
        RecurrenceUnit.DAY -> date.plusDays(r.interval.toLong())
        RecurrenceUnit.WEEK -> date.plusWeeks(r.interval.toLong())
        RecurrenceUnit.MONTH -> date.plusMonths(r.interval.toLong())
        RecurrenceUnit.YEAR -> date.plusYears(r.interval.toLong())
    }

    /**
     * next occurrence date as ISO "YYYY-MM-DD". advances at least one interval past
     * [dateStr], then keeps going until the result is >= [today].
     */
    fun nextOccurrenceDate(dateStr: String, recurrence: Recurrence, today: LocalDate): String {
        var next = addInterval(LocalDate.parse(dateStr), recurrence)
        while (next.isBefore(today)) next = addInterval(next, recurrence)
        return next.toString()
    }

    /** interval wraps 1<->30 rather than clamping-and-stopping. */
    fun decrementInterval(interval: Int): Int = if (interval <= 1) 30 else interval - 1

    fun incrementInterval(interval: Int): Int = if (interval >= 30) 1 else interval + 1

    /** day -> week -> month -> year -> day. */
    fun nextRecurrenceUnit(unit: RecurrenceUnit): RecurrenceUnit {
        val units = RecurrenceUnit.entries
        return units[(units.indexOf(unit) + 1) % units.size]
    }

    /** follow-up task spawned when a dated recurring task is completed, or null if it
     *  isn't one. carries over title/list/time/recurrence and subtasks (reset to
     *  incomplete). */
    fun spawnNextOccurrence(
        task: Task,
        today: LocalDate,
        newId: () -> String,
        now: () -> Long,
    ): Task? {
        val date = task.date ?: return null
        val recurrence = task.recurrence ?: return null
        return Task(
            id = newId(),
            title = task.title,
            listId = task.listId,
            date = nextOccurrenceDate(date, recurrence, today),
            time = task.time,
            recurrence = recurrence,
            subtasks = task.subtasks.map { it.copy(completed = false) },
            completed = false,
            completedAt = null,
            createdAt = now(),
            order = task.order,
        )
    }
}
