import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { autoBackup } from "@/utils/backup";
import { formatISODate, parseDateStr } from "@/utils/dateTime";
import { applyOrder, reorderIds } from "@/utils/ordering";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Recurrence {
  interval: number; // 1–30
  unit: "day" | "week" | "month" | "year";
}

export function formatRecurrence(r: Recurrence): string {
  const unit = r.interval === 1 ? r.unit : `${r.unit}s`;
  return `Every ${r.interval} ${unit}`;
}

export interface Subtask {
  completed: boolean;
  createdAt: number;
  id: string;
  title: string;
}

export interface Task {
  completed: boolean;
  completedAt?: number;
  createdAt: number;
  date?: string; // ISO date string "YYYY-MM-DD"
  // Sync bookkeeping (matches reminders-web's Task shape). Soft-delete tombstone:
  // never physically removed, so a deletion can propagate to other synced clients.
  deleted: boolean;
  id: string;
  listId: string;
  order: number;
  recurrence?: Recurrence;
  subtasks: Subtask[];
  time?: string; // "HH:MM" 24h
  title: string;
  updatedAt: number;
}

export interface ReminderList {
  createdAt: number;
  deleted: boolean;
  id: string;
  order: number;
  // Ordered ids of this list's active tasks, written as a single field on reorder
  // instead of rewriting each task's own `order` (matches reminders-web). Null/empty
  // means "fall back to `order`", see utils/ordering.ts applyOrder.
  taskOrder?: string[] | null;
  title: string;
  updatedAt: number;
}

export interface Settings {
  addPosition: "top" | "bottom";
  afterAddBehavior: "toast" | "go-to-list";
  defaultListId: string;
  // Ordered ids of all active lists, written as a single field on reorder instead of
  // rewriting each list's own `order` (matches reminders-web). Null/empty means
  // "fall back to `order`".
  listOrder?: string[] | null;
  showOverdue: boolean;
  updatedAt: number;
}

/** Full snapshot including soft-deleted tombstones, for the sync engine. */
export interface SyncSnapshot {
  lists: ReminderList[];
  settings: Settings;
  tasks: Task[];
}

// ─── Storage Keys ─────────────────────────────────────────────────────────────

const LISTS_KEY = "reminders:lists";
const TASKS_KEY = "reminders:tasks";
const SETTINGS_KEY = "reminders:settings";
const AUTO_BACKUP_KEY = "reminders:lastAutoBackup";
const AUTO_BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

// ─── Default Data ─────────────────────────────────────────────────────────────

const DEFAULT_LIST_CREATED_AT = Date.now();
const DEFAULT_LIST: ReminderList = {
  id: "inbox",
  title: "Inbox",
  createdAt: DEFAULT_LIST_CREATED_AT,
  order: 0,
  updatedAt: DEFAULT_LIST_CREATED_AT,
  deleted: false,
  taskOrder: null,
};

const DEFAULT_SETTINGS: Settings = {
  defaultListId: "inbox",
  afterAddBehavior: "toast",
  addPosition: "bottom",
  showOverdue: true,
  updatedAt: 0,
  listOrder: null,
};

// ─── Normalization ────────────────────────────────────────────────────────────
// Fills sync-bookkeeping fields for data persisted before this feature existed
// (local storage or an old backup file), same defaulting reminders-web/native use.

export function normalizeTask(t: Task): Task {
  return {
    ...t,
    updatedAt: t.updatedAt ?? t.createdAt,
    deleted: t.deleted ?? false,
  };
}

export function normalizeList(l: ReminderList): ReminderList {
  return {
    ...l,
    updatedAt: l.updatedAt ?? l.createdAt,
    deleted: l.deleted ?? false,
    taskOrder: l.taskOrder ?? null,
  };
}

export function normalizeSettings(s: Settings): Settings {
  return {
    ...s,
    updatedAt: s.updatedAt ?? 0,
    listOrder: s.listOrder ?? null,
  };
}

// ─── Context ──────────────────────────────────────────────────────────────────

