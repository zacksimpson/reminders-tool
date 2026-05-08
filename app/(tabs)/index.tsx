import { MaterialIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  Animated,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { HapticPressable } from "@/components/HapticPressable";
import { Header } from "@/components/Header";
import { StyledText } from "@/components/StyledText";
import { useInvertColors } from "@/contexts/InvertColorsContext";
import { useReminders } from "@/contexts/RemindersContext";
import { useScrollIndicator } from "@/hooks/useScrollIndicator";
import { n } from "@/utils/scaling";

export default function ListsScreen() {
  const { invertColors } = useInvertColors();
  const { lists, deleteList, moveListUp, moveListDown, clearCompletedTasks } = useReminders();
  const bg = invertColors ? "white" : "black";
  const textColor = invertColors ? "black" : "white";
  const dimColor = invertColors ? "#AAAAAA" : "#555555";

  const params = useLocalSearchParams<{
    confirmed?: string;
    action?: string;
    startReorder?: string;
  }>();

  const {
    handleScroll, scrollIndicatorHeight, scrollIndicatorPosition,
    setContentHeight, setScrollViewHeight,
  } = useScrollIndicator();

  const [isReordering, setIsReordering] = useState(false);
  const sorted = [...lists].sort((a, b) => a.order - b.order);

  // Handle confirm screen returning with a delete action
  useEffect(() => {
    if (params.confirmed === "true" && params.action?.startsWith("delete-list:")) {
      const id = params.action.replace("delete-list:", "");
      deleteList(id);
      router.setParams({ confirmed: undefined, action: undefined });
    }
    if (params.confirmed === "true" && params.action?.startsWith("clear-completed:")) {
      const id = params.action.replace("clear-completed:", "");
      clearCompletedTasks(id);
      router.setParams({ confirmed: undefined, action: undefined });
    }
  }, [params.confirmed, params.action, deleteList, clearCompletedTasks]);

  // Handle reorder mode triggered from list-actions screen
  useEffect(() => {
    if (params.startReorder === "true") {
      setIsReordering(true);
      router.setParams({ startReorder: undefined });
    }
  }, [params.startReorder]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={["top"]}>
      <Header
        headerTitle="Lists"
        hideBackButton
        rightAction={isReordering ? undefined : {
          icon: "add",
          onPress: () => router.push("/list-actions/new"),
        }}
        reorderingDone={isReordering ? () => setIsReordering(false) : undefined}
      />

      <View style={styles.scrollWrapper}>
        <Animated.ScrollView
          onLayout={(e) => setScrollViewHeight(e.nativeEvent.layout.height)}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          overScrollMode="never"
          showsVerticalScrollIndicator={false}
        >
          <View onLayout={(e) => setContentHeight(e.nativeEvent.layout.height)}>
            {sorted.map((list, idx) => (
              <HapticPressable
                key={list.id}
                onPress={() => {
                  if (!isReordering)
                    router.push({ pathname: "/list/[id]", params: { id: list.id } });
                }}
                onLongPress={() => {
                  if (!isReordering)
                    router.push({ pathname: "/list-actions/[id]/", params: { id: list.id } });
                }}
                delayLongPress={400}
                style={styles.listItem}
              >
                <StyledText style={styles.listTitle}>{list.title}</StyledText>
                {isReordering && (
                  <View style={styles.arrowGroup}>
                    <HapticPressable onPress={() => moveListUp(list.id)} disabled={idx === 0}>
                      <MaterialIcons name="keyboard-arrow-up" size={n(32)} color={idx === 0 ? dimColor : textColor} />
                    </HapticPressable>
                    <HapticPressable onPress={() => moveListDown(list.id)} disabled={idx === sorted.length - 1}>
                      <MaterialIcons name="keyboard-arrow-down" size={n(32)} color={idx === sorted.length - 1 ? dimColor : textColor} />
                    </HapticPressable>
                  </View>
                )}
              </HapticPressable>
            ))}
          </View>
        </Animated.ScrollView>

        {scrollIndicatorHeight > 0 && (
          <View style={[styles.scrollTrack, { backgroundColor: textColor }]}>
            <Animated.View style={[styles.scrollThumb, { backgroundColor: textColor, height: scrollIndicatorHeight, transform: [{ translateY: scrollIndicatorPosition }] }]} />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollWrapper: { flex: 1, flexDirection: "row", position: "relative" },
  scrollTrack: { width: n(1), height: "100%", position: "absolute", right: n(18) },
  scrollThumb: { width: n(5), position: "absolute", right: n(-2) },
  listItem: { flexDirection: "row", alignItems: "center", paddingHorizontal: n(22), paddingVertical: n(11) },
  listTitle: { fontSize: n(30), flex: 1 },
  arrowGroup: { flexDirection: "row", gap: n(8), paddingRight: n(12) },
});
