import { router } from "expo-router";
import { Animated, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { HapticPressable } from "@/components/HapticPressable";
import { Header } from "@/components/Header";
import { StyledText } from "@/components/StyledText";
import { SwipeBackContainer } from "@/components/SwipeBackContainer";
import { useInvertColors } from "@/contexts/InvertColorsContext";
import { useReminders } from "@/contexts/RemindersContext";
import {
  scrollIndicatorBaseStyles,
  useScrollIndicator,
} from "@/hooks/useScrollIndicator";
import { n } from "@/utils/scaling";

export default function DefaultListScreen() {
  const { invertColors } = useInvertColors();
  const { lists, settings, updateSettings } = useReminders();
  const bg = invertColors ? "white" : "black";
  const textColor = invertColors ? "black" : "white";
  const {
    handleScroll,
    scrollIndicatorHeight,
    scrollIndicatorPosition,
    setContentHeight,
    setScrollViewHeight,
  } = useScrollIndicator();

  const sorted = [...lists].sort((a, b) => a.order - b.order);

  const handleSelect = (id: string) => {
    updateSettings({ defaultListId: id });
    router.back();
  };

  return (
    <SwipeBackContainer onSwipeBack={() => router.back()}>
      <SafeAreaView
        edges={["top"]}
        style={[styles.container, { backgroundColor: bg }]}
      >
        <Header headerTitle="Default List" />

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
              {sorted.map((list) => {
                const isSelected = settings.defaultListId === list.id;
                return (
                  <HapticPressable
                    key={list.id}
                    onPress={() => handleSelect(list.id)}
                    style={styles.optionRow}
                  >
                    <StyledText
                      style={[
                        styles.optionText,
                        isSelected && styles.optionSelected,
                      ]}
                    >
                      {list.title}
                    </StyledText>
                  </HapticPressable>
                );
              })}
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
    </SwipeBackContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollWrapper: { flex: 1, flexDirection: "row", position: "relative" },
  scrollTrack: scrollIndicatorBaseStyles.track,
  scrollThumb: scrollIndicatorBaseStyles.thumb,
  optionRow: {
    paddingHorizontal: n(22),
    paddingVertical: n(12),
  },
  optionText: {
    fontSize: n(30),
  },
  optionSelected: {
    textDecorationLine: "underline",
  },
});
