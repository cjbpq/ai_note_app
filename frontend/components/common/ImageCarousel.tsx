/**
 * ImageCarousel 组件
 *
 * 职责：基于 FlatList 的水平图片轮播，带页码指示器
 *
 * 特性：
 * 1. 零额外依赖，使用 RN 内置 FlatList + pagingEnabled
 * 2. 底部圆点指示器（两张及以上时显示）
 * 3. 支持点击图片回调（用于打开全屏查看器）
 * 4. 加载状态 / 错误状态逐张处理
 *
 * 使用位置：NoteImage（笔记详情页多图展示）
 */
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    ActivityIndicator,
    Dimensions,
    FlatList,
    StyleSheet,
    TouchableOpacity,
    View,
    type ViewToken,
} from "react-native";
import { Text, useTheme } from "react-native-paper";

// ========== 常量配置 ==========
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CAROUSEL_HORIZONTAL_PADDING = 32; // 左右各 16 间距
const IMAGE_WIDTH = SCREEN_WIDTH - CAROUSEL_HORIZONTAL_PADDING;
const IMAGE_HEIGHT = 300; // 与原 NoteImage 保持一致
const INDICATOR_ROW_HEIGHT = 24; // 圆点指示器行高（paddingVertical 8 + dot 8）

// ========== Props 类型定义 ==========
interface ImageCarouselProps {
  /** 图片 URL 列表 */
  imageUrls: string[];
  /** 点击某张图片时的回调（传入被点击图片的索引） */
  onImagePress?: (index: number) => void;
}

/**
 * 单张图片渲染项
 */
const CarouselItem: React.FC<{
  uri: string;
  index: number;
  onPress?: (index: number) => void;
}> = React.memo(({ uri, index, onPress }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <View
        style={[
          styles.itemContainer,
          styles.errorContainer,
          { backgroundColor: theme.colors.errorContainer },
        ]}
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
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={styles.itemContainer}
      activeOpacity={0.9}
      onPress={() => onPress?.(index)}
      disabled={!onPress}
    >
      {/* 加载占位 */}
      {isLoading && (
        <View style={styles.placeholder}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
        </View>
      )}

      <Image
        source={{ uri }}
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
    </TouchableOpacity>
  );
});

CarouselItem.displayName = "CarouselItem";

/**
 * ImageCarousel 主组件
 */
export const ImageCarousel: React.FC<ImageCarouselProps> = ({
  imageUrls,
  onImagePress,
}) => {
  const theme = useTheme();
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  // 页码变化监听（viewability 方案比 onScroll 计算更精确）
  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 });
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems?.[0]?.index != null) {
        setActiveIndex(viewableItems[0].index);
      }
    },
  );

  const renderItem = useCallback(
    ({ item, index }: { item: string; index: number }) => (
      <CarouselItem uri={item} index={index} onPress={onImagePress} />
    ),
    [onImagePress],
  );

  const keyExtractor = useCallback(
    (_item: string, index: number) => `carousel-${index}`,
    [],
  );

  // 空列表不渲染
  if (!imageUrls?.length) return null;

  // 单张图片：直接渲染，不需要 FlatList 开销
  if (imageUrls.length === 1) {
    return (
      <View style={[styles.container, { height: IMAGE_HEIGHT }]}>
        <CarouselItem uri={imageUrls[0]} index={0} onPress={onImagePress} />
      </View>
    );
  }

  // 多图：FlatList 容器需要显式高度，否则在 ScrollView 内部会撑满
  const totalHeight = IMAGE_HEIGHT + INDICATOR_ROW_HEIGHT;

  return (
    <View style={[styles.container, { height: totalHeight }]}>
      <FlatList
        ref={flatListRef}
        data={imageUrls}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        style={{ height: IMAGE_HEIGHT }}
        onViewableItemsChanged={onViewableItemsChanged.current}
        viewabilityConfig={viewabilityConfig.current}
        getItemLayout={(_data, index) => ({
          length: IMAGE_WIDTH,
          offset: IMAGE_WIDTH * index,
          index,
        })}
      />

      {/* 页码指示器：圆点式 */}
      <View style={styles.indicatorRow}>
        {imageUrls.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              {
                backgroundColor:
                  i === activeIndex
                    ? theme.colors.primary
                    : theme.colors.outlineVariant,
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
};

// ========== 样式定义 ==========
const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
  },
  itemContainer: {
    width: IMAGE_WIDTH,
    height: IMAGE_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
  },
  placeholder: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    height: IMAGE_HEIGHT,
  },
  image: {
    width: IMAGE_WIDTH,
    height: IMAGE_HEIGHT,
  },
  hidden: {
    opacity: 0,
  },
  errorContainer: {
    borderRadius: 12,
    padding: 24,
    marginHorizontal: 16,
  },
  indicatorRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 8,
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});

export default ImageCarousel;
