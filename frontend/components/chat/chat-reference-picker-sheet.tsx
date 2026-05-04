import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import {
  Divider,
  IconButton,
  Surface,
  Text,
  TouchableRipple,
  useTheme,
} from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ChatReferenceChipBar } from "./chat-reference-chip-bar";
import { ChatReferenceNote, Note, NoteCategory } from "../../types";
import { UNCATEGORIZED_ID } from "../../utils/noteFilters";

const ALL_NOTES_ID = "__all_notes__";

interface ChatReferencePickerSheetProps {
  visible: boolean;
  notes: Note[];
  categories: NoteCategory[];
  activeReferences: ChatReferenceNote[];
  selectedIds: string[];
  isLoading?: boolean;
  isLimitReached?: boolean;
  onRemoveReference: (id: string) => void;
  onSelect: (note: ChatReferenceNote) => void;
  onDismiss: () => void;
}

export const ChatReferencePickerSheet = ({
  visible,
  notes,
  categories,
  activeReferences,
  selectedIds,
  isLoading = false,
  isLimitReached = false,
  onRemoveReference,
  onSelect,
  onDismiss,
}: ChatReferencePickerSheetProps) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { t } = useTranslation();
  const [expandedId, setExpandedId] = useState<string>(ALL_NOTES_ID);

  useEffect(() => {
    if (visible) {
      setExpandedId(ALL_NOTES_ID);
    }
  }, [visible]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const sortedNotes = useMemo(() => {
    return [...notes].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  }, [notes]);

  const sections = useMemo(() => {
    const uncategorizedNotes = sortedNotes.filter(
      (note) => !note.category?.trim(),
    );

    return [
      {
        id: ALL_NOTES_ID,
        label: t("category.all"),
        icon: "folder-multiple-outline",
        notes: sortedNotes,
      },
      {
        id: UNCATEGORIZED_ID,
        label: t("category.uncategorized"),
        icon: "folder-alert-outline",
        notes: uncategorizedNotes,
      },
      ...categories.map((category) => ({
        id: category.name,
        label: category.name,
        icon: "folder-outline",
        notes: sortedNotes.filter(
          (note) => note.category?.trim() === category.name,
        ),
      })),
    ];
  }, [categories, sortedNotes, t]);

  const sheetHeight = Math.round(height * 0.72);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <View style={styles.modalRoot}>
        <Pressable style={styles.backdrop} onPress={onDismiss} />
        <Surface
          elevation={3}
          style={[
            styles.sheet,
            {
              height: sheetHeight,
              paddingBottom: Math.max(insets.bottom, 16),
              backgroundColor: theme.colors.surface,
            },
          ]}
        >
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
                {t("chat.reference_picker_title")}
              </Text>
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                {isLimitReached
                  ? t("chat.reference_limit_reached", { count: 20 })
                  : t("chat.reference_picker_subtitle")}
              </Text>
            </View>
            <IconButton icon="close" size={20} onPress={onDismiss} />
          </View>
          <Divider />

          <ScrollView
            style={styles.scrollArea}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.currentReferences}>
              <View style={styles.currentReferencesHeader}>
                <Text
                  variant="titleSmall"
                  style={{ color: theme.colors.onSurface }}
                >
                  {t("chat.current_references")}
                </Text>
                <Text
                  variant="labelSmall"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  {activeReferences.length} / 20
                </Text>
              </View>
              <Text
                variant="bodySmall"
                style={[
                  styles.currentReferencesHint,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                {t("chat.current_references_hint")}
              </Text>
              {activeReferences.length > 0 ? (
                <ChatReferenceChipBar
                  references={activeReferences}
                  onRemove={onRemoveReference}
                />
              ) : (
                <Text
                  variant="bodySmall"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  {t("chat.current_references_empty")}
                </Text>
              )}
            </View>
            <Divider />

            {isLoading ? (
              <View style={styles.emptyState}>
                <Text
                  variant="bodyMedium"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  {t("common.loading")}
                </Text>
              </View>
            ) : null}

            {!isLoading && sections.length === 0 ? (
              <View style={styles.emptyState}>
                <Text
                  variant="bodyMedium"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  {t("chat.reference_picker_empty")}
                </Text>
              </View>
            ) : null}

            {!isLoading
              ? sections.map((section) => {
                  const isExpanded = expandedId === section.id;
                  return (
                    <View key={section.id} style={styles.section}>
                      <TouchableRipple
                        onPress={() =>
                          setExpandedId((current) =>
                            current === section.id ? "" : section.id,
                          )
                        }
                        style={styles.sectionHeader}
                      >
                        <View style={styles.sectionHeaderContent}>
                          <View style={styles.sectionLeft}>
                            <MaterialCommunityIcons
                              name={section.icon as any}
                              size={22}
                              color={theme.colors.onSurfaceVariant}
                            />
                            <Text
                              variant="bodyLarge"
                              numberOfLines={1}
                              style={[
                                styles.sectionTitle,
                                { color: theme.colors.onSurface },
                              ]}
                            >
                              {section.label}
                            </Text>
                          </View>
                          <View style={styles.sectionRight}>
                            <Text
                              variant="bodySmall"
                              style={{ color: theme.colors.onSurfaceVariant }}
                            >
                              {section.notes.length}
                            </Text>
                            <MaterialCommunityIcons
                              name={isExpanded ? "chevron-up" : "chevron-down"}
                              size={22}
                              color={theme.colors.onSurfaceVariant}
                            />
                          </View>
                        </View>
                      </TouchableRipple>

                      {isExpanded ? (
                        <View style={styles.noteList}>
                          {section.notes.length === 0 ? (
                            <Text
                              variant="bodySmall"
                              style={[
                                styles.sectionEmpty,
                                { color: theme.colors.onSurfaceVariant },
                              ]}
                            >
                              {t("category.empty_state")}
                            </Text>
                          ) : (
                            section.notes.map((note) => {
                              const isSelected = selectedSet.has(note.id);
                              return (
                                <ReferenceNoteRow
                                  key={note.id}
                                  note={note}
                                  isSelected={isSelected}
                                  disabled={
                                    isSelected || (!isSelected && isLimitReached)
                                  }
                                  onSelect={onSelect}
                                />
                              );
                            })
                          )}
                        </View>
                      ) : null}
                    </View>
                  );
                })
              : null}
          </ScrollView>
        </Surface>
      </View>
    </Modal>
  );
};

