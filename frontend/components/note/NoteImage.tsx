/**
 * NoteImage 组件
 *
 * 职责：展示笔记的图片（支持多图轮播 + 全屏查看）
 *
 * 特性：
 * 1. 单图 → 直接展示（点击可全屏查看）
 * 2. 多图 → 横向轮播 + 页码指示器（点击进入全屏查看器）
 * 3. 全屏查看器自带 pinch-to-zoom + 左右翻页
 * 4. 空数组时不渲染
 */
import React, { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Surface } from "react-native-paper";

import { ImageCarousel } from "../common/ImageCarousel";
import { ImageViewerModal } from "../common/ImageViewerModal";

// ========== Props 类型定义 ==========
interface NoteImageProps {
  /** 图片 URL 数组 */
  imageUrls: string[];
}

/**
 * NoteImage 组件
 * 展示笔记关联的图片，自动处理单图 / 多图场景
 */
export const NoteImage: React.FC<NoteImageProps> = ({ imageUrls }) => {
  // 全屏查看器状态
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  // 点击图片 → 打开全屏查看器
  const handleImagePress = useCallback((index: number) => {
    setViewerIndex(index);
    setViewerVisible(true);
  }, []);

  const handleCloseViewer = useCallback(() => {
    setViewerVisible(false);
  }, []);

  // 空数组不渲染
  if (!imageUrls?.length) {
    return null;
  }

  return (
    <View style={styles.wrapper}>
      <Surface style={styles.container} elevation={1}>
        <ImageCarousel imageUrls={imageUrls} onImagePress={handleImagePress} />
      </Surface>

      {/* 全屏图片查看器（Modal） */}
      <ImageViewerModal
        visible={viewerVisible}
        imageUrls={imageUrls}
        initialIndex={viewerIndex}
        onClose={handleCloseViewer}
      />
    </View>
  );
};

// ========== 样式定义 ==========
const styles = StyleSheet.create({
  wrapper: {
    // 外层 wrapper 用于包裹全屏 Modal（Portal 不需要额外容器）
  },
  container: {
    margin: 16,
    borderRadius: 12,
    overflow: "hidden",
    minHeight: 200,
    justifyContent: "center",
    alignItems: "center",
  },
});

export default NoteImage;
