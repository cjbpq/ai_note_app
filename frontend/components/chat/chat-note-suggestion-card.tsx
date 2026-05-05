import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  Button,
  Chip,
  Surface,
  Text,
  TouchableRipple,
  useTheme,
} from "react-native-paper";
import { useTranslation } from "react-i18next";

import { ChatNoteSuggestion } from "../../types";

interface ChatNoteSuggestionCardProps {
  suggestion: ChatNoteSuggestion;
  isSaving?: boolean;
  isDismissing?: boolean;
  onAccept: (suggestion: ChatNoteSuggestion) => void;
  onDismiss: (suggestion: ChatNoteSuggestion) => void;
  onViewNote: (noteId: string) => void;
}

export const ChatNoteSuggestionCard = ({
  suggestion,
  isSaving = false,
  isDismissing = false,
  onAccept,
  onDismiss,
  onViewNote,
}: ChatNoteSuggestionCardProps) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const isAccepted = suggestion.status === "accepted";
  const isDismissed = suggestion.status === "dismissed";
  const isBusy = isSaving || isDismissing;

  if (isDismissed) {
    return (
      <Surface
        elevation={0}
        style={[
          styles.card,
          styles.compactCard,
          {
            borderColor: theme.colors.outlineVariant,
            backgroundColor: theme.colors.surface,
          },
        ]}
      >
        <MaterialCommunityIcons
          name="note-off-outline"
          size={18}
          color={theme.colors.onSurfaceVariant}
        />
        <Text
          variant="bodySmall"
          style={[styles.compactText, { color: theme.colors.onSurfaceVariant }]}
          numberOfLines={1}
        >
          {t("chat.suggestion_dismissed")}
        </Text>
      </Surface>
    );
  }

  return (
    <Surface
      elevation={0}
      style={[
        styles.card,
        {
          borderColor: isAccepted
            ? theme.colors.primary
            : theme.colors.outlineVariant,
          backgroundColor: theme.colors.surface,
        },
      ]}
    >
      <View style={styles.header}>
        <View
          style={[
            styles.iconBox,
            { backgroundColor: theme.colors.secondaryContainer },
          ]}
        >
          <MaterialCommunityIcons
            name={isAccepted ? "note-check-outline" : "note-edit-outline"}
            size={18}
            color={theme.colors.onSecondaryContainer}
          />
        </View>
        <View style={styles.headerText}>
          <Text variant="labelLarge" style={{ color: theme.colors.onSurface }}>
            {isAccepted
              ? t("chat.suggestion_saved")
              : t("chat.suggestion_title")}
          </Text>
          <Text
            variant="bodySmall"
            style={{ color: theme.colors.onSurfaceVariant }}
            numberOfLines={1}
          >
            {suggestion.category || t("chat.suggestion_default_category")}
          </Text>
        </View>
      </View>

      <Text
        variant="titleSmall"
        style={[styles.noteTitle, { color: theme.colors.onSurface }]}
      >
        {suggestion.title}
      </Text>

      <TouchableRipple
        onPress={() => setIsExpanded((current) => !current)}
        style={styles.contentToggle}
      >
        <View>
          <Text
            variant="bodySmall"
            numberOfLines={isExpanded ? undefined : 5}
            style={[styles.content, { color: theme.colors.onSurfaceVariant }]}
          >
            {suggestion.content}
          </Text>
          <Text
            variant="labelSmall"
            style={[styles.expandText, { color: theme.colors.primary }]}
          >
            {isExpanded
              ? t("chat.suggestion_collapse")
              : t("chat.suggestion_expand")}
          </Text>
        </View>
      </TouchableRipple>

      {suggestion.tags.length > 0 ? (
        <View style={styles.tags}>
          {suggestion.tags.slice(0, 4).map((tag) => (
            <Chip key={tag} compact style={styles.tag}>
              {tag}
            </Chip>
          ))}
        </View>
      ) : null}

      <View style={styles.actions}>
        {isAccepted && suggestion.note_id ? (
          <Button
            mode="contained-tonal"
            compact
            icon="open-in-new"
            onPress={() => onViewNote(suggestion.note_id!)}
          >
            {t("chat.suggestion_view_note")}
          </Button>
        ) : (
          <>
            <Button
              mode="text"
              compact
              disabled={isBusy}
              loading={isDismissing}
              onPress={() => onDismiss(suggestion)}
            >
              {t("chat.suggestion_dismiss")}
            </Button>
            <Button
              mode="contained"
              compact
              icon="content-save-outline"
              disabled={isBusy}
              loading={isSaving}
              onPress={() => onAccept(suggestion)}
            >
              {t("chat.suggestion_save")}
            </Button>
          </>
        )}
      </View>
    </Surface>
  );
};

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  compactCard: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  compactText: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    flex: 1,
  },
  noteTitle: {
    lineHeight: 20,
  },
  contentToggle: {
    borderRadius: 8,
  },
  content: {
    lineHeight: 19,
  },
  expandText: {
    marginTop: 4,
  },
  tags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  tag: {
    height: 28,
  },
  actions: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
  },
});
