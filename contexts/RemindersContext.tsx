import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { formatISODate, parseDateStr } from "@/utils/dateTime";

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
  id: string;
  listId: string;
  order: number;
  recurrence?: Recurrence;
  subtasks: Subtask[];
  time?: string; // "HH:MM" 24h
  title: string;
}

export interface ReminderList {
  createdAt: number;
  id: string;
  order: number;
  title: string;
}

export interface Settings {
  addPosition: "top" | "bottom";
  afterAddBehavior: "toast" | "go-to-list";
  defaultListId: string;
  showOverdue: boolean;
}

// ─── Storage Keys ─────────────────────────────────────────────────────────────

const LISTS_KEY = "reminders:lists";
const TASKS_KEY = "reminders:tasks";
const SETTINGS_KEY = "reminders:settings";

// ─── Default Data ─────────────────────────────────────────────────────────────

const DEFAULT_LIST: ReminderList = {
  id: "inbox",
  title: "Inbox",
  createdAt: Date.now(),
  order: 0,
};

const DEFAULT_SETTINGS: Settings = {
  defaultListId: "inbox",
  afterAddBehavior: "toast",
  addPosition: "bottom",
  showOverdue: true,
};

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
    task: Omit<Task, "id" | "createdAt" | "order" | "subtasks" | "completed">
  ) => Task;

  // Bulk task operations
  clearCompletedTasks: (listId: string) => void;
  deleteList: (id: string) => void;
  deleteSubtask: (taskId: string, subtaskId: string) => void;
  deleteTask: (id: string) => void;
  lists: ReminderList[];
  loaded: boolean;
  moveListDown: (id: string) => void;
  moveListUp: (id: string) => void;
  renameList: (id: string, title: string) => void;
  settings: Settings;

  // Task reordering
  swapTaskOrder: (idA: string, idB: string) => void;
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
  return {
    id: generateId(),
    title: task.title,
    listId: task.listId,
    date: nextDate,
    time: task.time,
    recurrence: task.recurrence,
    completed: false,
    createdAt: Date.now(),
    order: task.order,
    subtasks: task.subtasks.map((s) => ({ ...s, completed: false })),
  };
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function RemindersProvider({ children }: { children: ReactNode }) {
  const [lists, setLists] = useState<ReminderList[]>([DEFAULT_LIST]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  // Load from AsyncStorage on mount
  useEffect(() => {
    const load = async () => {
      const [rawLists, rawTasks, rawSettings] = await Promise.all([
        AsyncStorage.getItem(LISTS_KEY),
        AsyncStorage.getItem(TASKS_KEY),
        AsyncStorage.getItem(SETTINGS_KEY),
      ]);

      try {
        if (rawLists) {
          setLists(JSON.parse(rawLists));
        }
      } catch {
        /* ignore corrupt data, keep default */
      }
      try {
        if (rawTasks) {
          setTasks(JSON.parse(rawTasks));
        }
      } catch {
        /* ignore corrupt data, keep default */
      }
      try {
        if (rawSettings) {
          setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(rawSettings) });
        }
      } catch {
        /* ignore corrupt data, keep default */
      }
      setLoaded(true);
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
      const next = [
        ...lists,
        {
          id: generateId(),
          title,
          createdAt: Date.now(),
          order: lists.length,
        },
      ];
      persistLists(next);
    },
    [lists, persistLists]
  );

  const renameList = useCallback(
    (id: string, title: string) => {
      persistLists(lists.map((l) => (l.id === id ? { ...l, title } : l)));
    },
    [lists, persistLists]
  );

  const deleteList = useCallback(
    (id: string) => {
      // Move tasks from deleted list to default list
      const defaultId = settings.defaultListId;
      persistLists(lists.filter((l) => l.id !== id));
      persistTasks(
        tasks.map((t) => (t.listId === id ? { ...t, listId: defaultId } : t))
      );
    },
    [lists, tasks, settings.defaultListId, persistLists, persistTasks]
  );

  const moveListUp = useCallback(
    (id: string) => {
      const sorted = [...lists].sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex((l) => l.id === id);
      if (idx <= 0) {
        return;
      }
      const next = sorted.map((l, i) => {
        if (i === idx - 1) {
          return { ...l, order: idx };
        }
        if (i === idx) {
          return { ...l, order: idx - 1 };
        }
        return l;
      });
      persistLists(next);
    },
    [lists, persistLists]
  );

  const moveListDown = useCallback(
    (id: string) => {
      const sorted = [...lists].sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex((l) => l.id === id);
      if (idx < 0 || idx >= sorted.length - 1) {
        return;
      }
      const next = sorted.map((l, i) => {
        if (i === idx) {
          return { ...l, order: idx + 1 };
        }
        if (i === idx + 1) {
          return { ...l, order: idx };
        }
        return l;
      });
      persistLists(next);
    },
    [lists, persistLists]
  );

  // ── Task operations ──────────────────────────────────────────────────────

  const addTask = useCallback(
    (
      task: Omit<Task, "id" | "createdAt" | "order" | "completed"> & {
        subtasks?: Subtask[];
      }
    ): Task => {
      const listTasks = tasks.filter((t) => t.listId === task.listId);
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
      const newTask: Task = {
        ...task,
        id: generateId(),
        createdAt: Date.now(),
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
        t.id === id ? { ...t, ...updates } : t
      );
      persistTasks(updatedTasks);
      const updated = updatedTasks.find((t) => t.id === id);
      if (updated) {
        notificationScheduler?.cancelForTask(id);
        notificationScheduler?.scheduleForTask(updated, lists);
      }
      // Pass undefined — the date may have changed, so refresh both bundles conservatively
      notificationScheduler?.refreshBundles(updatedTasks, undefined);
    },
    [tasks, lists, persistTasks]
  );

  const deleteTask = useCallback(
    (id: string) => {
      const deletedDate = tasks.find((t) => t.id === id)?.date;
      const remaining = tasks.filter((t) => t.id !== id);
      persistTasks(remaining);
      notificationScheduler?.cancelForTask(id);
      notificationScheduler?.refreshBundles(remaining, deletedDate);
    },
    [tasks, persistTasks]
  );

  const clearCompletedTasks = useCallback(
    (listId: string) => {
      const remaining = tasks.filter(
        (t) => !(t.listId === listId && t.completed)
      );
      const removed = tasks.filter((t) => t.listId === listId && t.completed);
      persistTasks(remaining);
      for (const t of removed) {
        notificationScheduler?.cancelForTask(t.id);
      }
      // Completed tasks are filtered out of bundles so content won't change,
      // but call for consistency with all other mutations
      notificationScheduler?.refreshBundles(remaining, undefined);
    },
    [tasks, persistTasks]
  );

  const toggleTask = useCallback(
    (id: string) => {
      const updatedTasks = tasks.map((t) => {
        if (t.id !== id) {
          return t;
        }
        if (t.completed) {
          const { completedAt: _, ...rest } = t;
          return { ...rest, completed: false };
        }
        return { ...t, completed: true, completedAt: Date.now() };
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
      notificationScheduler?.refreshBundles(finalTasks, updated?.date);
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
          return { ...t, subtasks: [...t.subtasks, subtask] };
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
          };
        })
      );
    },
    [tasks, persistTasks]
  );

  const swapTaskOrder = useCallback(
    (idA: string, idB: string) => {
      const taskA = tasks.find((t) => t.id === idA);
      const taskB = tasks.find((t) => t.id === idB);
      if (!(taskA && taskB)) {
        return;
      }
      const orderA = taskA.order;
      const orderB = taskB.order;
      persistTasks(
        tasks.map((t) => {
          if (t.id === idA) {
            return { ...t, order: orderB };
          }
          if (t.id === idB) {
            return { ...t, order: orderA };
          }
          return t;
        })
      );
    },
    [tasks, persistTasks]
  );

  // ── Settings ─────────────────────────────────────────────────────────────

  const updateSettings = useCallback(
    (updates: Partial<Settings>) => {
      const next = { ...settings, ...updates };
      persistSettings(next);
    },
    [settings, persistSettings]
  );

  return (
    <RemindersContext.Provider
      value={{
        lists,
        tasks,
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
        swapTaskOrder,
        addSubtask,
        toggleSubtask,
        deleteSubtask,
        updateSettings,
      }}
    >
      {children}
    </RemindersContext.Provider>
  );
}
