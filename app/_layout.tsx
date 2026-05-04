import * as ExpoNotifications from "expo-notifications";
import { router, Stack } from "expo-router";
import { useEffect } from "react";
import { StatusBar } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  InvertColorsProvider,
  useInvertColors,
} from "@/contexts/InvertColorsContext";
import { NotificationsProvider } from "@/contexts/NotificationsContext";
import { NotificationsBridge } from "@/components/NotificationsBridge";
import { RemindersProvider } from "@/contexts/RemindersContext";

function RootLayout() {
  const { invertColors } = useInvertColors();

  // Handle notification taps
  useEffect(() => {
    const sub = ExpoNotifications.addNotificationResponseReceivedListener((response) => {
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

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <InvertColorsProvider>
        <RemindersProvider>
          <NotificationsProvider>
            <NotificationsBridge />
            <StatusBar hidden />
            <RootLayout />
          </NotificationsProvider>
        </RemindersProvider>
      </InvertColorsProvider>
    </GestureHandlerRootView>
  );
}