interface ReferenceNoteRowProps {
  note: Note;
  isSelected: boolean;
  disabled: boolean;
  onSelect: (note: ChatReferenceNote) => void;
}

const ReferenceNoteRow = ({
  note,
  isSelected,
  disabled,
  onSelect,
}: ReferenceNoteRowProps) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const imageUrl = note.imageUrls?.[0];

  return (
    <TouchableRipple
      disabled={disabled}
      onPress={() =>
        onSelect({
          id: note.id,
          title: note.title,
          imageUrl,
          category: note.category,
        })
      }
      style={[
        styles.noteRow,
        disabled && { opacity: isSelected ? 1 : 0.48 },
      ]}
    >
      <View style={styles.noteRowContent}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.noteThumbnail} />
        ) : (
          <View
            style={[
              styles.noteThumbnailFallback,
              { backgroundColor: theme.colors.primaryContainer },
            ]}
          >
            <MaterialCommunityIcons
              name="note-text-outline"
              size={20}
              color={theme.colors.onPrimaryContainer}
            />
          </View>
        )}
        <Text
          variant="bodyMedium"
          numberOfLines={2}
          style={[styles.noteTitle, { color: theme.colors.onSurface }]}
        >
          {note.title}
        </Text>
        {isSelected ? (
          <View
            style={[
              styles.selectedBadge,
              { backgroundColor: theme.colors.secondaryContainer },
            ]}
          >
            <Text
              variant="labelSmall"
              style={{ color: theme.colors.onSecondaryContainer }}
            >
              {t("chat.reference_added")}
            </Text>
          </View>
        ) : null}
      </View>
    </TouchableRipple>
  );
};

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.42)",
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: "hidden",
  },
  handle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    marginTop: 8,
    marginBottom: 4,
    backgroundColor: "rgba(128, 128, 128, 0.45)",
  },
  header: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 16,
    paddingRight: 4,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  scrollArea: {
    flex: 1,
  },
  emptyState: {
    padding: 24,
    alignItems: "center",
  },
  currentReferences: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  currentReferencesHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  currentReferencesHint: {
    lineHeight: 18,
  },
  section: {
    paddingHorizontal: 8,
  },
  sectionHeader: {
    minHeight: 52,
    borderRadius: 8,
    justifyContent: "center",
  },
  sectionHeaderContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
  },
  sectionLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  sectionTitle: {
    flex: 1,
    marginLeft: 12,
  },
  sectionRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  noteList: {
    paddingBottom: 8,
  },
  sectionEmpty: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  noteRow: {
    minHeight: 64,
    borderRadius: 8,
  },
  noteRowContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  noteThumbnail: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  noteThumbnailFallback: {
    width: 48,
    height: 48,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  noteTitle: {
    flex: 1,
    marginLeft: 12,
  },
  selectedBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 8,
  },
});
