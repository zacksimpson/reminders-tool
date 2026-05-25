import { type Href, router, useLocalSearchParams } from "expo-router";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { HapticPressable } from "@/components/HapticPressable";
import { Header } from "@/components/Header";
import { StyledText } from "@/components/StyledText";
import { SwipeBackContainer } from "@/components/SwipeBackContainer";
import { useInvertColors } from "@/contexts/InvertColorsContext";
import { n } from "@/utils/scaling";

export default function ConfirmScreen() {
  const { invertColors } = useInvertColors();
  const params = useLocalSearchParams<{
    title: string;
    message: string;
    confirmText: string;
    action: string;
    returnPath: string;
  }>();

  const bg = invertColors ? "white" : "black";
  const textColor = invertColors ? "black" : "white";

  const handleConfirm = () => {
    const path = (params.returnPath || "/(tabs)/") as Href;
    // Dismiss all screens above the return path (e.g. task-actions + confirm)
    // so the back gesture never resurfaces dead confirmation screens.
    router.dismissTo({
      pathname: path,
      params: {
        confirmed: "true",
        action: params.action ?? "",
      },
      // biome-ignore lint/suspicious/noExplicitAny: expo-router dismissTo with dynamic pathname requires any
    } as any);
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    }
  };

  return (
    <SwipeBackContainer enabled onSwipeBack={handleBack}>
      <SafeAreaView
        edges={["top"]}
        style={[styles.container, { backgroundColor: bg }]}
      >
        {/* Back arrow only — no title */}
        <Header />

        {/* Message centered in the screen */}
        <View style={styles.messageContainer}>
          <StyledText style={styles.messageText}>{params.message}</StyledText>
        </View>

        {/* Confirm button pinned to bottom */}
        <HapticPressable onPress={handleConfirm} style={styles.confirmBtn}>
          <StyledText style={[styles.confirmText, { color: textColor }]}>
            {(params.confirmText || "Confirm").toUpperCase()}
          </StyledText>
        </HapticPressable>
      </SafeAreaView>
    </SwipeBackContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  messageContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: n(80),
    paddingHorizontal: n(40),
  },
  messageText: {
    fontSize: n(22),
    textAlign: "center",
    lineHeight: n(32),
  },
  confirmBtn: {
    alignItems: "center",
    paddingBottom: n(28),
  },
  confirmText: {
    fontSize: n(24),
    letterSpacing: n(5),
  },
});
