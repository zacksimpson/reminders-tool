import AsyncStorage from "@react-native-async-storage/async-storage";
// biome-ignore lint/performance/noNamespaceImport: expo-notifications is designed for namespace usage
import * as ExpoNotifications from "expo-notifications";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ReminderList, Task } from "@/contexts/RemindersContext";
import {
  compareTasksByDateThenTime,
  getTodayStr,
  getTomorrowStr,
  parseDateStr,
} from "@/utils/dateTime";

// ─── Storage Keys ─────────────────────────────────────────────────────────────

const NOTIF_ENABLED_KEY = "notifications:enabled";
const TODAYS_TASKS_ENABLED_KEY = "notifications:todaysTasks:enabled";
const TODAYS_TASKS_TIME_KEY = "notifications:todaysTasks:time";

function bundleNotifId(dateStr: string): string {
  return `bundle-${dateStr}`;
}

// ─── Foreground handler ───────────────────────────────────────────────────────

ExpoNotifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
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

function parseTime(time24: string): { hour: number; minute: number } {
  const [h, m] = time24.split(":").map(Number);
  return { hour: h, minute: m };
}

function isFuture(dateStr: string, time24: string): boolean {
  const { y, mo, d } = parseDateStr(dateStr);
  const { hour, minute } = parseTime(time24);
  const target = new Date(y, mo - 1, d, hour, minute, 0);
  return target > new Date();
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface NotificationsContextType {
  cancelForTask: (taskId: string) => Promise<void>;
  enabled: boolean;
  permissionDenied: boolean;
  refreshBundles: (tasks: Task[], affectedDate?: string) => Promise<void>;
  rescheduleAll: (tasks: Task[], lists: ReminderList[]) => Promise<void>;
  scheduleForTask: (task: Task, lists: ReminderList[]) => Promise<void>;
  setEnabled: (
    v: boolean,
    tasks: Task[],
    lists: ReminderList[]
  ) => Promise<void>;
  setTodaysTasksEnabled: (
    v: boolean,
    tasks: Task[],
    lists: ReminderList[]
  ) => Promise<void>;
  setTodaysTasksTime: (
    time: string,
    tasks: Task[],
    lists: ReminderList[]
  ) => Promise<void>;
  todaysTasksEnabled: boolean;
  todaysTasksTime: string;
}

const NotificationsContext = createContext<NotificationsContextType | null>(
  null
);

export const useNotifications = () => {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error(
      "useNotifications must be used within NotificationsProvider"
    );
  }
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
  const isReschedulingRef = useRef(false);

  // Load persisted state
  useEffect(() => {
    const load = async () => {
      const [en, tte, ttt] = await Promise.all([
        AsyncStorage.getItem(NOTIF_ENABLED_KEY),
        AsyncStorage.getItem(TODAYS_TASKS_ENABLED_KEY),
        AsyncStorage.getItem(TODAYS_TASKS_TIME_KEY),
      ]);
      if (en) {
        setEnabledState(en === "true");
      }
      if (tte) {
        setTodaysTasksEnabledState(tte === "true");
      }
      if (ttt) {
        setTodaysTasksTimeState(ttt);
      }
    };
    load();
  }, []);

  // Handle Complete action button
  useEffect(() => {
    const sub = ExpoNotifications.addNotificationResponseReceivedListener(
      (response) => {
        const actionId = response.actionIdentifier;
        const data = response.notification.request.content.data as Record<
          string,
          unknown
        >;
        if (actionId === "complete" && data?.taskId) {
          onCompleteTask(data.taskId as string);
        }
      }
    );
    return () => sub.remove();
  }, [onCompleteTask]);

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

  const cancelAll = useCallback(async () => {
    await ExpoNotifications.cancelAllScheduledNotificationsAsync();
  }, []);

  const scheduleForTask = useCallback(
    async (task: Task, lists: ReminderList[]) => {
      if (!(enabled && task.date && task.time) || task.completed) {
        return;
      }
      if (!isFuture(task.date, task.time)) {
        return;
      }

      await ExpoNotifications.cancelScheduledNotificationAsync(task.id).catch(
        () => {
          /* notification may not exist */
        }
      );

      const list = lists.find((l) => l.id === task.listId);
      const { y, mo, d } = parseDateStr(task.date);
      const { hour, minute } = parseTime(task.time);

      await ExpoNotifications.scheduleNotificationAsync({
        identifier: task.id,
        content: {
          title: task.title,
          body: list?.title ?? "",
          data: { listId: task.listId, taskId: task.id },
          categoryIdentifier: "task",
        },
        trigger: {
          type: ExpoNotifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(y, mo - 1, d, hour, minute, 0),
        },
      });
    },
    [enabled]
  );

  const cancelForTask = useCallback(async (taskId: string) => {
    await ExpoNotifications.cancelScheduledNotificationAsync(taskId).catch(
      () => {
        /* notification may not exist */
      }
    );
  }, []);

  const scheduleBundleForDate = useCallback(
    async (
      targetDateStr: string,
      tasks: Task[],
      isEnabled: boolean,
      isTodaysTasksEnabled: boolean,
      time: string
    ) => {
      const id = bundleNotifId(targetDateStr);
      await ExpoNotifications.cancelScheduledNotificationAsync(id).catch(() => {
        /* notification may not exist */
      });

      if (!(isEnabled && isTodaysTasksEnabled)) {
        return;
      }
      if (!isFuture(targetDateStr, time)) {
        return;
      }

      // For any target date, include all incomplete tasks whose date is on or before that
      // date — this mirrors the Today tab, which shows overdue tasks alongside today's.
      const bundleTasks = tasks
        .filter((t) => !t.completed && t.date && t.date <= targetDateStr)
        .sort(compareTasksByDateThenTime);

      if (bundleTasks.length === 0) {
        return;
      }

      const first = bundleTasks[0];
      const rest = bundleTasks.length - 1;
      const body =
        rest > 0 ? `and ${rest} other task${rest === 1 ? "" : "s"}` : "";

      const { hour, minute } = parseTime(time);
      const { y, mo, d } = parseDateStr(targetDateStr);

      await ExpoNotifications.scheduleNotificationAsync({
        identifier: id,
        content: {
          title: first.title,
          body,
          data: { openToday: true },
        },
        trigger: {
          type: ExpoNotifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(y, mo - 1, d, hour, minute, 0),
        },
      });
    },
    []
  );

  const refreshBundles = useCallback(
    async (tasks: Task[], affectedDate?: string) => {
      // Skip if rescheduleAll is in flight — it will handle bundles itself
      if (isReschedulingRef.current) {
        return;
      }

      const todayStr = getTodayStr();
      const tomorrowStr = getTomorrowStr();

      if (affectedDate !== undefined) {
        if (affectedDate <= todayStr) {
          // Task is today or overdue — affects both bundles because today's incomplete
          // tasks become overdue entries in tomorrow's Today view as well
          await scheduleBundleForDate(
            todayStr,
            tasks,
            enabled,
            todaysTasksEnabled,
            todaysTasksTime
          );
          await scheduleBundleForDate(
            tomorrowStr,
            tasks,
            enabled,
            todaysTasksEnabled,
            todaysTasksTime
          );
        } else if (affectedDate === tomorrowStr) {
          // Task is tomorrow — only tomorrow's bundle is affected
          await scheduleBundleForDate(
            tomorrowStr,
            tasks,
            enabled,
            todaysTasksEnabled,
            todaysTasksTime
          );
        }
        // affectedDate is beyond tomorrow — neither bundle is affected, skip entirely
        return;
      }

      // No date hint (e.g. task date may have changed) — refresh both conservatively
      await scheduleBundleForDate(
        todayStr,
        tasks,
        enabled,
        todaysTasksEnabled,
        todaysTasksTime
      );
      await scheduleBundleForDate(
        tomorrowStr,
        tasks,
        enabled,
        todaysTasksEnabled,
        todaysTasksTime
      );
    },
    [enabled, todaysTasksEnabled, todaysTasksTime, scheduleBundleForDate]
  );

  const rescheduleAll = useCallback(
    async (tasks: Task[], lists: ReminderList[]) => {
      isReschedulingRef.current = true;
      try {
        if (!enabled) {
          await cancelAll();
          return;
        }
        await cancelAll();
        for (const task of tasks) {
          if (task.date && task.time && !task.completed) {
            await scheduleForTask(task, lists);
          }
        }
        await scheduleBundleForDate(
          getTodayStr(),
          tasks,
          enabled,
          todaysTasksEnabled,
          todaysTasksTime
        );
        await scheduleBundleForDate(
          getTomorrowStr(),
          tasks,
          enabled,
          todaysTasksEnabled,
          todaysTasksTime
        );
      } finally {
        isReschedulingRef.current = false;
      }
    },
    [
      enabled,
      todaysTasksEnabled,
      todaysTasksTime,
      cancelAll,
      scheduleForTask,
      scheduleBundleForDate,
    ]
  );

  const setEnabled = useCallback(
    async (v: boolean, tasks: Task[], lists: ReminderList[]) => {
      if (v) {
        const granted = await requestPermission();
        if (!granted) {
          return;
        }
      }
      setEnabledState(v);
      await AsyncStorage.setItem(NOTIF_ENABLED_KEY, String(v));
      if (v) {
        await cancelAll();
        for (const task of tasks) {
          if (task.date && task.time && !task.completed) {
            await scheduleForTask(task, lists);
          }
        }
        await scheduleBundleForDate(
          getTodayStr(),
          tasks,
          v,
          todaysTasksEnabled,
          todaysTasksTime
        );
        await scheduleBundleForDate(
          getTomorrowStr(),
          tasks,
          v,
          todaysTasksEnabled,
          todaysTasksTime
        );
      } else {
        await cancelAll();
      }
    },
    [
      requestPermission,
      cancelAll,
      scheduleForTask,
      scheduleBundleForDate,
      todaysTasksEnabled,
      todaysTasksTime,
    ]
  );

  const setTodaysTasksEnabled = useCallback(
    async (v: boolean, tasks: Task[], _lists: ReminderList[]) => {
      setTodaysTasksEnabledState(v);
      await AsyncStorage.setItem(TODAYS_TASKS_ENABLED_KEY, String(v));
      await scheduleBundleForDate(
        getTodayStr(),
        tasks,
        enabled,
        v,
        todaysTasksTime
      );
      await scheduleBundleForDate(
        getTomorrowStr(),
        tasks,
        enabled,
        v,
        todaysTasksTime
      );
    },
    [enabled, todaysTasksTime, scheduleBundleForDate]
  );

  const setTodaysTasksTime = useCallback(
    async (time: string, tasks: Task[], _lists: ReminderList[]) => {
      setTodaysTasksTimeState(time);
      await AsyncStorage.setItem(TODAYS_TASKS_TIME_KEY, time);
      await scheduleBundleForDate(
        getTodayStr(),
        tasks,
        enabled,
        todaysTasksEnabled,
        time
      );
      await scheduleBundleForDate(
        getTomorrowStr(),
        tasks,
        enabled,
        todaysTasksEnabled,
        time
      );
    },
    [enabled, todaysTasksEnabled, scheduleBundleForDate]
  );

  return (
    <NotificationsContext.Provider
      value={{
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
        refreshBundles,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}
