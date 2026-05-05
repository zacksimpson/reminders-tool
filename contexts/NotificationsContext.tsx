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
const TODAYS_TASKS_TIME_KEY = "notifications:todaysTasks:time";
const TODAYS_TASKS_NOTIF_ID_KEY = "notifications:todaysTasks:id";

// ─── Foreground handler — show alerts even when app is open ──────────────────

ExpoNotifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// Set up notification channel
ExpoNotifications.setNotificationChannelAsync("reminders-v2", {
  name: "Reminders",
  importance: ExpoNotifications.AndroidImportance.HIGH,
  vibrationPattern: [0, 80],
  enableVibrate: true,
});

// ─── Action categories ────────────────────────────────────────────────────────

ExpoNotifications.setNotificationCategoryAsync("task", [
  {
    identifier: "complete",
    buttonTitle: "Complete",
    options: { isDestructive: false, isAuthenticationRequired: false },
  },
]);

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
  todaysTasksTime: string;
  permissionDenied: boolean;
  setEnabled: (v: boolean, tasks: Task[], lists: ReminderList[]) => Promise<void>;
  setTodaysTasksEnabled: (v: boolean, tasks: Task[], lists: ReminderList[]) => Promise<void>;
  setTodaysTasksTime: (time: string, tasks: Task[], lists: ReminderList[]) => Promise<void>;
  scheduleForTask: (task: Task, lists: ReminderList[]) => Promise<void>;
  cancelForTask: (taskId: string) => Promise<void>;
  rescheduleAll: (tasks: Task[], lists: ReminderList[]) => Promise<void>;
  handleCompleteAction: (taskId: string) => void;
}

const NotificationsContext = createContext<NotificationsContextType | null>(null);

export const useNotifications = () => {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationsProvider");
  return ctx;
};

// ─── Provider ─────────────────────────────────────────────────────────────────

