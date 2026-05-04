import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Button,
  Checkbox,
  IconButton,
  Surface,
  Text,
  TouchableRipple,
  useTheme,
} from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { ChatConversation } from "../../types";

interface ChatSessionDrawerProps {
  visible: boolean;
  conversations: ChatConversation[];
  currentConversationId?: string | null;
  isLoading?: boolean;
  isDeleting?: boolean;
  onDismiss: () => void;
  onNewChat: () => void;
  onSelectConversation: (conversationId: string) => void;
  onDeleteConversations: (conversationIds: string[]) => Promise<void> | void;
}

interface ConversationSection {
  id: string;
  label: string;
  conversations: ChatConversation[];
}

const startOfDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const getSectionId = (value: string) => {
  const date = new Date(value);
  const now = new Date();
  const today = startOfDay(now).getTime();
  const target = startOfDay(date).getTime();
  const diffDays = Math.floor((today - target) / 86400000);

  if (diffDays <= 0) return "today";
  if (diffDays < 7) return "this_week";
  if (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth()
  ) {
    return "this_month";
  }
  return "earlier";
};

export const ChatSessionDrawer = ({
  visible,
  conversations,
  currentConversationId,
  isLoading = false,
  isDeleting = false,
  onDismiss,
  onNewChat,
  onSelectConversation,
  onDeleteConversations,
}: ChatSessionDrawerProps) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    if (!visible) {
      setIsDeleteMode(false);
      setSelectedIds([]);
    }
  }, [visible]);

  const sections = useMemo<ConversationSection[]>(() => {
    const sectionLabels: Record<string, string> = {
      today: t("chat.session_today"),
      this_week: t("chat.session_this_week"),
      this_month: t("chat.session_this_month"),
      earlier: t("chat.session_earlier"),
    };
    const order = ["today", "this_week", "this_month", "earlier"];
    const buckets = new Map<string, ChatConversation[]>();

    conversations
      .slice()
      .sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      )
      .forEach((conversation) => {
        const sectionId = getSectionId(conversation.updated_at);
        const bucket = buckets.get(sectionId) ?? [];
        bucket.push(conversation);
        buckets.set(sectionId, bucket);
      });

    return order
      .map((id) => ({
        id,
        label: sectionLabels[id],
        conversations: buckets.get(id) ?? [],
      }))
      .filter((section) => section.conversations.length > 0);
  }, [conversations, t]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const toggleSelected = (conversationId: string) => {
    setSelectedIds((prev) =>
      prev.includes(conversationId)
        ? prev.filter((id) => id !== conversationId)
        : [...prev, conversationId],
    );
  };

  const handleNewChat = () => {
    setIsDeleteMode(false);
    setSelectedIds([]);
    onNewChat();
  };

  const handleDelete = async () => {
    if (selectedIds.length === 0) return;
    await onDeleteConversations(selectedIds);
    setSelectedIds([]);
    setIsDeleteMode(false);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <View style={styles.modalRoot}>
        <Pressable style={styles.backdrop} onPress={onDismiss} />
        <Surface
          elevation={4}
          style={[
            styles.drawer,
            {
              paddingTop: Math.max(insets.top, 16),
              paddingBottom: Math.max(insets.bottom, 16),
              backgroundColor: theme.colors.surface,
            },
          ]}
        >
          <TouchableRipple
            disabled={isDeleting}
            onPress={handleNewChat}
            style={[
              styles.newChatButton,
              { backgroundColor: theme.colors.surfaceVariant },
            ]}
          >
            <View style={styles.newChatContent}>
              <MaterialCommunityIcons
                name="chat-plus-outline"
                size={24}
                color={theme.colors.onSurface}
              />
              <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
                {t("chat.session_new_question")}
              </Text>
            </View>
          </TouchableRipple>

          <Surface
            elevation={0}
            style={[
              styles.historyPanel,
              { backgroundColor: theme.colors.surfaceVariant },
            ]}
          >
            <View style={styles.historyHeader}>
              <Text variant="titleLarge" style={{ color: theme.colors.onSurface }}>
                {t("chat.session_history")}
              </Text>
              {isDeleteMode ? (
                <Button
                  compact
                  disabled={isDeleting}
                  onPress={() => {
                    setIsDeleteMode(false);
                    setSelectedIds([]);
                  }}
                >
                  {t("common.cancel")}
                </Button>
              ) : (
                <IconButton
                  icon="trash-can-outline"
                  size={22}
                  disabled={conversations.length === 0 || isDeleting}
                  accessibilityLabel={t("chat.session_delete_mode")}
                  onPress={() => setIsDeleteMode(true)}
                />
              )}
            </View>

            {isDeleteMode ? (
              <View style={styles.deleteToolbar}>
                <Text
                  variant="bodySmall"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  {t("chat.session_selected", { count: selectedIds.length })}
                </Text>
                <Button
                  compact
                  mode="contained"
                  disabled={selectedIds.length === 0 || isDeleting}
                  loading={isDeleting}
                  onPress={handleDelete}
                >
                  {t("common.confirm")}
                </Button>
              </View>
            ) : null}

            {isLoading ? (
              <View style={styles.loadingState}>
                <ActivityIndicator size="small" />
                <Text
                  variant="bodyMedium"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  {t("common.loading")}
                </Text>
              </View>
            ) : null}

            {!isLoading && conversations.length === 0 ? (
              <View style={styles.emptyState}>
                <Text
                  variant="bodyMedium"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  {t("chat.session_empty")}
                </Text>
              </View>
            ) : null}

            {!isLoading && conversations.length > 0 ? (
              <ScrollView
                style={styles.list}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.listContent}
              >
                {sections.map((section) => (
                  <View key={section.id} style={styles.section}>
                    <Text
                      variant="bodyMedium"
                      style={[
                        styles.sectionTitle,
                        { color: theme.colors.onSurfaceVariant },
                      ]}
                    >
                      {section.label}
                    </Text>
                    {section.conversations.map((conversation) => {
                      const isCurrent = conversation.id === currentConversationId;
                      const isSelected = selectedSet.has(conversation.id);

                      return (
                        <TouchableRipple
                          key={conversation.id}
                          onPress={() =>
                            isDeleteMode
                              ? toggleSelected(conversation.id)
                              : onSelectConversation(conversation.id)
                          }
                          style={[
                            styles.conversationRow,
                            isCurrent && {
                              backgroundColor: theme.colors.primaryContainer,
                            },
                          ]}
                        >
                          <View style={styles.conversationContent}>
                            {isDeleteMode ? (
                              <Checkbox
                                status={isSelected ? "checked" : "unchecked"}
                              />
                            ) : null}
                            <Text
                              variant="bodyLarge"
                              numberOfLines={1}
                              style={[
                                styles.conversationTitle,
                                {
                                  color: isCurrent
                                    ? theme.colors.onPrimaryContainer
                                    : theme.colors.onSurface,
                                },
                              ]}
                            >
                              {conversation.title || t("chat.session_untitled")}
                            </Text>
                          </View>
                        </TouchableRipple>
                      );
                    })}
                  </View>
                ))}
              </ScrollView>
            ) : null}
          </Surface>
        </Surface>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    alignItems: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.42)",
  },
  drawer: {
    width: "78%",
    maxWidth: 360,
    height: "100%",
    paddingHorizontal: 14,
    gap: 14,
    borderTopLeftRadius: 28,
    borderBottomLeftRadius: 28,
  },
  newChatButton: {
    minHeight: 78,
    borderRadius: 16,
    justifyContent: "center",
  },
  newChatContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  historyPanel: {
    flex: 1,
    borderRadius: 16,
    overflow: "hidden",
  },
  historyHeader: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: 18,
    paddingRight: 4,
  },
  deleteToolbar: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
  },
  loadingState: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 24,
  },
  emptyState: {
    padding: 24,
    alignItems: "center",
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 16,
  },
  section: {
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  sectionTitle: {
    marginBottom: 6,
  },
  conversationRow: {
    minHeight: 52,
    borderRadius: 8,
    justifyContent: "center",
  },
  conversationContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  conversationTitle: {
    flex: 1,
  },
});

