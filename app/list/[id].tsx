import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AddTaskModal } from "@/components/AddTaskModal";
import { HapticPressable } from "@/components/HapticPressable";
import { Header } from "@/components/Header";
import { StyledText } from "@/components/StyledText";
import { SwipeBackContainer } from "@/components/SwipeBackContainer";
import { TaskRow } from "@/components/TaskRow";
import { useInvertColors } from "@/contexts/InvertColorsContext";
import { useReminders } from "@/contexts/RemindersContext";
import {
  scrollIndicatorBaseStyles,
  useScrollIndicator,
} from "@/hooks/useScrollIndicator";
import { n } from "@/utils/scaling";

export default function ListScreen() {
  const { id, startReorder, confirmed, action } = useLocalSearchParams<{
    id: string;
    startReorder?: string;
    confirmed?: string;
    action?: string;
  }>();
  const { invertColors } = useInvertColors();
  const { lists, tasks, toggleTask, deleteTask, swapTaskOrder } =
    useReminders();
  const bg = invertColors ? "white" : "black";
  const textColor = invertColors ? "black" : "white";
  const [showCompleted, setShowCompleted] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [isReordering, setIsReordering] = useState(false);
  const {
    handleScroll,
    scrollIndicatorHeight,
    scrollIndicatorPosition,
    setContentHeight,
    setScrollViewHeight,
  } = useScrollIndicator();

  const list = lists.find((l) => l.id === id);
  const listTitle = list?.title ?? "List";
  const listTasks = tasks.filter((t) => t.listId === id);
  const active = listTasks
    .filter((t) => !t.completed)
    .sort((a, b) => a.order - b.order);
  const completed = listTasks
    .filter((t) => t.completed)
    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));

  // Handle startReorder param from task-actions
  useEffect(() => {
    if (startReorder === "true") {
      setIsReordering(true);
      router.setParams({ startReorder: undefined });
    }
  }, [startReorder]);

  // Handle delete task confirmed
  useEffect(() => {
    if (confirmed === "true" && action?.startsWith("delete-task:")) {
      const taskId = action.replace("delete-task:", "");
      deleteTask(taskId);
      router.setParams({ confirmed: undefined, action: undefined });
    }
  }, [confirmed, action, deleteTask]);

  const moveTaskUp = (taskId: string) => {
    const idx = active.findIndex((t) => t.id === taskId);
    if (idx <= 0) {
      return;
    }
    swapTaskOrder(taskId, active[idx - 1].id);
  };

  const moveTaskDown = (taskId: string) => {
    const idx = active.findIndex((t) => t.id === taskId);
    if (idx < 0 || idx >= active.length - 1) {
      return;
    }
    swapTaskOrder(taskId, active[idx + 1].id);
  };

  return (
    <SwipeBackContainer onSwipeBack={() => router.back()}>
      <SafeAreaView
        edges={["top"]}
        style={[styles.container, { backgroundColor: bg }]}
      >
        <Header
          headerTitle={listTitle}
          reorderingDone={
            isReordering ? () => setIsReordering(false) : undefined
          }
          rightAction={
            isReordering
              ? undefined
              : { icon: "add", onPress: () => setShowAddTask(true) }
          }
        />

        {listTasks.length === 0 ? (
          <View style={styles.empty}>
            <StyledText style={styles.emptyText}>no tasks</StyledText>
          </View>
        ) : (
          <View style={styles.scrollWrapper}>
            <Animated.ScrollView
              onLayout={(e) => setScrollViewHeight(e.nativeEvent.layout.height)}
              onScroll={handleScroll}
              overScrollMode="never"
              scrollEventThrottle={16}
              showsVerticalScrollIndicator={false}
            >
              <View
                onLayout={(e) => setContentHeight(e.nativeEvent.layout.height)}
              >
                {active.map((task, idx) => (
                  <TaskRow
                    isFirst={idx === 0}
                    isLast={idx === active.length - 1}
                    isReordering={isReordering}
                    key={task.id}
                    listTitle={listTitle}
                    onLongPress={() => {
                      if (isReordering) {
                        return;
                      }
                      router.push({
                        pathname: "/task-actions/[id]",
                        params: { id: task.id },
                      });
                    }}
                    onMoveDown={() => moveTaskDown(task.id)}
                    onMoveUp={() => moveTaskUp(task.id)}
                    onPress={() => {
                      if (isReordering) {
                        return;
                      }
                      router.push({
                        pathname: "/task/[id]",
                        params: { id: task.id },
                      });
                    }}
                    onToggle={() => toggleTask(task.id)}
                    task={task}
                  />
                ))}

                {completed.length > 0 && (
                  <>
                    <HapticPressable
                      onPress={() => setShowCompleted((v) => !v)}
                      style={styles.completedHeader}
                    >
                      <StyledText style={styles.completedLabel}>
                        Completed ({completed.length})
                      </StyledText>
                    </HapticPressable>
                    {showCompleted &&
                      completed.map((task, idx) => (
                        <TaskRow
                          dimmed
                          isFirst={idx === 0}
                          isLast={idx === completed.length - 1}
                          isReordering={false}
                          key={task.id}
                          listTitle={listTitle}
                          onLongPress={() =>
                            router.push({
                              pathname: "/task-actions/[id]",
                              params: { id: task.id },
                            })
                          }
                          // biome-ignore lint/suspicious/noEmptyBlockStatements: completed tasks are not reorderable
                          onMoveDown={() => {}}
                          // biome-ignore lint/suspicious/noEmptyBlockStatements: completed tasks are not reorderable
                          onMoveUp={() => {}}
                          onPress={() =>
                            router.push({
                              pathname: "/task/[id]",
                              params: { id: task.id },
                            })
                          }
                          onToggle={() => toggleTask(task.id)}
                          task={task}
                        />
                      ))}
                  </>
                )}
              </View>
            </Animated.ScrollView>
            {scrollIndicatorHeight > 0 && (
              <View
                style={[styles.scrollTrack, { backgroundColor: textColor }]}
              >
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
        )}

        <AddTaskModal
          defaultListId={id ?? "inbox"}
          onDismiss={() => setShowAddTask(false)}
          visible={showAddTask}
        />
      </SafeAreaView>
    </SwipeBackContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollWrapper: { flex: 1, flexDirection: "row", position: "relative" },
  scrollTrack: scrollIndicatorBaseStyles.track,
  scrollThumb: scrollIndicatorBaseStyles.thumb,
  empty: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyText: { fontSize: n(24) },
  completedHeader: { paddingHorizontal: n(22), paddingVertical: n(14) },
  completedLabel: { fontSize: n(18), opacity: 0.5 },
});
