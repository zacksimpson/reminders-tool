import { router, useLocalSearchParams } from "expo-router";
import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Header } from "@/components/Header";
import { HapticPressable } from "@/components/HapticPressable";
import { StyledText } from "@/components/StyledText";
import { SwipeBackContainer } from "@/components/SwipeBackContainer";
import { useInvertColors } from "@/contexts/InvertColorsContext";
import { useReminders } from "@/contexts/RemindersContext";
import { n } from "@/utils/scaling";

export default function TaskActionsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { invertColors } = useInvertColors();
  const { tasks, toggleTask } = useReminders();
  const bg = invertColors ? "white" : "black";

  const task = tasks.find(t => t.id === id);
  const listId = task?.listId ?? "";

  const handleMarkComplete = () => {
    toggleTask(id);
    router.back();
  };

  return (
    <SwipeBackContainer onSwipeBack={() => router.back()}>
      <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={["top"]}>
        <Header headerTitle="Edit Task" />

        <HapticPressable onPress={handleMarkComplete} style={styles.option}>
          <StyledText style={styles.optionText}>
            {task?.completed ? "Mark as Incomplete" : "Mark as Completed"}
          </StyledText>
        </HapticPressable>

        <HapticPressable
          onPress={() => router.push({ pathname: "/task/[id]", params: { id } })}
          style={styles.option}
        >
          <StyledText style={styles.optionText}>Edit Details</StyledText>
        </HapticPressable>

        <HapticPressable
          onPress={() => { router.back(); }}
          style={styles.option}
        >
          <StyledText style={styles.optionText}>Reorder Tasks</StyledText>
        </HapticPressable>

        <HapticPressable
          onPress={() => router.push({
            pathname: "/confirm",
            params: {
              message: `Are you sure you want to delete "${task?.title}"?`,
              confirmText: "Delete",
              action: `delete-task:${id}`,
              returnPath: `/list/${listId}`,
            },
          })}
          style={styles.option}
        >
          <StyledText style={styles.optionText}>Delete Task</StyledText>
        </HapticPressable>

      </SafeAreaView>
    </SwipeBackContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  option: {
    paddingHorizontal: n(22),
    paddingVertical: n(14),
  },
  optionText: {
    fontSize: n(30),
  },
});