export function NotificationsProvider({
  children,
  onCompleteTask,
}: {
  children: ReactNode;
  onCompleteTask: (taskId: string) => void;
}) {
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

  // Handle notification action buttons
  useEffect(() => {
    const sub = ExpoNotifications.addNotificationResponseReceivedListener((response) => {
      const actionId = response.actionIdentifier;
      const data = response.notification.request.content.data as Record<string, unknown>;
      if (actionId === "complete" && data?.taskId) {
        onCompleteTask(data.taskId as string);
      }
    });
    return () => sub.remove();
  }, [onCompleteTask]);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    const { status: existing } = await ExpoNotifications.getPermissionsAsync();
    if (existing === "granted") { setPermissionDenied(false); return true; }
    const { status } = await ExpoNotifications.requestPermissionsAsync();
    if (status === "granted") { setPermissionDenied(false); return true; }
    setPermissionDenied(true);
    return false;
  }, []);

  const cancelAll = useCallback(async () => {
    await ExpoNotifications.cancelAllScheduledNotificationsAsync();
  }, []);

  const scheduleForTask = useCallback(async (task: Task, lists: ReminderList[]) => {
    if (!enabled || !task.date || !task.time || task.completed) return;
    if (!isFuture(task.date, task.time)) return;

    await ExpoNotifications.cancelScheduledNotificationAsync(task.id).catch(() => {});

    const list = lists.find(l => l.id === task.listId);
    const { year, month, day } = parseDate(task.date);
    const { hour, minute } = parseTime(task.time);

    await ExpoNotifications.scheduleNotificationAsync({
      identifier: task.id,
      content: {
        title: task.title,
        body: list?.title ?? "",
        data: { listId: task.listId, taskId: task.id },
        categoryIdentifier: "task",
        channelId: "reminders-v2",
      },
      trigger: {
        type: ExpoNotifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(year, month - 1, day, hour, minute, 0),
      },
    });
  }, [enabled]);

  const cancelForTask = useCallback(async (taskId: string) => {
    await ExpoNotifications.cancelScheduledNotificationAsync(taskId).catch(() => {});
  }, []);

  const scheduleTodaysBundle = useCallback(async (
    tasks: Task[],
    lists: ReminderList[],
    isEnabled: boolean,
    isTodaysTasksEnabled: boolean,
    time: string,
  ) => {
    // Cancel existing bundle
    const existingId = await AsyncStorage.getItem(TODAYS_TASKS_NOTIF_ID_KEY);
    if (existingId) {
      await ExpoNotifications.cancelScheduledNotificationAsync(existingId).catch(() => {});
      await AsyncStorage.removeItem(TODAYS_TASKS_NOTIF_ID_KEY);
    }

    if (!isEnabled || !isTodaysTasksEnabled) return;
    if (!isFuture(getTodayStr(), time)) return;

    const todayStr = getTodayStr();
    const todayUntimed = tasks
      .filter(t => t.date === todayStr && !t.time && !t.completed)
      .sort((a, b) => a.order - b.order);

    if (todayUntimed.length === 0) return;

    const first = todayUntimed[0];
    const rest = todayUntimed.length - 1;
    const body = rest > 0 ? `and ${rest} other Task${rest === 1 ? "" : "s"}` : "";

    const { hour, minute } = parseTime(time);
    const now = new Date();
    const trigger = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0);

    const id = await ExpoNotifications.scheduleNotificationAsync({
      content: {
        title: first.title,
        body,
        data: { openToday: true },
        channelId: "reminders-v2",
      },
      trigger: {
        type: ExpoNotifications.SchedulableTriggerInputTypes.DATE,
        date: trigger,
      },
    });

    await AsyncStorage.setItem(TODAYS_TASKS_NOTIF_ID_KEY, id);
  }, []);

  const rescheduleAll = useCallback(async (tasks: Task[], lists: ReminderList[]) => {
    if (!enabled) { await cancelAll(); return; }
    await cancelAll();
    for (const task of tasks) {
      if (task.date && task.time && !task.completed) {
        await scheduleForTask(task, lists);
      }
    }
    await scheduleTodaysBundle(tasks, lists, enabled, todaysTasksEnabled, todaysTasksTime);
  }, [enabled, todaysTasksEnabled, todaysTasksTime, cancelAll, scheduleForTask, scheduleTodaysBundle]);

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
      await cancelAll();
      for (const task of tasks) {
        if (task.date && task.time && !task.completed) await scheduleForTask(task, lists);
      }
      await scheduleTodaysBundle(tasks, lists, v, todaysTasksEnabled, todaysTasksTime);
    }
  }, [requestPermission, cancelAll, scheduleForTask, scheduleTodaysBundle, todaysTasksEnabled, todaysTasksTime]);

  const setTodaysTasksEnabled = useCallback(async (v: boolean, tasks: Task[], lists: ReminderList[]) => {
    setTodaysTasksEnabledState(v);
    await AsyncStorage.setItem(TODAYS_TASKS_ENABLED_KEY, String(v));
    await scheduleTodaysBundle(tasks, lists, enabled, v, todaysTasksTime);
  }, [enabled, todaysTasksTime, scheduleTodaysBundle]);

  const setTodaysTasksTime = useCallback(async (time: string, tasks: Task[], lists: ReminderList[]) => {
    setTodaysTasksTimeState(time);
    await AsyncStorage.setItem(TODAYS_TASKS_TIME_KEY, time);
    await scheduleTodaysBundle(tasks, lists, enabled, todaysTasksEnabled, time);
  }, [enabled, todaysTasksEnabled, scheduleTodaysBundle]);

  const handleCompleteAction = useCallback((taskId: string) => {
    onCompleteTask(taskId);
  }, [onCompleteTask]);

  return (
    <NotificationsContext.Provider value={{
      enabled, todaysTasksEnabled, todaysTasksTime, permissionDenied,
      setEnabled, setTodaysTasksEnabled, setTodaysTasksTime,
      scheduleForTask, cancelForTask, rescheduleAll, handleCompleteAction,
    }}>
      {children}
    </NotificationsContext.Provider>
  );
}
