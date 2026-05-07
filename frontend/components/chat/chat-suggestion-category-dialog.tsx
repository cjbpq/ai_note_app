import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import {
  ActivityIndicator,
  Button,
  Divider,
  Surface,
  Text,
  TextInput,
  TouchableRipple,
  useTheme,
} from "react-native-paper";
import { useTranslation } from "react-i18next";

import { APP_CONFIG } from "../../constants/config";
import { NoteCategory } from "../../types";

interface ChatSuggestionCategoryDialogProps {
  visible: boolean;
  categories: NoteCategory[];
  recommendedCategory?: string | null;
  isLoading?: boolean;
  isSaving?: boolean;
  onDismiss: () => void;
  onConfirm: (category: string) => void;
}

const normalizeCategoryName = (value?: string | null) => value?.trim() ?? "";

export const ChatSuggestionCategoryDialog = ({
  visible,
  categories,
  recommendedCategory,
  isLoading = false,
  isSaving = false,
  onDismiss,
  onConfirm,
}: ChatSuggestionCategoryDialogProps) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const { height: windowHeight } = useWindowDimensions();
  const defaultCategory = t("chat.suggestion_default_category");
  const normalizedRecommended =
    normalizeCategoryName(recommendedCategory) || defaultCategory;
  const [selectedCategory, setSelectedCategory] = useState(
    normalizedRecommended,
  );
  const [query, setQuery] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [draftCreatedCategories, setDraftCreatedCategories] = useState<
    NoteCategory[]
  >([]);

  useEffect(() => {
    const showSubscription = Keyboard.addListener("keyboardDidShow", (event) => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hideSubscription = Keyboard.addListener("keyboardDidHide", () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!visible) return;
    setSelectedCategory(normalizedRecommended);
    setQuery("");
    setIsCreating(false);
    setNewCategoryName("");
    setDraftCreatedCategories([]);
  }, [normalizedRecommended, visible]);

  const selectableCategories = useMemo(() => {
    const existingNames = new Set(categories.map((category) => category.name));
    const draftOnly = draftCreatedCategories.filter(
      (category) => !existingNames.has(category.name),
    );
    return [...draftOnly, ...categories];
  }, [categories, draftCreatedCategories]);

  const existingCategoryNames = useMemo(
    () => new Set(selectableCategories.map((category) => category.name)),
    [selectableCategories],
  );
  const recommendedCategoryData = selectableCategories.find(
    (category) => category.name === normalizedRecommended,
  );
  const isRecommendedNew = !existingCategoryNames.has(normalizedRecommended);
  const trimmedQuery = query.trim();
  const filteredCategories = selectableCategories.filter((category) => {
    if (category.name === normalizedRecommended) return false;
    if (!trimmedQuery) return true;
    return category.name.toLowerCase().includes(trimmedQuery.toLowerCase());
  });
  const trimmedNewCategoryName = newCategoryName.trim();
  const isNewCategoryValid =
    trimmedNewCategoryName.length > 0 &&
    trimmedNewCategoryName.length <= APP_CONFIG.MAX_CATEGORY_NAME_LENGTH &&
    !existingCategoryNames.has(trimmedNewCategoryName);

  const handleConfirm = () => {
    const normalizedSelected = selectedCategory.trim();
    if (!normalizedSelected || isSaving) return;
    Keyboard.dismiss();
    onConfirm(normalizedSelected);
  };

  const handleCreateConfirm = () => {
    if (!isNewCategoryValid) return;
    const nextCategory = trimmedNewCategoryName;
    setDraftCreatedCategories((prev) =>
      prev.some((category) => category.name === nextCategory)
        ? prev
        : [{ id: nextCategory, name: nextCategory, noteCount: 0 }, ...prev],
    );
    setSelectedCategory(nextCategory);
    setNewCategoryName("");
    setIsCreating(false);
    Keyboard.dismiss();
  };

  const handleCreateCancel = () => {
    setNewCategoryName("");
    setIsCreating(false);
    Keyboard.dismiss();
  };

  const isKeyboardVisible = keyboardHeight > 0;
  const safePanelMaxHeight =
    Platform.OS === "android" && isKeyboardVisible
      ? Math.max(360, windowHeight - keyboardHeight - 52)
      : Math.round(windowHeight * 0.72);
  const listMaxHeight =
    Platform.OS === "android" && isKeyboardVisible
      ? isCreating
        ? 142
        : 190
      : 246;
  const modalRootStyle = [
    styles.modalRoot,
    Platform.OS === "android" && isKeyboardVisible
      ? {
          justifyContent: "flex-start" as const,
          paddingTop: 72,
          paddingBottom: keyboardHeight + 10,
        }
      : null,
  ];

  const isDraftCategory = (categoryName: string) => {
    return draftCreatedCategories.some(
      (category) => category.name === categoryName,
    );
  };

  const renderCategoryRow = (
    categoryName: string,
    options: {
      icon: keyof typeof MaterialCommunityIcons.glyphMap;
      noteCount?: number;
      isRecommended?: boolean;
      isNew?: boolean;
    },
  ) => {
    const isSelected = selectedCategory === categoryName;
    return (
      <TouchableRipple
        key={`${options.isRecommended ? "recommended" : "category"}-${categoryName}`}
        onPress={() => setSelectedCategory(categoryName)}
        style={[
          styles.categoryRow,
          {
            backgroundColor: isSelected
              ? theme.colors.primaryContainer
              : "transparent",
          },
        ]}
        borderless
      >
        <View style={styles.categoryRowContent}>
          <View style={styles.categoryRowLeft}>
            <MaterialCommunityIcons
              name={options.icon}
              size={20}
              color={
                isSelected
                  ? theme.colors.onPrimaryContainer
                  : theme.colors.onSurfaceVariant
              }
            />
            <View style={styles.categoryTextBlock}>
              <Text
                variant="bodyMedium"
                numberOfLines={1}
                style={{
                  color: isSelected
                    ? theme.colors.onPrimaryContainer
                    : theme.colors.onSurface,
                }}
              >
                {categoryName}
              </Text>
              <View style={styles.metaRow}>
                {options.isRecommended ? (
                  <Text
                    variant="labelSmall"
                    style={{
                      color: isSelected
                        ? theme.colors.onPrimaryContainer
                        : theme.colors.primary,
                    }}
                  >
                    {t("chat.suggestion_category_ai_recommended")}
                  </Text>
                ) : null}
                {options.isNew ? (
                  <Text
                    variant="labelSmall"
                    style={{
                      color: isSelected
                        ? theme.colors.onPrimaryContainer
                        : theme.colors.onSurfaceVariant,
                    }}
                  >
                    {t("chat.suggestion_category_new")}
                  </Text>
                ) : null}
                {!options.isNew && options.noteCount != null ? (
                  <Text
                    variant="labelSmall"
                    style={{
                      color: isSelected
                        ? theme.colors.onPrimaryContainer
                        : theme.colors.onSurfaceVariant,
                    }}
                  >
                    {t("category.note_count", { count: options.noteCount })}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>
          {isSelected ? (
            <MaterialCommunityIcons
              name="check"
              size={20}
              color={theme.colors.onPrimaryContainer}
            />
          ) : null}
        </View>
      </TouchableRipple>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={isSaving ? undefined : onDismiss}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={modalRootStyle}
      >
        <Pressable
          style={styles.backdrop}
          disabled={isSaving}
          onPress={onDismiss}
        />
        <Surface
          elevation={4}
          style={[
            styles.panel,
            {
              backgroundColor: theme.colors.surface,
              maxHeight: safePanelMaxHeight,
            },
          ]}
        >
          <View style={styles.header}>
            <Text variant="headlineSmall" style={{ color: theme.colors.onSurface }}>
              {t("chat.suggestion_category_title")}
            </Text>
          </View>

          <View style={styles.content}>
            <TextInput
              mode="outlined"
              dense
              value={query}
              onChangeText={setQuery}
              placeholder={t("chat.suggestion_category_search_placeholder")}
              left={<TextInput.Icon icon="magnify" />}
              maxLength={APP_CONFIG.MAX_CATEGORY_NAME_LENGTH}
            />

            <ScrollView
              style={[styles.list, { maxHeight: listMaxHeight }]}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {renderCategoryRow(normalizedRecommended, {
                icon: "auto-fix",
                noteCount: recommendedCategoryData?.noteCount,
                isRecommended: true,
                isNew: isRecommendedNew,
              })}

              <Divider />

              {isLoading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" />
                  <Text
                    variant="bodySmall"
                    style={{ color: theme.colors.onSurfaceVariant }}
                  >
                    {t("common.loading")}
                  </Text>
                </View>
              ) : null}

              {filteredCategories.map((category) =>
                renderCategoryRow(category.name, {
                  icon: isDraftCategory(category.name)
                    ? "folder-plus-outline"
                    : "folder-outline",
                  noteCount: category.noteCount,
                  isNew: isDraftCategory(category.name),
                }),
              )}

              {!isLoading && filteredCategories.length === 0 ? (
                <Text
                  variant="bodySmall"
                  style={[
                    styles.emptyText,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  {t("chat.suggestion_category_no_results")}
                </Text>
              ) : null}
            </ScrollView>
          </View>

          <Divider />

          <View style={styles.footer}>
            {!isCreating ? (
              <TouchableRipple
                onPress={() => setIsCreating(true)}
                style={styles.createEntry}
                borderless
              >
                <View style={styles.categoryRowLeft}>
                  <MaterialCommunityIcons
                    name="plus"
                    size={20}
                    color={theme.colors.primary}
                  />
                  <Text
                    variant="bodyMedium"
                    style={{ color: theme.colors.primary }}
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
                <View style={styles.createActions}>
                  <Button
                    mode="contained"
                    compact
                    disabled={!isNewCategoryValid}
                    onPress={handleCreateConfirm}
                    labelStyle={styles.createButtonLabel}
                  >
                    {t("category.confirm")}
                  </Button>
                  <Button compact onPress={handleCreateCancel}>
                    {t("category.cancel")}
                  </Button>
                </View>
              </View>
            )}

            <View style={styles.actions}>
              <Button disabled={isSaving} onPress={onDismiss}>
                {t("common.cancel")}
              </Button>
              <Button
                mode="contained"
                loading={isSaving}
                disabled={!selectedCategory.trim() || isSaving}
                onPress={handleConfirm}
              >
                {t("chat.suggestion_category_confirm")}
              </Button>
            </View>
          </View>
        </Surface>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.46)",
  },
  panel: {
    width: "100%",
    borderRadius: 8,
    overflow: "hidden",
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 10,
  },
  content: {
    gap: 8,
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  list: {
    flexShrink: 1,
  },
  listContent: {
    gap: 3,
    paddingBottom: 4,
  },
  categoryRow: {
    minHeight: 48,
    borderRadius: 8,
    overflow: "hidden",
  },
  categoryRowContent: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 8,
  },
  categoryRowLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  categoryTextBlock: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  loadingRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
  },
  emptyText: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  footer: {
    gap: 8,
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 14,
  },
  createEntry: {
    minHeight: 40,
    borderRadius: 8,
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  createRow: {
    gap: 8,
  },
  createActions: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
  },
  createInput: {
    height: 38,
  },
  createButtonLabel: {
    fontSize: 13,
  },
  actions: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
  },
});
