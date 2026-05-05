import { Href, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
} from "react-native";
import {
  Appbar,
  IconButton,
  Surface,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import {
  ChatMessageContent,
  needsStableChatBubbleWidth,
} from "../components/chat/chat-message-content";
import { ChatNoteSuggestionCard } from "../components/chat/chat-note-suggestion-card";
import { ChatReferenceChipBar } from "../components/chat/chat-reference-chip-bar";
import { ChatReferencePickerSheet } from "../components/chat/chat-reference-picker-sheet";
import { ChatSessionDrawer } from "../components/chat/chat-session-drawer";
import { useChat } from "../hooks/useChat";
import { useChatConversations } from "../hooks/useChatConversations";
import { useCategories } from "../hooks/useCategories";
import { useNotes } from "../hooks/useNotes";
import { useToast } from "../hooks/useToast";
import { chatService } from "../services/chatService";
import { noteService } from "../services/noteService";
import {
  ChatConversationDetailResponse,
  ChatMessage,
  ChatNoteSuggestion,
  ChatReferenceNote,
  ServiceError,
} from "../types";

const MAX_REFERENCE_NOTES = 20;

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return !!value && typeof value === "object" && !Array.isArray(value);
};

const getMessageReferences = (
  metadata: Record<string, unknown> | undefined,
): ChatReferenceNote[] => {
  const rawReferences = metadata?.referenceNotes;

  if (Array.isArray(rawReferences)) {
    return rawReferences
      .filter(isRecord)
      .map((reference) => ({
        id:
          typeof reference.id === "string"
            ? reference.id
            : typeof reference.referenceNoteId === "string"
              ? reference.referenceNoteId
              : "",
        title:
          typeof reference.title === "string"
            ? reference.title
            : typeof reference.referenceTitle === "string"
              ? reference.referenceTitle
              : "",
        imageUrl:
          typeof reference.imageUrl === "string"
            ? reference.imageUrl
            : undefined,
        category:
          typeof reference.category === "string"
            ? reference.category
            : undefined,
      }))
      .filter((reference) => reference.id && reference.title);
  }

  if (
    typeof metadata?.referenceNoteId === "string" &&
    typeof metadata.referenceTitle === "string"
  ) {
    return [
      {
        id: metadata.referenceNoteId,
        title: metadata.referenceTitle,
      },
    ];
  }

  return [];
};

const getReferencedNoteIds = (
  metadata: Record<string, unknown> | undefined,
): string[] => {
  const rawIds = metadata?.referenced_note_ids;
  if (!Array.isArray(rawIds)) return [];
  return rawIds.filter((id): id is string => typeof id === "string" && !!id);
};

const getMessageSuggestions = (
  metadata: Record<string, unknown> | undefined,
): ChatNoteSuggestion[] => {
  const rawSuggestions = metadata?.suggestions;
  if (!Array.isArray(rawSuggestions)) return [];
  return rawSuggestions.filter(
    (suggestion): suggestion is ChatNoteSuggestion =>
      isRecord(suggestion) && typeof suggestion.id === "string",
  );
};

const mergeReferences = (
  ...groups: ChatReferenceNote[][]
): ChatReferenceNote[] => {
  const references = new Map<string, ChatReferenceNote>();
  groups.flat().forEach((reference) => {
    if (!references.has(reference.id)) {
      references.set(reference.id, reference);
    }
  });
  return Array.from(references.values());
};

