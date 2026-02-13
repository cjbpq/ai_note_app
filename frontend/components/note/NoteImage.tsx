/**
 * NoteImage 组件
 *
 * 职责：展示笔记的原图，处理加载状态和错误状态
 *
 * 特性：
 * 1. 加载中显示占位 Loading 指示器
 * 2. 加载失败显示错误提示
 * 3. 图片自适应容器宽度
 */
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Dimensions, StyleSheet, View } from "react-native";
import { Surface, Text, useTheme } from "react-native-paper";

// ========== 常量配置 ==========
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const IMAGE_HORIZONTAL_PADDING = 32;
const IMAGE_MAX_WIDTH = SCREEN_WIDTH - IMAGE_HORIZONTAL_PADDING;

// ========== Props 类型定义 ==========
interface NoteImageProps {
  /** 图片 URL */
  imageUrl: string | undefined;
}

/**
 * NoteImage 组件
 * 展示笔记关联的图片，自动处理加载和错误状态
 */
export const NoteImage: React.FC<NoteImageProps> = ({ imageUrl }) => {
  const { t } = useTranslation();
  const theme = useTheme();

  // 图片加载状态（局部 UI 状态，保留在组件内）
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // 如果没有图片 URL，不渲染任何内容
  if (!imageUrl) {
    return null;
  }

  // 图片加载失败时的错误视图
  if (hasError) {
    return (
      <Surface
        style={[
          styles.errorContainer,
          { backgroundColor: theme.colors.errorContainer },
        ]}
        elevation={0}
      >
        <Ionicons
          name="image-outline"
          size={40}
          color={theme.colors.onErrorContainer}
        />
        <Text
          variant="bodySmall"
          style={{ color: theme.colors.onErrorContainer }}
        >
          {t("common.error")}
        </Text>
      </Surface>
    );
  }

  // 正常渲染图片
  return (
    <Surface style={styles.container} elevation={1}>
      {/* 加载中显示占位指示器 */}
      {isLoading && (
        <View style={styles.placeholder}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
        </View>
      )}

      {/* 图片主体 */}
      <Image
        source={{ uri: imageUrl }}
        style={[styles.image, isLoading && styles.hidden]}
        contentFit="contain"
        transition={300}
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setIsLoading(false);
          setHasError(true);
        }}
        accessibilityLabel={t("noteDetail.image_alt")}
      />
    </Surface>
  );
};

// ========== 样式定义 ==========
const styles = StyleSheet.create({
  container: {
    margin: 16,
    borderRadius: 12,
    overflow: "hidden",
    minHeight: 200,
    justifyContent: "center",
    alignItems: "center",
  },
  placeholder: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    height: 200,
  },
  image: {
    width: IMAGE_MAX_WIDTH,
    height: 300,
  },
  hidden: {
    opacity: 0,
  },
  errorContainer: {
    margin: 16,
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 100,
  },
});

export default NoteImage;
