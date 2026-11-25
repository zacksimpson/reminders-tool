package com.zacksimpson.reminders.data

/** open tasks past due right now, oldest first, none when the today view hides overdue */
fun todayOverdueTasks(tasks: List<Task>, showOverdue: Boolean): List<Task> =
    if (showOverdue) {
        tasks.filter { !it.completed && isOverdue(it.date, it.time) }
            .sortedWith(::compareTasksByDateThenTime)
    } else {
        emptyList()
    }

/** open tasks dated [today] that aren't overdue yet */
fun todayActiveTasks(tasks: List<Task>, today: String): List<Task> =
    tasks.filter { it.date == today && !it.completed && !isOverdue(it.date, it.time) }
        .sortedWith(::compareTasksByDateTime)
