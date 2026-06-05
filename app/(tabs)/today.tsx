import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Animated, AppState, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AddTaskModal } from "@/components/AddTaskModal";
import { HapticPressable } from "@/components/HapticPressable";
import { Header } from "@/components/Header";
import { StyledText } from "@/components/StyledText";
import { TaskRow } from "@/components/TaskRow";
import { useInvertColors } from "@/contexts/InvertColorsContext";
import { useReminders } from "@/contexts/RemindersContext";
import {
  scrollIndicatorBaseStyles,
  useScrollIndicator,
} from "@/hooks/useScrollIndicator";
import {
  compareTasksByDateThenTime,
  compareTasksByDateTime,
  getTodayStr,
  isOverdue,
} from "@/utils/dateTime";
import { n } from "@/utils/scaling";

export default function TodayScreen() {
  const { invertColors } = useInvertColors();
  const { tasks, lists, settings, toggleTask } = useReminders();
  const bg = invertColors ? "white" : "black";
  const textColor = invertColors ? "black" : "white";
  const [showCompleted, setShowCompleted] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const {
    handleScroll,
    scrollIndicatorHeight,
    scrollIndicatorPosition,
    setContentHeight,
    setScrollViewHeight,
  } = useScrollIndicator();

  useFocusEffect(
    useCallback(() => {
      return () => setShowAddTask(false);
    }, [])
  );

  // Re-render every minute while focused so overdue status updates in real time
  const [, setTick] = useState(0);
  useFocusEffect(
    useCallback(() => {
      const id = setInterval(() => setTick((t) => t + 1), 60_000);
      return () => clearInterval(id);
    }, [])
  );

  // Re-render when app comes to foreground (handles overnight date change)
  const [, setRefreshTick] = useState(0);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        setRefreshTick((t) => t + 1);
      }
    });
    return () => sub.remove();
  }, []);

  const todayStr = getTodayStr();
  const showOverdue = settings.showOverdue ?? true;

  const getListTitle = (listId: string) =>
    lists.find((l) => l.id === listId)?.title ?? "";

  // Overdue: incomplete tasks from before today (date only) or past datetime
  const overdueTasks = showOverdue
    ? tasks
        .filter((t) => !t.completed && isOverdue(t))
        .sort(compareTasksByDateThenTime)
    : [];

  // Today's active tasks (exclude overdue so they don't appear in both lists)
  const activeTasks = tasks
    .filter((t) => t.date === todayStr && !t.completed && !isOverdue(t))
    .sort(compareTasksByDateTime);

  // Completed tasks (today + overdue)
  const completedTasks = tasks
    .filter(
      (t) =>
        t.completed && (t.date === todayStr || (showOverdue && isOverdue(t)))
    )
    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));

  const isEmpty =
    overdueTasks.length === 0 &&
    activeTasks.length === 0 &&
    completedTasks.length === 0;

  return (
    <SafeAreaView
      edges={["top"]}
      style={[styles.container, { backgroundColor: bg }]}
    >
      <Header
        headerTitle="Today"
        hideBackButton
        rightAction={{ icon: "add", onPress: () => setShowAddTask(true) }}
      />

      {isEmpty ? (
        <View style={styles.empty}>
          <StyledText style={styles.emptyText}>no tasks today</StyledText>
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
              {/* Overdue tasks */}
              {overdueTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  listTitle={getListTitle(task.listId)}
                  onPress={() =>
                    router.push({
                      pathname: "/task/[id]",
                      params: { id: task.id },
                    })
                  }
                  onToggle={() => toggleTask(task.id)}
                  overdue
                  task={task}
                />
              ))}

              {/* Today's active tasks */}
              {activeTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  listTitle={getListTitle(task.listId)}
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

              {/* Completed */}
              {completedTasks.length > 0 && (
                <>
                  <HapticPressable
                    onPress={() => setShowCompleted((v) => !v)}
                    style={styles.completedHeader}
                  >
                    <StyledText style={styles.completedLabel}>
                      Completed ({completedTasks.length})
                    </StyledText>
                  </HapticPressable>
                  {showCompleted &&
                    completedTasks.map((task) => (
                      <TaskRow
                        dimmed
                        key={task.id}
                        listTitle={getListTitle(task.listId)}
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
      )}

      <AddTaskModal
        defaultDate={todayStr}
        defaultListId={settings.defaultListId}
        onDismiss={() => setShowAddTask(false)}
        visible={showAddTask}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollWrapper: { flex: 1, flexDirection: "row", position: "relative" },
  scrollTrack: scrollIndicatorBaseStyles.track,
  scrollThumb: scrollIndicatorBaseStyles.thumb,
  empty: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyText: { fontSize: n(20) },
  completedHeader: { paddingHorizontal: n(22), paddingVertical: n(14) },
  completedLabel: { fontSize: n(18), opacity: 0.5 },
});
