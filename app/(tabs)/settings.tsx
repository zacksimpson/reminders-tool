import { router } from "expo-router";
import { Animated, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { HapticPressable } from "@/components/HapticPressable";
import { Header } from "@/components/Header";
import { StyledText } from "@/components/StyledText";
import { useInvertColors } from "@/contexts/InvertColorsContext";
import {
  scrollIndicatorBaseStyles,
  useScrollIndicator,
} from "@/hooks/useScrollIndicator";
import { n } from "@/utils/scaling";

export default function SettingsScreen() {
  const { invertColors } = useInvertColors();
  const bg = invertColors ? "white" : "black";
  const textColor = invertColors ? "black" : "white";
  const {
    handleScroll,
    scrollIndicatorHeight,
    scrollIndicatorPosition,
    setContentHeight,
    setScrollViewHeight,
  } = useScrollIndicator();

  return (
    <SafeAreaView
      edges={["top"]}
      style={[styles.container, { backgroundColor: bg }]}
    >
      <Header headerTitle="Settings" hideBackButton />

      <View style={styles.scrollWrapper}>
        <Animated.ScrollView
          onLayout={(e) => setScrollViewHeight(e.nativeEvent.layout.height)}
          onScroll={handleScroll}
          overScrollMode="never"
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
        >
          <View onLayout={(e) => setContentHeight(e.nativeEvent.layout.height)}>
            {/* Account */}
            <HapticPressable
              onPress={() => router.push("/settings/account")}
              style={styles.row}
            >
              <StyledText style={styles.selectorValue}>Account</StyledText>
            </HapticPressable>

            {/* Notifications */}
            <HapticPressable
              onPress={() => router.push("/settings/notifications")}
              style={styles.row}
            >
              <StyledText style={styles.selectorValue}>
                Notifications
              </StyledText>
            </HapticPressable>

            {/* Task Behaviors */}
            <HapticPressable
              onPress={() => router.push("/settings/task-behaviors")}
              style={styles.row}
            >
              <StyledText style={styles.selectorValue}>
                Task Behaviors
              </StyledText>
            </HapticPressable>

            {/* Backup */}
            <HapticPressable
              onPress={() => router.push("/settings/backup")}
              style={styles.row}
            >
              <StyledText style={styles.selectorValue}>
                Backup & Restore
              </StyledText>
            </HapticPressable>
          </View>
        </Animated.ScrollView>

        {scrollIndicatorHeight > 0 && (
          <View style={[styles.scrollTrack, { backgroundColor: textColor }]}>
            <Animated.View
              style={[
                styles.scrollThumb,
                {
                  backgroundColor: textColor,
                  height: scrollIndicatorHeight,
                  transform: [{ translateY: scrollIndicatorPosition }],
                },
              ]}
            />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollWrapper: { flex: 1, flexDirection: "row", position: "relative" },
  scrollTrack: scrollIndicatorBaseStyles.track,
  scrollThumb: scrollIndicatorBaseStyles.thumb,
  row: {
    paddingHorizontal: n(22),
    paddingVertical: n(16),
    flexDirection: "column",
    alignItems: "flex-start",
  },
  selectorValue: {
    fontSize: n(30),
    paddingBottom: n(10),
  },
});
