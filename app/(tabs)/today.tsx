import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AddTaskModal } from "@/components/AddTaskModal";
import { Header } from "@/components/Header";
import { HapticPressable } from "@/components/HapticPressable";
import { StyledText } from "@/components/StyledText";
import { TaskCheckbox } from "@/components/TaskCheckbox";
import { useInvertColors } from "@/contexts/InvertColorsContext";
import { useReminders, type Task } from "@/contexts/RemindersContext";
import { useScrollIndicator } from "@/hooks/useScrollIndicator";
import { n } from "@/utils/scaling";

function getTodayStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function formatTime(time: string): string {
  const [hStr, mStr] = time.split(":");
  const h = parseInt(hStr, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mStr} ${ampm}`;
}

function formatDate(date: string): string {
  const [, mo, d] = date.split("-").map(Number);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[mo - 1]} ${d}`;
}

interface TaskRowProps {
  task: Task;
  listTitle: string;
  onToggle: () => void;
  onPress: () => void;
  dimmed?: boolean;
}

function TaskRow({ task, listTitle, onToggle, onPress, dimmed }: TaskRowProps) {
  const subtaskCount = task.subtasks?.length ?? 0;
  const subtaskLabel = subtaskCount > 0 ? `${subtaskCount} ${subtaskCount === 1 ? "Subtask" : "Subtasks"}` : null;
  const meta = [listTitle, task.date ? formatDate(task.date) : null, task.time ? formatTime(task.time) : null, subtaskLabel].filter(Boolean).join(" · ");
  return (
    <View style={[styles.taskRow, dimmed && styles.taskRowDimmed]}>
      <TaskCheckbox checked={task.completed} onToggle={onToggle} />
      <HapticPressable onPress={onPress} style={styles.taskContent}>
        <StyledText style={[styles.taskTitle, task.completed && styles.taskDone]}>{task.title}</StyledText>
        {meta ? <StyledText style={styles.taskMeta}>{meta}</StyledText> : null}
      </HapticPressable>
    </View>
  );
}

export default function TodayScreen() {
  const { invertColors } = useInvertColors();
  const { tasks, lists, settings, toggleTask } = useReminders();
  const bg = invertColors ? "white" : "black";
  const textColor = invertColors ? "black" : "white";
  const [showCompleted, setShowCompleted] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);

  useFocusEffect(
    useCallback(() => {
      return () => setShowAddTask(false);
    }, [])
  );
  const { handleScroll, scrollIndicatorHeight, scrollIndicatorPosition, setContentHeight, setScrollViewHeight } = useScrollIndicator();

  const todayStr = getTodayStr();
  const todayTasks = tasks.filter(t => t.date === todayStr);
  const active = todayTasks.filter(t => !t.completed).sort((a, b) => {
    if (!a.time && !b.time) return a.order - b.order;
    if (!a.time) return -1;
    if (!b.time) return 1;
    return a.time.localeCompare(b.time);
  });
  const completed = todayTasks.filter(t => t.completed).sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
  const getListTitle = (listId: string) => lists.find(l => l.id === listId)?.title ?? "";

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={["top"]}>
      <Header
        headerTitle="Today"
        hideBackButton
        rightAction={{ icon: "add", onPress: () => setShowAddTask(true) }}
      />

      {todayTasks.length === 0 ? (
        <View style={styles.empty}>
          <StyledText style={styles.emptyText}>no tasks today</StyledText>
        </View>
      ) : (
        <View style={styles.scrollWrapper}>
          <Animated.ScrollView
            onLayout={(e) => setScrollViewHeight(e.nativeEvent.layout.height)}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            overScrollMode="never"
            showsVerticalScrollIndicator={false}
          >
            <View onLayout={(e) => setContentHeight(e.nativeEvent.layout.height)}>
              {active.map(task => (
                <TaskRow key={task.id} task={task} listTitle={getListTitle(task.listId)} onToggle={() => toggleTask(task.id)} onPress={() => router.push({ pathname: "/task/[id]", params: { id: task.id } })} />
              ))}
              {completed.length > 0 && (
                <>
                  <HapticPressable onPress={() => setShowCompleted(v => !v)} style={styles.completedHeader}>
                    <StyledText style={styles.completedLabel}>Completed ({completed.length})</StyledText>
                  </HapticPressable>
                  {showCompleted && completed.map(task => (
                    <TaskRow key={task.id} task={task} listTitle={getListTitle(task.listId)} onToggle={() => toggleTask(task.id)} onPress={() => router.push({ pathname: "/task/[id]", params: { id: task.id } })} dimmed />
                  ))}
                </>
              )}
            </View>
          </Animated.ScrollView>
          {scrollIndicatorHeight > 0 && (
            <View style={[styles.scrollTrack, { backgroundColor: textColor }]}>
              <Animated.View style={[styles.scrollThumb, { backgroundColor: textColor, height: scrollIndicatorHeight, transform: [{ translateY: scrollIndicatorPosition }] }]} />
            </View>
          )}
        </View>
      )}

      <AddTaskModal
        visible={showAddTask}
        defaultListId={settings.defaultListId}
        defaultDate={todayStr}
        onDismiss={() => setShowAddTask(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollWrapper: { flex: 1, flexDirection: "row", position: "relative" },
  scrollTrack: { width: n(1), height: "100%", position: "absolute", right: n(18) },
  scrollThumb: { width: n(5), position: "absolute", right: n(-2) },
  empty: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyText: { fontSize: n(20), opacity: 0.4 },
  taskRow: { flexDirection: "row", alignItems: "flex-start", paddingRight: n(22) },
  taskRowDimmed: { opacity: 0.4 },
  taskContent: { flex: 1, paddingVertical: n(11) },
  taskTitle: { fontSize: n(23) },
  taskDone: { opacity: 0.4 },
  taskMeta: { fontSize: n(16), marginTop: n(2) },
  completedHeader: { paddingHorizontal: n(22), paddingVertical: n(14) },
  completedLabel: { fontSize: n(18), opacity: 0.5 },
});
