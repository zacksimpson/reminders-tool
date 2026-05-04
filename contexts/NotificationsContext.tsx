import * as ExpoNotifications from "expo-notifications";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Task, ReminderList } from "@/contexts/RemindersContext";

// ─── Storage Keys ─────────────────────────────────────────────────────────────

const NOTIF_ENABLED_KEY = "notifications:enabled";
const TODAYS_TASKS_ENABLED_KEY = "notifications:todaysTasks:enabled";
const TODAYS_TASKS_TIME_KEY = "notifications:todaysTasks:time"; // "HH:MM" 24h
const TODAYS_TASKS_NOTIF_ID_KEY = "notifications:todaysTasks:id";

// ─── Default handler ──────────────────────────────────────────────────────────

ExpoNotifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTodayStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function parseTime(time24: string): { hour: number; minute: number } {
  const [h, m] = time24.split(":").map(Number);
  return { hour: h, minute: m };
}

function parseDate(dateStr: string): { year: number; month: number; day: number } {
  const [y, mo, d] = dateStr.split("-").map(Number);
  return { year: y, month: mo, day: d };
}

function isFuture(dateStr: string, time24: string): boolean {
  const { year, month, day } = parseDate(dateStr);
  const { hour, minute } = parseTime(time24);
  const target = new Date(year, month - 1, day, hour, minute, 0);
  return target > new Date();
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface NotificationsContextType {
  enabled: boolean;
  todaysTasksEnabled: boolean;
  todaysTasksTime: string; // "HH:MM" 24h
  permissionDenied: boolean;
  setEnabled: (v: boolean, tasks: Task[], lists: ReminderList[]) => Promise<void>;
  setTodaysTasksEnabled: (v: boolean, tasks: Task[], lists: ReminderList[]) => Promise<void>;
  setTodaysTasksTime: (time: string, tasks: Task[], lists: ReminderList[]) => Promise<void>;
  scheduleForTask: (task: Task, lists: ReminderList[]) => Promise<void>;
  cancelForTask: (taskId: string) => Promise<void>;
  rescheduleAll: (tasks: Task[], lists: ReminderList[]) => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextType | null>(null);

export const useNotifications = () => {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationsProvider");
  return ctx;
};

// ─── Provider ─────────────────────────────────────────────────────────────────

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabledState] = useState(false);
  const [todaysTasksEnabled, setTodaysTasksEnabledState] = useState(false);
  const [todaysTasksTime, setTodaysTasksTimeState] = useState("09:00");
  const [permissionDenied, setPermissionDenied] = useState(false);

  // Load persisted state
  useEffect(() => {
    const load = async () => {
      const [en, tte, ttt] = await Promise.all([
        AsyncStorage.getItem(NOTIF_ENABLED_KEY),
        AsyncStorage.getItem(TODAYS_TASKS_ENABLED_KEY),
        AsyncStorage.getItem(TODAYS_TASKS_TIME_KEY),
      ]);
      if (en) setEnabledState(en === "true");
      if (tte) setTodaysTasksEnabledState(tte === "true");
      if (ttt) setTodaysTasksTimeState(ttt);
    };
    load();
  }, []);

  // Request permission and return whether granted
  const requestPermission = useCallback(async (): Promise<boolean> => {
    const { status: existing } = await ExpoNotifications.getPermissionsAsync();
    if (existing === "granted") {
      setPermissionDenied(false);
      return true;
    }
    const { status } = await ExpoNotifications.requestPermissionsAsync();
    if (status === "granted") {
      setPermissionDenied(false);
      return true;
    }
    setPermissionDenied(true);
    return false;
  }, []);

  // Cancel all scheduled notifications
  const cancelAll = useCallback(async () => {
    await ExpoNotifications.cancelAllScheduledNotificationsAsync();
  }, []);

  // Schedule a notification for a single task with a specific time
  const scheduleForTask = useCallback(async (task: Task, lists: ReminderList[]) => {
    if (!enabled || !task.date || !task.time || task.completed) return;
    if (!isFuture(task.date, task.time)) return;

    // Cancel any existing notification for this task first
    await ExpoNotifications.cancelScheduledNotificationAsync(task.id).catch(() => {});

    const list = lists.find(l => l.id === task.listId);
    const { year, month, day } = parseDate(task.date);
    const { hour, minute } = parseTime(task.time);

    await ExpoNotifications.scheduleNotificationAsync({
      identifier: task.id,
      content: {
        title: task.title,
        body: list?.title ?? "",
        data: { listId: task.listId },
      },
      trigger: {
        type: ExpoNotifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(year, month - 1, day, hour, minute, 0),
      },
    });
  }, [enabled]);

  // Cancel notification for a specific task
  const cancelForTask = useCallback(async (taskId: string) => {
    await ExpoNotifications.cancelScheduledNotificationAsync(taskId).catch(() => {});
  }, []);

  // Schedule the Today's Tasks bundle notification
  const scheduleTodaysBundle = useCallback(async (tasks: Task[], lists: ReminderList[]) => {
    // Cancel existing bundle
    const existingId = await AsyncStorage.getItem(TODAYS_TASKS_NOTIF_ID_KEY);
    if (existingId) {
      await ExpoNotifications.cancelScheduledNotificationAsync(existingId).catch(() => {});
    }

    if (!enabled || !todaysTasksEnabled) return;
    if (!isFuture(getTodayStr(), todaysTasksTime)) return;

    const todayStr = getTodayStr();
    const todayUntimed = tasks.filter(
      t => t.date === todayStr && !t.time && !t.completed
    ).sort((a, b) => a.order - b.order);

    if (todayUntimed.length === 0) return;

    const first = todayUntimed[0];
    const rest = todayUntimed.length - 1;
    const body = rest > 0 ? `and ${rest} other Task${rest === 1 ? "" : "s"}` : "";

    const { hour, minute } = parseTime(todaysTasksTime);
    const now = new Date();
    const trigger = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0);

    const id = await ExpoNotifications.scheduleNotificationAsync({
      content: {
        title: first.title,
        body,
        data: { openToday: true },
      },
      trigger: {
        type: ExpoNotifications.SchedulableTriggerInputTypes.DATE,
        date: trigger,
      },
    });

    await AsyncStorage.setItem(TODAYS_TASKS_NOTIF_ID_KEY, id);
  }, [enabled, todaysTasksEnabled, todaysTasksTime]);

  // Reschedule everything from scratch
  const rescheduleAll = useCallback(async (tasks: Task[], lists: ReminderList[]) => {
    if (!enabled) {
      await cancelAll();
      return;
    }
    // Cancel all first
    await cancelAll();
    // Schedule individual timed tasks
    for (const task of tasks) {
      if (task.date && task.time && !task.completed) {
        await scheduleForTask(task, lists);
      }
    }
    // Schedule today's bundle
    await scheduleTodaysBundle(tasks, lists);
  }, [enabled, cancelAll, scheduleForTask, scheduleTodaysBundle]);

  // Enable/disable master toggle
  const setEnabled = useCallback(async (v: boolean, tasks: Task[], lists: ReminderList[]) => {
    if (v) {
      const granted = await requestPermission();
      if (!granted) return;
    }
    setEnabledState(v);
    await AsyncStorage.setItem(NOTIF_ENABLED_KEY, String(v));
    if (!v) {
      await cancelAll();
    } else {
      await rescheduleAll(tasks, lists);
    }
  }, [requestPermission, cancelAll, rescheduleAll]);

  // Enable/disable today's tasks toggle
  const setTodaysTasksEnabled = useCallback(async (v: boolean, tasks: Task[], lists: ReminderList[]) => {
    setTodaysTasksEnabledState(v);
    await AsyncStorage.setItem(TODAYS_TASKS_ENABLED_KEY, String(v));
    if (v) {
      await scheduleTodaysBundle(tasks, lists);
    } else {
      const existingId = await AsyncStorage.getItem(TODAYS_TASKS_NOTIF_ID_KEY);
      if (existingId) {
        await ExpoNotifications.cancelScheduledNotificationAsync(existingId).catch(() => {});
        await AsyncStorage.removeItem(TODAYS_TASKS_NOTIF_ID_KEY);
      }
    }
  }, [scheduleTodaysBundle]);

  // Update today's tasks time
  const setTodaysTasksTime = useCallback(async (time: string, tasks: Task[], lists: ReminderList[]) => {
    setTodaysTasksTimeState(time);
    await AsyncStorage.setItem(TODAYS_TASKS_TIME_KEY, time);
    await scheduleTodaysBundle(tasks, lists);
  }, [scheduleTodaysBundle]);

  return (
    <NotificationsContext.Provider value={{
      enabled,
      todaysTasksEnabled,
      todaysTasksTime,
      permissionDenied,
      setEnabled,
      setTodaysTasksEnabled,
      setTodaysTasksTime,
      scheduleForTask,
      cancelForTask,
      rescheduleAll,
    }}>
      {children}
    </NotificationsContext.Provider>
  );
}
