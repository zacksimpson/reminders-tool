import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { HapticPressable } from "@/components/HapticPressable";
import { Header } from "@/components/Header";
import { StyledText } from "@/components/StyledText";
import { SwipeBackContainer } from "@/components/SwipeBackContainer";
import { useInvertColors } from "@/contexts/InvertColorsContext";
import { useReminders } from "@/contexts/RemindersContext";
import { n } from "@/utils/scaling";

const OPTIONS = [
  { label: "Top of List", value: "top" },
  { label: "Bottom of List", value: "bottom" },
] as const;

export default function AddPositionScreen() {
  const { invertColors } = useInvertColors();
  const { settings, updateSettings } = useReminders();
  const bg = invertColors ? "white" : "black";

  const handleSelect = (value: string) => {
    updateSettings({ addPosition: value as "top" | "bottom" });
    router.back();
  };

  return (
    <SwipeBackContainer onSwipeBack={() => router.back()}>
      <SafeAreaView
        edges={["top"]}
        style={[styles.container, { backgroundColor: bg }]}
      >
        <Header headerTitle="Add New Tasks" />
        <View style={styles.options}>
          {OPTIONS.map((option) => {
            const isSelected =
              (settings.addPosition ?? "bottom") === option.value;
            return (
              <HapticPressable
                key={option.value}
                onPress={() => handleSelect(option.value)}
                style={styles.optionRow}
              >
                <StyledText
                  style={[
                    styles.optionText,
                    isSelected && styles.optionSelected,
                  ]}
                >
                  {option.label}
                </StyledText>
              </HapticPressable>
            );
          })}
        </View>
      </SafeAreaView>
    </SwipeBackContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  options: {
    paddingHorizontal: n(22),
    paddingTop: n(8),
  },
  optionRow: {
    paddingVertical: n(12),
  },
  optionText: {
    fontSize: n(30),
  },
  optionSelected: {
    textDecorationLine: "underline",
  },
});
