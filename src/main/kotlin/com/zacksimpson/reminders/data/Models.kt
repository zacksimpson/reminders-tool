package com.zacksimpson.reminders.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import java.util.UUID

// ─── enums ──────────────────────────────────────────────────────────────────
// @SerialName values are the JSON strings, stable and human-readable.

@Serializable
enum class RecurrenceUnit {
    @SerialName("day") DAY,
    @SerialName("week") WEEK,
    @SerialName("month") MONTH,
    @SerialName("year") YEAR,
}

@Serializable
enum class AfterAddBehavior {
    @SerialName("toast") TOAST,
    @SerialName("go-to-list") GO_TO_LIST,
}

@Serializable
enum class AddPosition {
    @SerialName("top") TOP,
    @SerialName("bottom") BOTTOM,
}

// ─── sync ───────────────────────────────────────────────────────────────────

/** an id-keyed, soft-deletable row that can be reconciled by [SyncLogic.mergeCollection],
 *  `updatedAt` alone decides which side wins a merge (see that file). */
interface SyncableDocument {
    val id: String
    val updatedAt: Long
}

/** a row with a soft-delete flag, old tombstones are eventually purged for good by
 *  [SyncLogic.partitionStaleTombstones]. */
interface SoftDeletable {
    val deleted: Boolean
}

// ─── models ─────────────────────────────────────────────────────────────────
// every optional field has a default so partial/older JSON still decodes.

@Serializable
data class Recurrence(
    val interval: Int,        // 1–30, enforced by the picker UI, not the type
    val unit: RecurrenceUnit,
)

@Serializable
data class Subtask(
    val id: String,
    val title: String,
    val completed: Boolean = false,
    val createdAt: Long,
)

@Serializable
data class Task(
    override val id: String,
    val title: String,
    val listId: String,
    val date: String? = null,          // "YYYY-MM-DD"
    val time: String? = null,          // "HH:MM" 24h
    val recurrence: Recurrence? = null,
    val subtasks: List<Subtask> = emptyList(),
    val completed: Boolean = false,
    val completedAt: Long? = null,
    val createdAt: Long,
    val order: Int,
    // sync bookkeeping (matches reminders-web's Task shape), default to
    // createdAt/false so tasks persisted before this field existed still
    // decode, treated as "unmodified since creation."
    override val updatedAt: Long = createdAt,
    override val deleted: Boolean = false,
) : SyncableDocument, SoftDeletable

@Serializable
data class ReminderList(
    override val id: String,
    val title: String,
    val createdAt: Long,
    val order: Int,
    // sync bookkeeping (matches reminders-web's ReminderList shape), same
    // backward-compatible defaulting as Task.
    override val updatedAt: Long = createdAt,
    override val deleted: Boolean = false,
    // ordered ids of this list's active tasks, written as a single field on
    // reorder instead of rewriting each task's own `order` (LIST_TASK_ORDER_MIGRATION.md
    // in reminders-web). null/empty means "fall back to `order`", see RemindersLogic.applyOrder.
    val taskOrder: List<String>? = null,
) : SyncableDocument, SoftDeletable

@Serializable
data class Settings(
    val defaultListId: String = "inbox",
    val afterAddBehavior: AfterAddBehavior = AfterAddBehavior.TOAST,
    val addPosition: AddPosition = AddPosition.BOTTOM,
    val showOverdue: Boolean = true,
    // sync bookkeeping (matches reminders-web's Settings shape). no natural
    // anchor timestamp to default to like Task/ReminderList have via
    // createdAt, so pre-existing settings just default to "oldest possible",
    // superseded by the first real sync without needing a migration.
    val updatedAt: Long = 0L,
    // ordered ids of all active lists, written as a single field on reorder
    // instead of rewriting each list's own `order` (LIST_TASK_ORDER_MIGRATION.md
    // in reminders-web). null/empty means "fall back to `order`".
    val listOrder: List<String>? = null,
)

// ─── defaults ───────────────────────────────────────────────────────────────

/** default list, shown until the user first mutates lists. `createdAt` is a placeholder
 *  until a real value is persisted. */
val SEED_INBOX = ReminderList(id = "inbox", title = "Inbox", createdAt = 0L, order = 0)

// ─── helpers ────────────────────────────────────────────────────────────────

fun generateId(): String = UUID.randomUUID().toString()

/** "Every 1 day" / "Every 3 weeks". */
fun formatRecurrence(r: Recurrence): String {
    val unit = r.unit.name.lowercase()
    val label = if (r.interval == 1) unit else "${unit}s"
    return "Every ${r.interval} $label"
}