export type NotificationScheduler = {
  scheduleForTask: (task: Task, lists: ReminderList[]) => Promise<void>;
  cancelForTask: (taskId: string) => Promise<void>;
  rescheduleAll: (tasks: Task[], lists: ReminderList[]) => Promise<void>;
  refreshBundles: (tasks: Task[], affectedDate?: string) => Promise<void>;
} | null;

let notificationScheduler: NotificationScheduler = null;
export function setNotificationScheduler(s: NotificationScheduler) {
  notificationScheduler = s;
}

interface RemindersContextType {
  // List operations
  addList: (title: string) => void;

  // Subtask operations
  addSubtask: (taskId: string, title: string) => void;

  // Task operations
  addTask: (
    task: Omit<
      Task,
      "id" | "createdAt" | "order" | "completed" | "updatedAt" | "deleted"
    > & { subtasks?: Subtask[] }
  ) => Task;

  // Sync
  applySyncedState: (
    lists: ReminderList[],
    tasks: Task[],
    settings: Settings
  ) => Promise<void>;

  // Bulk task operations
  clearCompletedTasks: (listId: string) => void;
  deleteList: (id: string) => void;
  deleteSubtask: (taskId: string, subtaskId: string) => void;
  deleteTask: (id: string) => void;
  lists: ReminderList[];
  loaded: boolean;
  moveListDown: (id: string) => void;
  moveListUp: (id: string) => void;

  // Task reordering
  moveTaskDown: (id: string, listId: string) => void;
  moveTaskUp: (id: string, listId: string) => void;
  renameList: (id: string, title: string) => void;

  // Backup
  restoreBackup: (data: {
    lists: ReminderList[];
    settings: Settings;
    tasks: Task[];
  }) => Promise<void>;
  settings: Settings;

  // Sync
  snapshotForSync: () => SyncSnapshot;
  tasks: Task[];
  toggleSubtask: (taskId: string, subtaskId: string) => void;
  toggleTask: (id: string) => void;

  // Settings
  updateSettings: (updates: Partial<Settings>) => void;
  updateTask: (
    id: string,
    updates: Partial<Omit<Task, "id" | "createdAt">>
  ) => void;
}

const RemindersContext = createContext<RemindersContextType | null>(null);

export const useReminders = () => {
  const ctx = useContext(RemindersContext);
  if (!ctx) {
    throw new Error("useReminders must be used within RemindersProvider");
  }
  return ctx;
};

// ─── Provider ─────────────────────────────────────────────────────────────────

function addInterval(
  date: Date,
  unit: Recurrence["unit"],
  interval: number
): Date {
  const d = new Date(date);
  switch (unit) {
    case "day":
      d.setDate(d.getDate() + interval);
      break;
    case "week":
      d.setDate(d.getDate() + interval * 7);
      break;
    case "month":
      d.setMonth(d.getMonth() + interval);
      break;
    case "year":
      d.setFullYear(d.getFullYear() + interval);
      break;
    default:
      break;
  }
  return d;
}

