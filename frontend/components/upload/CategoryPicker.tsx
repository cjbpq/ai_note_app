/**
 * 分类选择器组件（上传界面使用）
 *
 * 功能：
 *   - 收起状态：显示当前选中分类名或占位文字
 *   - 展开状态：可选分类列表 + 新建分类入口
 *   - 新建分类：内联输入 → 确定后追加到列表并自动选中
 *
 * 使用方：app/(tabs)/index.tsx（首页上传界面）
 * 数据来源：useCategories Hook（TanStack Query 缓存 + 本地新建）
 */
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Animated,
  Keyboard,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import {
  Button,
  Divider,
  Surface,
  Text,
  TextInput,
  TouchableRipple,
  useTheme,
} from "react-native-paper";
import { APP_CONFIG } from "../../constants/config";
import { NoteCategory } from "../../types";

// ── Props ───────────────────────────────────────────
interface CategoryPickerProps {
  /** 可选分类列表 */
  categories: NoteCategory[];
  /** 当前选中的分类名（null = 未选择） */
  selectedCategory: string | null;
  /** 选中/取消选中回调 */
  onSelect: (category: string | null) => void;
  /** 新建分类回调 */
  onCreateNew: (name: string) => void;
  /** 是否正在加载分类列表 */
  isLoading?: boolean;
}

