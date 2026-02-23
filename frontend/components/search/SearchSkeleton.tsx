/**
 * 搜索加载骨架屏
 *
 * 展示 3 个骨架卡片模拟加载中的笔记卡片
 * 使用 Animated 实现简单的脉冲闪烁效果
 */
import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { MD3Theme, ProgressBar, useTheme } from "react-native-paper";

/** 单个骨架卡片 */
const SkeletonCard: React.FC<{ theme: MD3Theme }> = ({ theme }) => (
  <View
    style={[styles.card, { backgroundColor: theme.colors.elevation.level1 }]}
  >
    {/* 图片占位区 */}
    <View
      style={[
        styles.imagePlaceholder,
        { backgroundColor: theme.colors.surfaceVariant },
      ]}
    />
    {/* 文字占位区 */}
    <View style={styles.textArea}>
      <View
        style={[
          styles.titlePlaceholder,
          { backgroundColor: theme.colors.surfaceVariant },
        ]}
      />
      <View
        style={[
          styles.datePlaceholder,
          { backgroundColor: theme.colors.surfaceVariant },
        ]}
      />
    </View>
  </View>
);

export const SearchSkeleton: React.FC = () => {
  const theme = useTheme();
  // 脉冲动画：骨架屏透明度 0.4 → 1.0 循环
  const pulseAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.4,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulseAnim]);

  return (
    <View style={styles.container}>
      {/* 顶部进度条 */}
      <ProgressBar
        indeterminate
        color={theme.colors.primary}
        style={styles.progressBar}
      />

      {/* 3 个骨架卡片 */}
      <Animated.View style={{ opacity: pulseAnim }}>
        {[1, 2, 3].map((i) => (
          <SkeletonCard key={i} theme={theme} />
        ))}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  progressBar: {
    height: 2,
  },
  card: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    overflow: "hidden",
  },
  imagePlaceholder: {
    height: 120,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  textArea: {
    padding: 16,
  },
  titlePlaceholder: {
    height: 16,
    width: "75%",
    borderRadius: 4,
  },
  datePlaceholder: {
    height: 12,
    width: "50%",
    borderRadius: 4,
    marginTop: 8,
  },
});