function getNextOccurrenceDate(
  dateStr: string,
  recurrence: Recurrence
): string {
  const { y, mo, d } = parseDateStr(dateStr);
  let date = new Date(y, mo - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  do {
    date = addInterval(date, recurrence.unit, recurrence.interval);
  } while (date < today);
  return formatISODate(date);
}

function spawnNextOccurrence(task: Task): Task | null {
  if (!(task.date && task.recurrence)) {
    return null;
  }
  const nextDate = getNextOccurrenceDate(task.date, task.recurrence);
  const now = Date.now();
  return {
    id: generateId(),
    title: task.title,
    listId: task.listId,
    date: nextDate,
    time: task.time,
    recurrence: task.recurrence,
    completed: false,
    createdAt: now,
    updatedAt: now,
    deleted: false,
    order: task.order,
    subtasks: task.subtasks.map((s) => ({ ...s, completed: false })),
  };
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function parseStoredData(
  rawLists: string | null,
  rawTasks: string | null,
  rawSettings: string | null
): { lists: ReminderList[]; settings: Settings; tasks: Task[] } {
  let lists: ReminderList[] = [DEFAULT_LIST];
  let tasks: Task[] = [];
  let settings: Settings = DEFAULT_SETTINGS;
  try {
    if (rawLists) {
      lists = (JSON.parse(rawLists) as ReminderList[]).map(normalizeList);
    }
  } catch {
    /* ignore corrupt data, keep default */
  }
  try {
    if (rawTasks) {
      tasks = (JSON.parse(rawTasks) as Task[]).map(normalizeTask);
    }
  } catch {
    /* ignore corrupt data, keep default */
  }
  try {
    if (rawSettings) {
      settings = normalizeSettings({
        ...DEFAULT_SETTINGS,
        ...JSON.parse(rawSettings),
      });
    }
  } catch {
    /* ignore corrupt data, keep default */
  }
  return { lists, tasks, settings };
}

async function runDailyAutoBackup(
  lists: ReminderList[],
  tasks: Task[],
  settings: Settings
): Promise<void> {
  const lastStr = await AsyncStorage.getItem(AUTO_BACKUP_KEY);
  const last = lastStr ? Number(lastStr) : 0;
  if (Date.now() - last < AUTO_BACKUP_INTERVAL_MS) {
    return;
  }
  await autoBackup(lists, tasks, settings);
  await AsyncStorage.setItem(AUTO_BACKUP_KEY, String(Date.now()));
}

export function RemindersProvider({ children }: { children: ReactNode }) {
  const [lists, setLists] = useState<ReminderList[]>([DEFAULT_LIST]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  // Load from AsyncStorage on mount, then trigger daily auto-backup
  useEffect(() => {
    const load = async () => {
      const [rawLists, rawTasks, rawSettings] = await Promise.all([
        AsyncStorage.getItem(LISTS_KEY),
        AsyncStorage.getItem(TASKS_KEY),
        AsyncStorage.getItem(SETTINGS_KEY),
      ]);
      const parsed = parseStoredData(rawLists, rawTasks, rawSettings);
      setLists(parsed.lists);
      setTasks(parsed.tasks);
      setSettings(parsed.settings);
      setLoaded(true);
      try {
        await runDailyAutoBackup(
          parsed.lists.filter((l) => !l.deleted),
          parsed.tasks.filter((t) => !t.deleted),
          parsed.settings
        );
      } catch {
        /* don't let backup failure affect startup */
      }
    };
    load();
  }, []);

  // Persist lists
  const persistLists = useCallback(async (next: ReminderList[]) => {
    setLists(next);
    await AsyncStorage.setItem(LISTS_KEY, JSON.stringify(next));
  }, []);

  // Persist tasks
  const persistTasks = useCallback(async (next: Task[]) => {
    setTasks(next);
    await AsyncStorage.setItem(TASKS_KEY, JSON.stringify(next));
  }, []);

  // Persist settings
  const persistSettings = useCallback(async (next: Settings) => {
    setSettings(next);
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  }, []);

  // ── List operations ──────────────────────────────────────────────────────

  const addList = useCallback(
    (title: string) => {
      const now = Date.now();
      const next = [
        ...lists,
        {
          id: generateId(),
          title,
          createdAt: now,
          order: lists.filter((l) => !l.deleted).length,
          updatedAt: now,
          deleted: false,
          taskOrder: null,
        },
      ];
      persistLists(next);
    },
    [lists, persistLists]
  );

  const renameList = useCallback(
    (id: string, title: string) => {
      persistLists(
        lists.map((l) =>
          l.id === id ? { ...l, title, updatedAt: Date.now() } : l
        )
      );
    },
    [lists, persistLists]
  );

  const deleteList = useCallback(
    (id: string) => {
      // Soft-delete the list (tombstone, so the deletion syncs) and reassign its
      // tasks to the default list.
      const defaultId = settings.defaultListId;
      const now = Date.now();
      persistLists(
        lists.map((l) =>
          l.id === id ? { ...l, deleted: true, updatedAt: now } : l
        )
      );
      persistTasks(
        tasks.map((t) =>
          t.listId === id ? { ...t, listId: defaultId, updatedAt: now } : t
        )
      );
    },
    [lists, tasks, settings.defaultListId, persistLists, persistTasks]
  );

  /** Persists the reordered active-list array as one field on Settings, a single
   *  write no matter how many lists exist, matching reminders-web's `reorderLists()`.
   *  Individual lists' own `order` field is left untouched; it only remains as the
   *  fallback sort key for ids not yet in the array. */
  const reorderList = useCallback(
    (id: string, direction: -1 | 1) => {
      const active = lists.filter((l) => !l.deleted);
      const sorted = applyOrder(
        active,
        (l) => l.id,
        settings.listOrder,
        (l) => l.order
      );
      const nextOrder = reorderIds(sorted, (l) => l.id, id, direction);
      if (!nextOrder) {
        return;
      }
      persistSettings({
        ...settings,
        listOrder: nextOrder,
        updatedAt: Date.now(),
      });
    },
    [lists, settings, persistSettings]
  );

  const moveListUp = useCallback(
    (id: string) => reorderList(id, -1),
    [reorderList]
  );

  const moveListDown = useCallback(
    (id: string) => reorderList(id, 1),
    [reorderList]
  );

  // ── Task operations ──────────────────────────────────────────────────────

  const addTask = useCallback(
    (
      task: Omit<
        Task,
        "id" | "createdAt" | "order" | "completed" | "updatedAt" | "deleted"
      > & {
        subtasks?: Subtask[];
      }
    ): Task => {
      const listTasks = tasks.filter(
        (t) => t.listId === task.listId && !t.deleted
      );
      const isTop = settings.addPosition === "top";
      let order: number;
      if (isTop) {
        const minOrder = listTasks.reduce(
          (acc, t) => Math.min(acc, t.order),
          0
        );
        order = minOrder - 1;
      } else {
        const maxOrder = listTasks.reduce(
          (acc, t) => Math.max(acc, t.order),
          -1
        );
        order = maxOrder + 1;
      }
      const now = Date.now();
      const newTask: Task = {
        ...task,
        id: generateId(),
        createdAt: now,
        updatedAt: now,
        deleted: false,
        order,
        subtasks: task.subtasks ?? [],
        completed: false,
      };
      const updatedTasks = [...tasks, newTask];
      persistTasks(updatedTasks);
      notificationScheduler?.scheduleForTask(newTask, lists);
      notificationScheduler?.refreshBundles(updatedTasks, newTask.date);
      return newTask;
    },
    [tasks, lists, settings.addPosition, persistTasks]
  );

  const updateTask = useCallback(
    (id: string, updates: Partial<Omit<Task, "id" | "createdAt">>) => {
      const updatedTasks = tasks.map((t) =>
        t.id === id ? { ...t, ...updates, updatedAt: Date.now() } : t
      );
      persistTasks(updatedTasks);
      const updated = updatedTasks.find((t) => t.id === id);
      if (updated) {
        notificationScheduler?.cancelForTask(id);
        notificationScheduler?.scheduleForTask(updated, lists);
      }
      // Pass undefined: the date may have changed, so refresh both bundles conservatively
      notificationScheduler?.refreshBundles(
        updatedTasks.filter((t) => !t.deleted),
        undefined
      );
    },
    [tasks, lists, persistTasks]
  );

  const deleteTask = useCallback(
    (id: string) => {
      const deletedDate = tasks.find((t) => t.id === id)?.date;
      const now = Date.now();
      const updated = tasks.map((t) =>
        t.id === id ? { ...t, deleted: true, updatedAt: now } : t
      );
      persistTasks(updated);
      notificationScheduler?.cancelForTask(id);
      notificationScheduler?.refreshBundles(
        updated.filter((t) => !t.deleted),
        deletedDate
      );
    },
    [tasks, persistTasks]
  );

  const clearCompletedTasks = useCallback(
    (listId: string) => {
      const now = Date.now();
      const removed = tasks.filter(
        (t) => t.listId === listId && t.completed && !t.deleted
      );
      const updated = tasks.map((t) =>
        t.listId === listId && t.completed && !t.deleted
          ? { ...t, deleted: true, updatedAt: now }
          : t
      );
      persistTasks(updated);
      for (const t of removed) {
        notificationScheduler?.cancelForTask(t.id);
      }
      // Completed tasks are filtered out of bundles so content won't change,
      // but call for consistency with all other mutations
      notificationScheduler?.refreshBundles(
        updated.filter((t) => !t.deleted),
        undefined
      );
    },
    [tasks, persistTasks]
  );

  const toggleTask = useCallback(
    (id: string) => {
      const now = Date.now();
      const updatedTasks = tasks.map((t) => {
        if (t.id !== id) {
          return t;
        }
        if (t.completed) {
          const { completedAt: _, ...rest } = t;
          return { ...rest, completed: false, updatedAt: now };
        }
        return { ...t, completed: true, completedAt: now, updatedAt: now };
      });

      const updated = updatedTasks.find((t) => t.id === id);

      // If completing a recurring task, advance the series
      let finalTasks = updatedTasks;
      let nextTask: Task | null = null;
      if (updated?.completed && updated.recurrence && updated.date) {
        nextTask = spawnNextOccurrence(updated);
        if (nextTask) {
          finalTasks = [...updatedTasks, nextTask];
        }
      }

      persistTasks(finalTasks);

      if (updated?.completed) {
        notificationScheduler?.cancelForTask(id);
        if (nextTask) {
          notificationScheduler?.scheduleForTask(nextTask, lists);
        }
      } else if (updated) {
        notificationScheduler?.scheduleForTask(updated, lists);
      }
      notificationScheduler?.refreshBundles(
        finalTasks.filter((t) => !t.deleted),
        updated?.date
      );
    },
    [tasks, lists, persistTasks]
  );

  // ── Subtask operations ───────────────────────────────────────────────────

  const addSubtask = useCallback(
    (taskId: string, title: string) => {
      persistTasks(
        tasks.map((t) => {
          if (t.id !== taskId) {
            return t;
          }
          const subtask: Subtask = {
            id: generateId(),
            title,
            completed: false,
            createdAt: Date.now(),
          };
          return {
            ...t,
            subtasks: [...t.subtasks, subtask],
            updatedAt: Date.now(),
          };
        })
      );
    },
    [tasks, persistTasks]
  );

  const toggleSubtask = useCallback(
    (taskId: string, subtaskId: string) => {
      persistTasks(
        tasks.map((t) => {
          if (t.id !== taskId) {
            return t;
          }
          return {
            ...t,
            subtasks: t.subtasks.map((s) =>
              s.id === subtaskId ? { ...s, completed: !s.completed } : s
            ),
            updatedAt: Date.now(),
          };
        })
      );
    },
    [tasks, persistTasks]
  );

  const deleteSubtask = useCallback(
    (taskId: string, subtaskId: string) => {
      persistTasks(
        tasks.map((t) => {
          if (t.id !== taskId) {
            return t;
          }
          return {
            ...t,
            subtasks: t.subtasks.filter((s) => s.id !== subtaskId),
            updatedAt: Date.now(),
          };
        })
      );
    },
    [tasks, persistTasks]
  );

  /** Persists the reordered active-task array as one field on the list's own doc, a
   *  single write no matter how many tasks are in the list, matching reminders-web's
   *  `reorderTasks()`. Tasks' own `order` field is left untouched; it only remains as
   *  the fallback sort key for ids not yet in the array. */
  const reorderTask = useCallback(
    (id: string, listId: string, direction: -1 | 1) => {
      const list = lists.find((l) => l.id === listId);
      if (!list) {
        return;
      }
      const active = tasks.filter(
        (t) => t.listId === listId && !t.completed && !t.deleted
      );
      const sorted = applyOrder(
        active,
        (t) => t.id,
        list.taskOrder,
        (t) => t.order
      );
      const nextOrder = reorderIds(sorted, (t) => t.id, id, direction);
      if (!nextOrder) {
        return;
      }
      persistLists(
        lists.map((l) =>
          l.id === listId
            ? { ...l, taskOrder: nextOrder, updatedAt: Date.now() }
            : l
        )
      );
    },
    [lists, tasks, persistLists]
  );

  const moveTaskUp = useCallback(
    (id: string, listId: string) => reorderTask(id, listId, -1),
    [reorderTask]
  );

  const moveTaskDown = useCallback(
    (id: string, listId: string) => reorderTask(id, listId, 1),
    [reorderTask]
  );

  // ── Backup ───────────────────────────────────────────────────────────────

  const restoreBackup = useCallback(
    async (data: {
      lists: ReminderList[];
      tasks: Task[];
      settings: Settings;
    }) => {
      const incomingTasks = data.tasks.map(normalizeTask);
      const incomingLists = data.lists.map(normalizeList);

      const existingTaskIds = new Set(tasks.map((t) => t.id));
      const mergedTasks = [
        ...tasks,
        ...incomingTasks.filter((t) => !existingTaskIds.has(t.id)),
      ];

      const existingListIds = new Set(lists.map((l) => l.id));
      const mergedLists = [
        ...lists,
        ...incomingLists.filter((l) => !existingListIds.has(l.id)),
      ];

      await Promise.all([persistLists(mergedLists), persistTasks(mergedTasks)]);
      notificationScheduler?.rescheduleAll(
        mergedTasks.filter((t) => !t.deleted),
        mergedLists.filter((l) => !l.deleted)
      );
    },
    [lists, tasks, persistLists, persistTasks]
  );

  // ── Settings ─────────────────────────────────────────────────────────────

  const updateSettings = useCallback(
    (updates: Partial<Settings>) => {
      const next = { ...settings, ...updates, updatedAt: Date.now() };
      persistSettings(next);
    },
    [settings, persistSettings]
  );

  // ── Sync ─────────────────────────────────────────────────────────────────

  /** Full snapshot including soft-deleted tombstones, for the sync engine to
   *  reconcile with the remote side. */
  const snapshotForSync = useCallback(
    (): SyncSnapshot => ({ lists, tasks, settings }),
    [lists, tasks, settings]
  );

  /** Replaces lists/tasks/settings wholesale with the sync engine's reconciled
   *  result. Writes AsyncStorage for all three before touching React state, so a
   *  failure partway through leaves neither memory nor disk reflecting a partial
   *  sync, rather than the UI showing "synced" while only some of it was durably
   *  written. */
  const applySyncedState = useCallback(
    async (
      nextLists: ReminderList[],
      nextTasks: Task[],
      nextSettings: Settings
    ) => {
      await Promise.all([
        AsyncStorage.setItem(LISTS_KEY, JSON.stringify(nextLists)),
        AsyncStorage.setItem(TASKS_KEY, JSON.stringify(nextTasks)),
        AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(nextSettings)),
      ]);
      setLists(nextLists);
      setTasks(nextTasks);
      setSettings(nextSettings);
      notificationScheduler?.rescheduleAll(
        nextTasks.filter((t) => !t.deleted),
        nextLists.filter((l) => !l.deleted)
      );
    },
    []
  );

  // Public view: soft-deleted tombstones are hidden from the rest of the app. Raw
  // state (with tombstones) is only used internally and via snapshotForSync.
  const visibleLists = useMemo(() => lists.filter((l) => !l.deleted), [lists]);
  const visibleTasks = useMemo(() => tasks.filter((t) => !t.deleted), [tasks]);

  return (
    <RemindersContext.Provider
      value={{
        lists: visibleLists,
        tasks: visibleTasks,
        settings,
        loaded,
        addList,
        renameList,
        deleteList,
        moveListUp,
        moveListDown,
        addTask,
        updateTask,
        deleteTask,
        clearCompletedTasks,
        toggleTask,
        moveTaskUp,
        moveTaskDown,
        addSubtask,
        toggleSubtask,
        deleteSubtask,
        restoreBackup,
        updateSettings,
        snapshotForSync,
        applySyncedState,
      }}
    >
      {children}
    </RemindersContext.Provider>
  );
}
