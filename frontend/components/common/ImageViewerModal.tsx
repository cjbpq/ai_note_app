/**
 * ImageViewerModal 组件
 *
 * 职责：全屏图片查看器，支持缩放和左右翻页
 *
 * 特性：
 * 1. 基于 react-native-image-viewing（自带 pinch-to-zoom + swipe 翻页）
 * 2. 顶部显示页码 "2 / 5"
 * 3. 纯 UI 组件，状态由父组件控制（visible / imageIndex）
 *
 * 使用方式：
 *   <ImageViewerModal
 *     visible={isViewerOpen}
 *     imageUrls={note.imageUrls}
 *     initialIndex={tappedIndex}
 *     onClose={() => setIsViewerOpen(false)}
 *   />
 */
import React, { useCallback } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import ImageViewing from "react-native-image-viewing";

// ========== Props 类型定义 ==========
interface ImageViewerModalProps {
  /** 是否显示 */
  visible: boolean;
  /** 图片 URL 列表 */
  imageUrls: string[];
  /** 初始展示的图片索引（默认 0） */
  initialIndex?: number;
  /** 关闭回调 */
  onClose: () => void;
}

/**
 * ImageViewerModal 主组件
 */
export const ImageViewerModal: React.FC<ImageViewerModalProps> = ({
  visible,
  imageUrls,
  initialIndex = 0,
  onClose,
}) => {
  // react-native-image-viewing 需要 { uri: string }[] 格式
  const images = (imageUrls ?? []).map((url) => ({ uri: url }));

  // Header：关闭按钮（始终显示）+ 页码（多图时显示）
  const renderHeader = useCallback(
    ({ imageIndex }: { imageIndex: number }) => {
      return (
        <View style={styles.headerContainer}>
          {/* 页码指示（仅多图） */}
          {images.length > 1 && (
            <Text style={styles.headerText}>
              {imageIndex + 1} / {images.length}
            </Text>
          )}

          {/* 关闭按钮（始终可见，保证用户总能退出） */}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.7}
          >
            <Text style={styles.closeIcon}>✕</Text>
          </TouchableOpacity>
        </View>
      );
    },
    [images.length, onClose],
  );

  if (!images.length) return null;

  return (
    <ImageViewing
      images={images}
      imageIndex={initialIndex}
      visible={visible}
      onRequestClose={onClose}
      HeaderComponent={renderHeader}
      swipeToCloseEnabled
      doubleTapToZoomEnabled
    />
  );
};

// ========== 样式定义 ==========
const styles = StyleSheet.create({
  headerContainer: {
    position: "absolute",
    top: 50,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
    paddingHorizontal: 16,
  },
  headerText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    overflow: "hidden",
  },
  closeButton: {
    position: "absolute",
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  closeIcon: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
  },
});

export default ImageViewerModal;
