import * as ExpoNotifications from "expo-notifications";
import { router, Stack } from "expo-router";
import { useCallback, useEffect } from "react";
import { StatusBar } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  InvertColorsProvider,
  useInvertColors,
} from "@/contexts/InvertColorsContext";
import { NotificationsProvider } from "@/contexts/NotificationsContext";
import { NotificationsBridge } from "@/components/NotificationsBridge";
import { RemindersProvider, useReminders } from "@/contexts/RemindersContext";

function RootLayout() {
  const { invertColors } = useInvertColors();

  // Handle notification taps (navigation)
  useEffect(() => {
    const sub = ExpoNotifications.addNotificationResponseReceivedListener((response) => {
      const actionId = response.actionIdentifier;
      // Only navigate on default tap, not action buttons
      if (actionId !== ExpoNotifications.DEFAULT_ACTION_IDENTIFIER) return;

      const data = response.notification.request.content.data as Record<string, unknown>;
      if (data?.openToday) {
        router.navigate("/(tabs)/today");
      } else if (data?.listId) {
        router.navigate({
          pathname: "/list/[id]",
          params: { id: data.listId as string },
        });
      }
    });
    return () => sub.remove();
  }, []);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "none",
        contentStyle: {
          backgroundColor: invertColors ? "white" : "black",
        },
      }}
    />
  );
}

function AppWithReminders() {
  const { toggleTask } = useReminders();

  const handleCompleteTask = useCallback((taskId: string) => {
    toggleTask(taskId);
  }, [toggleTask]);

  return (
    <NotificationsProvider onCompleteTask={handleCompleteTask}>
      <NotificationsBridge />
      <StatusBar hidden />
      <RootLayout />
    </NotificationsProvider>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <InvertColorsProvider>
        <RemindersProvider>
          <AppWithReminders />
        </RemindersProvider>
      </InvertColorsProvider>
    </GestureHandlerRootView>
  );
}