export default function ChatScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { showWarning, showSuccess, showError } = useToast();
  const { notes, isLoading: isNotesLoading } = useNotes();
  const { categories } = useCategories();
  const { noteId, noteTitle } = useLocalSearchParams<{
    noteId?: string;
    noteTitle?: string;
  }>();
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const hasAppliedRouteReferenceRef = useRef(false);
  const [draft, setDraft] = useState("");
  const [sessionReferences, setSessionReferences] = useState<
    ChatReferenceNote[]
  >([]);
  const [draftReferences, setDraftReferences] = useState<ChatReferenceNote[]>(
    [],
  );
  const [isReferencePickerVisible, setIsReferencePickerVisible] =
    useState(false);
  const [isSessionDrawerVisible, setIsSessionDrawerVisible] = useState(false);
  const [savingSuggestionId, setSavingSuggestionId] = useState<string | null>(
    null,
  );
  const [dismissingSuggestionId, setDismissingSuggestionId] = useState<
    string | null
  >(null);

  const referenceNoteId = useMemo(() => {
    return Array.isArray(noteId) ? noteId[0] : noteId;
  }, [noteId]);

  const routeReference = useMemo<ChatReferenceNote | null>(() => {
    if (!referenceNoteId) return null;

    const noteFromList = notes.find((note) => note.id === referenceNoteId);
    const routeTitle = Array.isArray(noteTitle) ? noteTitle[0] : noteTitle;

    return {
      id: referenceNoteId,
      title:
        noteFromList?.title ?? routeTitle ?? t("chat.reference_note_fallback"),
      imageUrl: noteFromList?.imageUrls?.[0],
      category: noteFromList?.category,
    };
  }, [noteTitle, notes, referenceNoteId, t]);

  const referenceMap = useMemo(() => {
    const map = new Map<string, ChatReferenceNote>();
    notes.forEach((note) => {
      map.set(note.id, {
        id: note.id,
        title: note.title,
        imageUrl: note.imageUrls?.[0],
        category: note.category,
      });
    });
    if (routeReference) {
      map.set(routeReference.id, routeReference);
    }
    return map;
  }, [notes, routeReference]);

  const {
    messages,
    conversationId,
    isStreaming,
    sendMessage,
    stopStreaming,
    resetChat,
    restoreConversation,
    updateSuggestion,
  } = useChat();
  const {
    conversations,
    isLoading: isConversationsLoading,
    isRefreshing: isConversationsRefreshing,
    loadConversation,
    isLoadingConversation,
    batchDeleteConversations,
    isBatchDeleting,
    invalidateConversations,
  } = useChatConversations();

  const canSend = draft.trim().length > 0 && !isStreaming;
  const selectedReferences = useMemo(
    () => mergeReferences(sessionReferences, draftReferences),
    [draftReferences, sessionReferences],
  );
  const isReferenceLimitReached =
    selectedReferences.length >= MAX_REFERENCE_NOTES;
  const composerBottomPadding =
    Platform.OS === "ios"
      ? Math.max(insets.bottom, 12)
      : Math.max(insets.bottom, 32);

  const createReferenceFromId = useCallback(
    (id: string): ChatReferenceNote => {
      return (
        referenceMap.get(id) ?? {
          id,
          title: t("chat.reference_note_fallback"),
        }
      );
    },
    [referenceMap, t],
  );

  const hydrateConversationReferences = useCallback(
    (detail: ChatConversationDetailResponse) => {
      const knownIds = new Set<string>();
      const restoredReferences: ChatReferenceNote[] = [];

      const messages = detail.messages
        .slice()
        .sort((a, b) => a.sequence - b.sequence)
        .map((message) => {
          if (message.role !== "user") return message;

          const requestReferenceIds = getReferencedNoteIds(message.metadata);
          const newReferenceIds = requestReferenceIds.filter(
            (id) => !knownIds.has(id),
          );

          requestReferenceIds.forEach((id) => {
            if (!knownIds.has(id)) {
              knownIds.add(id);
              restoredReferences.push(createReferenceFromId(id));
            }
          });

          return {
            ...message,
            metadata: {
              ...(message.metadata ?? {}),
              referenced_note_ids: requestReferenceIds,
              referenceNotes: newReferenceIds.map(createReferenceFromId),
            },
          };
        });

      return {
        detail: {
          ...detail,
          messages,
        },
        sessionReferences: restoredReferences,
      };
    },
    [createReferenceFromId],
  );

  useEffect(() => {
    if (!routeReference || hasAppliedRouteReferenceRef.current) return;

    hasAppliedRouteReferenceRef.current = true;
    setDraftReferences((prev) =>
      prev.some((reference) => reference.id === routeReference.id)
        ? prev
        : [routeReference, ...prev],
    );
  }, [routeReference]);

  useEffect(() => {
    if (!routeReference || !hasAppliedRouteReferenceRef.current) return;

    setSessionReferences((prev) =>
      prev.map((reference) =>
        reference.id === routeReference.id
          ? {
              ...reference,
              title: routeReference.title,
              imageUrl: routeReference.imageUrl,
              category: routeReference.category,
            }
          : reference,
      ),
    );
    setDraftReferences((prev) =>
      prev.map((reference) =>
        reference.id === routeReference.id
          ? {
              ...reference,
              title: routeReference.title,
              imageUrl: routeReference.imageUrl,
              category: routeReference.category,
            }
          : reference,
      ),
    );
  }, [routeReference]);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/(tabs)/read" as Href);
  }, [router]);

  const handleSend = useCallback(() => {
    if (!draft.trim() || isStreaming) {
      void sendMessage(draft);
      return;
    }

    const message = draft;
    const referencedNotes = mergeReferences(
      sessionReferences,
      draftReferences,
    );
    const displayReferencedNotes = draftReferences;
    setDraft("");
    setSessionReferences(referencedNotes.slice(0, MAX_REFERENCE_NOTES));
    setDraftReferences([]);
    void sendMessage(message, { referencedNotes, displayReferencedNotes }).then(
      (success) => {
        if (success) {
          void invalidateConversations();
        }
      },
    );
  }, [
    draft,
    draftReferences,
    invalidateConversations,
    isStreaming,
    sessionReferences,
    sendMessage,
  ]);

  const handleResetChat = useCallback(() => {
    resetChat();
    setDraft("");
    setSessionReferences([]);
    setDraftReferences(routeReference ? [routeReference] : []);
    setIsSessionDrawerVisible(false);
  }, [resetChat, routeReference]);

  const handleOpenSessionDrawer = useCallback(() => {
    setIsSessionDrawerVisible(true);
    void invalidateConversations();
  }, [invalidateConversations]);

  const handleSelectConversation = useCallback(
    async (selectedConversationId: string) => {
      if (isStreaming || isLoadingConversation) return;
      if (selectedConversationId === conversationId) {
        setIsSessionDrawerVisible(false);
        return;
      }

      try {
        const detail = await loadConversation(selectedConversationId);
        const hydrated = hydrateConversationReferences(detail);
        restoreConversation(hydrated.detail);
        setDraft("");
        setSessionReferences(hydrated.sessionReferences);
        setDraftReferences([]);
        setIsReferencePickerVisible(false);
        setIsSessionDrawerVisible(false);
      } catch {
        // Error toast is handled inside the mutation hook.
      }
    },
    [
      conversationId,
      hydrateConversationReferences,
      isLoadingConversation,
      isStreaming,
      loadConversation,
      restoreConversation,
    ],
  );

  const handleDeleteConversations = useCallback(
    async (conversationIds: string[]) => {
      if (conversationIds.length === 0) return;
      try {
        await batchDeleteConversations(conversationIds);
        if (conversationId && conversationIds.includes(conversationId)) {
          handleResetChat();
        }
      } catch {
        // Error toast is handled inside the mutation hook.
      }
    },
    [batchDeleteConversations, conversationId, handleResetChat],
  );

  const handleOpenReferencePicker = useCallback(() => {
    if (isStreaming) return;
    setIsReferencePickerVisible(true);
  }, [isStreaming]);

  const handleSelectReference = useCallback(
    (note: ChatReferenceNote) => {
      setDraftReferences((prev) => {
        const selected = mergeReferences(sessionReferences, prev);
        if (selected.some((reference) => reference.id === note.id)) {
          return prev;
        }
        if (selected.length >= MAX_REFERENCE_NOTES) {
          showWarning(
            t("chat.reference_limit_reached", { count: MAX_REFERENCE_NOTES }),
          );
          return prev;
        }
        return [...prev, note];
      });
      setIsReferencePickerVisible(false);
    },
    [sessionReferences, showWarning, t],
  );

  const handleRemoveReference = useCallback((id: string) => {
    setDraftReferences((prev) => prev.filter((reference) => reference.id !== id));
  }, []);

  const handleAcceptSuggestion = useCallback(
    async (suggestion: ChatNoteSuggestion) => {
      if (savingSuggestionId || dismissingSuggestionId) return;

      setSavingSuggestionId(suggestion.id);
      try {
        const result = await chatService.acceptSuggestion(suggestion.id);
        updateSuggestion(result.suggestion);

        const note = await noteService.getNoteById(result.note_id);
        await noteService.syncNoteToLocal(note);
        await queryClient.invalidateQueries({ queryKey: ["notes"] });
        await queryClient.invalidateQueries({ queryKey: ["note"] });
        await queryClient.invalidateQueries({ queryKey: ["categories"] });

        showSuccess(t("chat.suggestion_save_success"), { duration: 1400 });
      } catch (error) {
        showError(
          error instanceof ServiceError
            ? error.message
            : t("error.chat.suggestionAcceptFailed"),
        );
      } finally {
        setSavingSuggestionId(null);
      }
    },
    [
      dismissingSuggestionId,
      queryClient,
      savingSuggestionId,
      showError,
      showSuccess,
      t,
      updateSuggestion,
    ],
  );

  const handleDismissSuggestion = useCallback(
    async (suggestion: ChatNoteSuggestion) => {
      if (savingSuggestionId || dismissingSuggestionId) return;

      setDismissingSuggestionId(suggestion.id);
      try {
        const dismissed = await chatService.dismissSuggestion(suggestion.id);
        updateSuggestion(dismissed);
      } catch (error) {
        showError(
          error instanceof ServiceError
            ? error.message
            : t("error.chat.suggestionDismissFailed"),
        );
      } finally {
        setDismissingSuggestionId(null);
      }
    },
    [
      dismissingSuggestionId,
      savingSuggestionId,
      showError,
      t,
      updateSuggestion,
    ],
  );

  const handleViewSuggestionNote = useCallback(
    (noteId: string) => {
      router.push(`/note/${noteId}` as Href);
    },
    [router],
  );

  const subtitle = useMemo(() => {
    if (isStreaming) return t("chat.streaming");
    if (conversationId) return t("chat.connected");
    if (selectedReferences.length > 0) {
      return t("chat.references_ready", { count: selectedReferences.length });
    }
    return t("chat.new_conversation");
  }, [conversationId, isStreaming, selectedReferences.length, t]);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  }, []);

  const renderMessage = useCallback(
    ({ item }: { item: ChatMessage }) => {
      const isUser = item.role === "user";
      const isError = item.status === "error";
      const isStopped = item.status === "stopped";
      const isEmptyStreaming =
        item.role === "assistant" && item.isStreaming && !item.content;
      const messageReferences = getMessageReferences(item.metadata);
      const messageSuggestions = getMessageSuggestions(item.metadata);
      const contentColor = isError
        ? theme.colors.onErrorContainer
        : isUser
          ? theme.colors.onPrimaryContainer
          : theme.colors.onSurfaceVariant;
      const shouldUseStableBubbleWidth = needsStableChatBubbleWidth({
        content: item.content,
        isUser,
        isStreaming: item.isStreaming,
        isError,
      });

      return (
        <View
          style={[
            styles.messageRow,
            isUser ? styles.userRow : styles.assistantRow,
          ]}
        >
          <View
            style={[
              styles.messageBubbleRow,
              isUser ? styles.userBubbleRow : styles.assistantBubbleRow,
            ]}
          >
            <Surface
              elevation={0}
              style={[
                styles.bubble,
                {
                  backgroundColor: isUser
                    ? theme.colors.primaryContainer
                    : theme.colors.surfaceVariant,
                },
                isError && {
                  backgroundColor: theme.colors.errorContainer,
                },
                shouldUseStableBubbleWidth && styles.richAssistantBubble,
              ]}
            >
              {isUser && messageReferences.length > 0 ? (
                <View style={styles.messageAttachmentBar}>
                  <ChatReferenceChipBar references={messageReferences} />
                </View>
              ) : null}
              {isEmptyStreaming ? (
                <View style={styles.loadingLine}>
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                  <Text
                    variant="bodyMedium"
                    style={{ color: theme.colors.onSurfaceVariant }}
                  >
                    {t("chat.thinking")}
                  </Text>
                </View>
              ) : (
                <ChatMessageContent
                  content={item.content}
                  color={contentColor}
                  isUser={isUser}
                  isStreaming={item.isStreaming}
                  isError={isError}
                />
              )}
              {isStopped ? (
                <Text
                  variant="labelSmall"
                  style={[
                    styles.statusText,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  {t("chat.stopped_status")}
                </Text>
              ) : null}
            </Surface>
          </View>
          {!isUser && messageSuggestions.length > 0 ? (
            <View style={styles.suggestionStack}>
              {messageSuggestions.map((suggestion) => (
                <ChatNoteSuggestionCard
                  key={suggestion.id}
                  suggestion={suggestion}
                  isSaving={savingSuggestionId === suggestion.id}
                  isDismissing={dismissingSuggestionId === suggestion.id}
                  onAccept={handleAcceptSuggestion}
                  onDismiss={handleDismissSuggestion}
                  onViewNote={handleViewSuggestionNote}
                />
              ))}
            </View>
          ) : null}
        </View>
      );
    },
    [
      dismissingSuggestionId,
      handleAcceptSuggestion,
      handleDismissSuggestion,
      handleViewSuggestionNote,
      savingSuggestionId,
      t,
      theme.colors.errorContainer,
      theme.colors.onErrorContainer,
      theme.colors.onPrimaryContainer,
      theme.colors.onSurfaceVariant,
      theme.colors.primary,
      theme.colors.primaryContainer,
      theme.colors.surfaceVariant,
    ],
  );

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
      edges={[]}
    >
      <Appbar.Header statusBarHeight={insets.top}>
        <Appbar.BackAction onPress={handleBack} />
        <Appbar.Content title={t("chat.title")} subtitle={subtitle} />
        <Appbar.Action
          icon="plus"
          accessibilityLabel={t("chat.new_chat")}
          disabled={isStreaming}
          onPress={handleResetChat}
        />
        <Appbar.Action
          icon="history"
          accessibilityLabel={t("chat.open_history")}
          onPress={handleOpenSessionDrawer}
        />
      </Appbar.Header>

      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={[
            styles.listContent,
            messages.length === 0 && styles.emptyListContent,
          ]}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text
                variant="titleMedium"
                style={{ color: theme.colors.onSurface }}
              >
                {t("chat.empty_title")}
              </Text>
              <Text
                variant="bodyMedium"
                style={[
                  styles.emptyText,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                {selectedReferences.length > 0
                  ? t("chat.empty_with_reference")
                  : t("chat.empty_subtitle")}
              </Text>
            </View>
          }
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={scrollToEnd}
          onLayout={scrollToEnd}
        />

        <View
          style={[
            styles.composer,
            {
              borderTopColor: theme.colors.outlineVariant,
              backgroundColor: theme.colors.surface,
              paddingBottom: composerBottomPadding,
            },
          ]}
        >
          {draftReferences.length > 0 ? (
            <View style={styles.composerReferenceRow}>
              <ChatReferenceChipBar
                references={draftReferences}
                disabled={isStreaming}
                onRemove={handleRemoveReference}
              />
            </View>
          ) : null}

          <View style={styles.composerInputRow}>
            <IconButton
              mode="contained-tonal"
              icon="note-plus-outline"
              size={20}
              accessibilityLabel={t("chat.add_reference")}
              disabled={isStreaming}
              onPress={handleOpenReferencePicker}
              style={styles.addReferenceButton}
            />
            <TextInput
              mode="outlined"
              dense
              value={draft}
              onChangeText={setDraft}
              placeholder={t("chat.input_placeholder")}
              placeholderTextColor={theme.colors.outline}
              multiline
              numberOfLines={1}
              maxLength={1000}
              style={styles.input}
              contentStyle={styles.inputContent}
              outlineStyle={styles.inputOutline}
              textAlignVertical="top"
              disabled={false}
              returnKeyType="send"
            />
            {isStreaming ? (
              <IconButton
                mode="contained-tonal"
                icon="stop"
                size={20}
                accessibilityLabel={t("chat.stop")}
                onPress={stopStreaming}
              />
            ) : (
              <IconButton
                mode="contained"
                icon="send"
                size={20}
                accessibilityLabel={t("chat.send")}
                disabled={!canSend}
                onPress={handleSend}
              />
            )}
          </View>
        </View>
      </KeyboardAvoidingView>

      <ChatReferencePickerSheet
        visible={isReferencePickerVisible}
        notes={notes}
        categories={categories}
        currentReferences={sessionReferences}
        selectedIds={selectedReferences.map((reference) => reference.id)}
        isLoading={isNotesLoading}
        isLimitReached={isReferenceLimitReached}
        onSelect={handleSelectReference}
        onDismiss={() => setIsReferencePickerVisible(false)}
      />
      <ChatSessionDrawer
        visible={isSessionDrawerVisible}
        conversations={conversations}
        currentConversationId={conversationId}
        isLoading={isConversationsLoading || isConversationsRefreshing}
        isDeleting={isBatchDeleting}
        onDismiss={() => setIsSessionDrawerVisible(false)}
        onNewChat={handleResetChat}
        onSelectConversation={handleSelectConversation}
        onDeleteConversations={handleDeleteConversations}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  keyboard: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: "center",
  },
  emptyState: {
    alignItems: "center",
    paddingHorizontal: 24,
  },
  emptyText: {
    marginTop: 8,
    textAlign: "center",
    lineHeight: 20,
  },
  messageRow: {
    marginBottom: 12,
  },
  userRow: {
    alignItems: "stretch",
  },
  assistantRow: {
    alignItems: "stretch",
  },
  messageBubbleRow: {
    flexDirection: "row",
  },
  userBubbleRow: {
    justifyContent: "flex-end",
  },
  assistantBubbleRow: {
    justifyContent: "flex-start",
  },
  bubble: {
    maxWidth: "86%",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  richAssistantBubble: {
    width: "96%",
    maxWidth: "96%",
  },
  loadingLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusText: {
    marginTop: 6,
  },
  messageAttachmentBar: {
    marginBottom: 8,
    maxWidth: "100%",
  },
  suggestionStack: {
    width: "86%",
    marginTop: 6,
    gap: 8,
  },
  composer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  composerReferenceRow: {
    marginBottom: 8,
  },
  composerInputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  addReferenceButton: {
    margin: 0,
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 112,
    fontSize: 15,
  },
  inputContent: {
    minHeight: 42,
    paddingTop: 7,
    paddingBottom: 7,
    fontSize: 15,
    lineHeight: 20,
  },
  inputOutline: {
    borderRadius: 8,
  },
});