export const CategoryPicker: React.FC<CategoryPickerProps> = ({
  categories,
  selectedCategory,
  onSelect,
  onCreateNew,
  isLoading = false,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();

  // ── 展开/收起状态 ──
  const [isExpanded, setIsExpanded] = useState(false);
  // ── 新建分类输入模式 ──
  const [isCreating, setIsCreating] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  // 箭头旋转动画
  const arrowRotation = useRef(new Animated.Value(0)).current;

  // ── 切换展开/收起 ──
  const toggleExpand = useCallback(() => {
    const toValue = isExpanded ? 0 : 1;
    setIsExpanded(!isExpanded);
    Animated.timing(arrowRotation, {
      toValue,
      duration: 200,
      useNativeDriver: true,
    }).start();

    // 收起时重置新建输入
    if (isExpanded) {
      setIsCreating(false);
      setNewCategoryName("");
    }
  }, [isExpanded, arrowRotation]);

  // ── 选中分类 ──
  const handleSelect = useCallback(
    (categoryName: string) => {
      // 点击已选中的 → 取消选择
      const next = selectedCategory === categoryName ? null : categoryName;
      onSelect(next);
      // 选中后收起列表
      setIsExpanded(false);
      Animated.timing(arrowRotation, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    },
    [selectedCategory, onSelect, arrowRotation],
  );

  // ── 新建分类确认 ──
  const handleCreateConfirm = useCallback(() => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;
    if (trimmed.length > APP_CONFIG.MAX_CATEGORY_NAME_LENGTH) return;

    // 检查重复
    if (categories.some((c) => c.name === trimmed)) return;

    onCreateNew(trimmed);
    onSelect(trimmed);

    // 重置状态并收起
    setNewCategoryName("");
    setIsCreating(false);
    setIsExpanded(false);
    Animated.timing(arrowRotation, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
    Keyboard.dismiss();
  }, [newCategoryName, categories, onCreateNew, onSelect, arrowRotation]);

  // ── 取消新建 ──
  const handleCreateCancel = useCallback(() => {
    setIsCreating(false);
    setNewCategoryName("");
  }, []);

  // 箭头旋转插值
  const arrowRotateStyle = {
    transform: [
      {
        rotate: arrowRotation.interpolate({
          inputRange: [0, 1],
          outputRange: ["0deg", "180deg"],
        }),
      },
    ],
  };

  // 选中分类的显示名称
  const displayText = selectedCategory
    ? selectedCategory
    : t("category.select_placeholder");

  const isNewNameValid =
    newCategoryName.trim().length > 0 &&
    newCategoryName.trim().length <= APP_CONFIG.MAX_CATEGORY_NAME_LENGTH &&
    !categories.some((c) => c.name === newCategoryName.trim());

  return (
    <View style={styles.container}>
      {/* 标签文字 */}
      <Text
        variant="labelSmall"
        style={[styles.label, { color: theme.colors.onSurfaceVariant }]}
      >
        {t("category.save_to")}
      </Text>

      {/* 选择器按钮（收起状态） */}
      <TouchableRipple
        onPress={toggleExpand}
        style={[
          styles.selectorButton,
          {
            backgroundColor: theme.colors.surfaceVariant,
            borderColor: theme.colors.outlineVariant,
          },
        ]}
        borderless
      >
        <View style={styles.selectorContent}>
          {/* 左侧：图标 + 文字 */}
          <View style={styles.selectorLeft}>
            <MaterialCommunityIcons
              name="folder-outline"
              size={20}
              color={
                selectedCategory
                  ? theme.colors.onSurface
                  : theme.colors.onSurfaceVariant
              }
            />
            <Text
              variant="bodyMedium"
              style={{
                color: selectedCategory
                  ? theme.colors.onSurface
                  : theme.colors.onSurfaceVariant,
                marginLeft: 8,
              }}
              numberOfLines={1}
            >
              {displayText}
            </Text>
          </View>
          {/* 右侧：旋转箭头 */}
          <Animated.View style={arrowRotateStyle}>
            <MaterialCommunityIcons
              name="chevron-down"
              size={20}
              color={theme.colors.onSurfaceVariant}
            />
          </Animated.View>
        </View>
      </TouchableRipple>

      {/* 展开的分类列表 */}
      {isExpanded && (
        <Surface
          style={[
            styles.listContainer,
            {
              backgroundColor: theme.colors.surfaceVariant,
              borderColor: theme.colors.outlineVariant,
            },
          ]}
          elevation={1}
        >
          {/* 加载中提示 */}
          {isLoading && (
            <View style={styles.listItem}>
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                {t("common.loading")}
              </Text>
            </View>
          )}

          {/* 分类列表 */}
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat.name;
            return (
              <TouchableRipple
                key={cat.id}
                onPress={() => handleSelect(cat.name)}
                style={[
                  styles.listItem,
                  isSelected && {
                    backgroundColor: theme.colors.primaryContainer,
                  },
                ]}
              >
                <View style={styles.listItemContent}>
                  <View style={styles.listItemLeft}>
                    <MaterialCommunityIcons
                      name="folder-outline"
                      size={18}
                      color={
                        isSelected
                          ? theme.colors.onPrimaryContainer
                          : theme.colors.onSurfaceVariant
                      }
                    />
                    <Text
                      variant="bodyMedium"
                      style={{
                        color: isSelected
                          ? theme.colors.onPrimaryContainer
                          : theme.colors.onSurface,
                        marginLeft: 12,
                      }}
                      numberOfLines={1}
                    >
                      {cat.name}
                    </Text>
                  </View>
                  <View style={styles.listItemRight}>
                    {cat.noteCount > 0 && (
                      <Text
                        variant="bodySmall"
                        style={{
                          color: theme.colors.onSurfaceVariant,
                          marginRight: 8,
                        }}
                      >
                        {cat.noteCount}
                      </Text>
                    )}
                    {isSelected && (
                      <MaterialCommunityIcons
                        name="check"
                        size={18}
                        color={theme.colors.onPrimaryContainer}
                      />
                    )}
                  </View>
                </View>
              </TouchableRipple>
            );
          })}

          {/* 分隔线 */}
          <Divider style={styles.divider} />

          {/* 新建分类入口 / 输入状态 */}
          {!isCreating ? (
            <TouchableRipple
              onPress={() => setIsCreating(true)}
              style={styles.listItem}
            >
              <View style={styles.listItemLeft}>
                <MaterialCommunityIcons
                  name="plus"
                  size={18}
                  color={theme.colors.primary}
                />
                <Text
                  variant="bodyMedium"
                  style={{ color: theme.colors.primary, marginLeft: 12 }}
                >
                  {t("category.new_create")}
                </Text>
              </View>
            </TouchableRipple>
          ) : (
            <View style={styles.createRow}>
              <TextInput
                mode="outlined"
                dense
                value={newCategoryName}
                onChangeText={setNewCategoryName}
                placeholder={t("category.input_placeholder")}
                maxLength={APP_CONFIG.MAX_CATEGORY_NAME_LENGTH}
                style={styles.createInput}
                autoFocus
                onSubmitEditing={handleCreateConfirm}
              />
              <Button
                mode="contained"
                compact
                onPress={handleCreateConfirm}
                disabled={!isNewNameValid}
                style={styles.createBtn}
                labelStyle={styles.createBtnLabel}
              >
                {t("category.confirm")}
              </Button>
              <TouchableOpacity
                onPress={handleCreateCancel}
                style={styles.cancelBtn}
              >
                <Text
                  variant="labelMedium"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  {t("category.cancel")}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </Surface>
      )}
    </View>
  );
};

// ========== 样式定义 ==========
const styles = StyleSheet.create({
  container: {
    marginTop: 12,
    marginBottom: 8,
  },
  label: {
    marginBottom: 4,
  },
  selectorButton: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  selectorContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 48,
    paddingHorizontal: 16,
  },
  selectorLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  listContainer: {
    marginTop: 4,
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  listItem: {
    height: 48,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  listItemContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  listItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  listItemRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  divider: {
    marginVertical: 2,
  },
  createRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  createInput: {
    flex: 1,
    height: 36,
    fontSize: 14,
  },
  createBtn: {
    borderRadius: 8,
  },
  createBtnLabel: {
    fontSize: 13,
  },
  cancelBtn: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
});
