import { useCallback, useEffect, useRef, useState } from "react";
import i18next from "../i18n";
import { chatService, isChatAbortError } from "../services/chatService";
import {
  ChatConversationDetailResponse,
  ChatMessage,
  ChatNoteSuggestion,
  ChatReferenceNote,
  ChatMessageResponse,
  ChatStreamEvent,
  ServiceError,
} from "../types";
import { useToast } from "./useToast";

interface UseChatOptions {
  initialConversationId?: string | null;
}

interface SendMessageOptions {
  referencedNotes?: ChatReferenceNote[];
  displayReferencedNotes?: ChatReferenceNote[];
}

const createLocalId = (prefix: string) => {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
};

const createFallbackError = () => {
  return new ServiceError({
    message: i18next.t("error.chat.streamFailed"),
    i18nKey: "error.chat.streamFailed",
    toastType: "error",
    retryable: true,
  });
};

const normalizeStoredMessage = (message: ChatMessageResponse): ChatMessage => {
  return {
    id: message.id,
    serverId: message.id,
    conversationId: message.conversation_id,
    role: message.role,
    content: message.content,
    sequence: message.sequence,
    metadata: message.metadata,
    suggestions: normalizeSuggestions(message.suggestions),
    createdAt: message.created_at,
    status: "done",
    isLocal: false,
  };
};

const normalizeSuggestions = (
  suggestions: ChatNoteSuggestion[] | undefined,
): ChatNoteSuggestion[] => {
  if (!Array.isArray(suggestions)) return [];
  return suggestions.filter(
    (suggestion): suggestion is ChatNoteSuggestion =>
      !!suggestion &&
      typeof suggestion === "object" &&
      "id" in suggestion &&
      typeof suggestion.id === "string",
  );
};

const getMetadataSuggestions = (
  metadata: Record<string, unknown> | undefined,
): ChatNoteSuggestion[] => {
  const rawSuggestions = metadata?.suggestions;
  if (!Array.isArray(rawSuggestions)) return [];

  return rawSuggestions.filter(
    (suggestion): suggestion is ChatNoteSuggestion =>
      !!suggestion &&
      typeof suggestion === "object" &&
      "id" in suggestion &&
      typeof suggestion.id === "string",
  );
};

const getMessageSuggestions = (message: ChatMessage): ChatNoteSuggestion[] => {
  const suggestions = normalizeSuggestions(message.suggestions);
  if (suggestions.length > 0) return suggestions;
  return getMetadataSuggestions(message.metadata);
};

const upsertSuggestion = (
  suggestions: ChatNoteSuggestion[],
  nextSuggestion: ChatNoteSuggestion,
) => {
  const exists = suggestions.some(
    (suggestion) => suggestion.id === nextSuggestion.id,
  );
  if (!exists) return [...suggestions, nextSuggestion];
  return suggestions.map((suggestion) =>
    suggestion.id === nextSuggestion.id ? nextSuggestion : suggestion,
  );
};

export const useChat = (options: UseChatOptions = {}) => {
  const { showWarning } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(
    options.initialConversationId ?? null,
  );
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<ServiceError | null>(null);
  const [latestSuggestion, setLatestSuggestion] =
    useState<ChatNoteSuggestion | null>(null);

  const conversationIdRef = useRef<string | null>(
    options.initialConversationId ?? null,
  );
  const abortControllerRef = useRef<AbortController | null>(null);
  const activeAssistantIdRef = useRef<string | null>(null);
  const isUnmountingRef = useRef(false);
  const isStreamingRef = useRef(false);
  const userStoppedRef = useRef(false);
  const isSessionResettingRef = useRef(false);

  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  useEffect(() => {
    isStreamingRef.current = isStreaming;
  }, [isStreaming]);

  useEffect(() => {
    return () => {
      isUnmountingRef.current = true;
      isSessionResettingRef.current = true;
      abortControllerRef.current?.abort();
    };
  }, []);

  const finalizeAssistantMessage = useCallback(
    (assistantId: string, patch: Partial<ChatMessage> = {}) => {
      setMessages((prev) =>
        prev.map((message) => {
          if (message.id !== assistantId) return message;

          const nextMessage = {
            ...message,
            ...patch,
            isStreaming: false,
          };
          const hasContent = nextMessage.content.trim().length > 0;
          const hasSuggestions = getMessageSuggestions(nextMessage).length > 0;

          if (!hasContent && !hasSuggestions) {
            return {
              ...nextMessage,
              status: "error",
              content: i18next.t("chat.empty_assistant_response"),
            };
          }

          return {
            ...nextMessage,
            status: "done",
          };
        }),
      );
    },
    [],
  );

  const appendAssistantDelta = useCallback(
    (assistantId: string, delta: string) => {
      if (!delta) return;
      setMessages((prev) =>
        prev.map((message) =>
          message.id === assistantId
            ? { ...message, content: `${message.content}${delta}` }
            : message,
        ),
      );
    },
    [],
  );

  const upsertAssistantSuggestion = useCallback(
    (assistantId: string, suggestion: ChatNoteSuggestion) => {
      setMessages((prev) =>
        prev.map((message) => {
          if (message.id !== assistantId) return message;

          const suggestions = getMessageSuggestions(message);
          return {
            ...message,
            suggestions: upsertSuggestion(suggestions, suggestion),
            metadata: {
              ...(message.metadata ?? {}),
              suggestions: upsertSuggestion(suggestions, suggestion),
            },
          };
        }),
      );
    },
    [],
  );

  const updateSuggestion = useCallback((suggestion: ChatNoteSuggestion) => {
    setMessages((prev) =>
      prev.map((message) => {
        const suggestions = getMessageSuggestions(message);
        if (
          suggestions.length === 0 ||
          !suggestions.some((item) => item.id === suggestion.id)
        ) {
          return message;
        }

        return {
          ...message,
          suggestions: upsertSuggestion(suggestions, suggestion),
          metadata: {
            ...(message.metadata ?? {}),
            suggestions: upsertSuggestion(suggestions, suggestion),
          },
        };
      }),
    );
  }, []);

  const markAssistantFailed = useCallback(
    (assistantId: string, fallbackMessage: string) => {
      setMessages((prev) =>
        prev.map((message) =>
          message.id === assistantId
            ? message.status === "stopped"
              ? message
              : {
                  ...message,
                  isStreaming: false,
                  status: "error",
                  content:
                    message.content.trim().length > 0
                      ? message.content
                      : fallbackMessage,
                }
            : message,
        ),
      );
    },
    [],
  );

  const markAssistantStopped = useCallback((assistantId: string) => {
    setMessages((prev) =>
      prev.map((message) =>
        message.id === assistantId
          ? {
              ...message,
              isStreaming: false,
              status: "stopped",
            }
          : message,
      ),
    );
  }, []);

  const handleStreamEvent = useCallback(
    (event: ChatStreamEvent, assistantId: string) => {
      switch (event.type) {
        case "conversation_id": {
          const nextConversationId = event.data.conversation_id;
          if (nextConversationId) {
            conversationIdRef.current = nextConversationId;
            setConversationId(nextConversationId);
            setMessages((prev) =>
              prev.map((message) => ({
                ...message,
                conversationId: message.conversationId ?? nextConversationId,
              })),
            );
          }
          break;
        }
        case "delta":
          appendAssistantDelta(assistantId, event.data.delta ?? "");
          break;
        case "note_suggestion":
          setLatestSuggestion(event.data);
          upsertAssistantSuggestion(assistantId, event.data);
          break;
        case "done": {
          const nextConversationId = event.data.conversation_id;
          if (nextConversationId) {
            conversationIdRef.current = nextConversationId;
            setConversationId(nextConversationId);
          }
          finalizeAssistantMessage(assistantId, {
            serverId: event.data.message_id,
            conversationId:
              nextConversationId ?? conversationIdRef.current ?? undefined,
          });
          break;
        }
        case "error":
        case "retrieval":
        case "unknown":
        default:
          break;
      }
    },
    [appendAssistantDelta, finalizeAssistantMessage, upsertAssistantSuggestion],
  );

  const stopStreaming = useCallback(() => {
    if (!abortControllerRef.current || !isStreamingRef.current) return;

    userStoppedRef.current = true;
    isSessionResettingRef.current = false;
    abortControllerRef.current.abort();
    abortControllerRef.current = null;
    setIsStreaming(false);

    const assistantId = activeAssistantIdRef.current;
    if (assistantId) {
      markAssistantStopped(assistantId);
    }
  }, [markAssistantStopped]);

  const sendMessage = useCallback(
    async (rawMessage: string, sendOptions: SendMessageOptions = {}) => {
      const text = rawMessage.trim();

      if (!text) {
        showWarning(i18next.t("chat.empty_input"));
        return false;
      }

      if (isStreamingRef.current) {
        showWarning(i18next.t("chat.wait_for_response"));
        return false;
      }

      const referencedNotes = (sendOptions.referencedNotes ?? []).slice(0, 20);
      const displayReferencedNotes = (
        sendOptions.displayReferencedNotes ?? referencedNotes
      ).slice(0, 20);
      const referencedNoteIds = referencedNotes.map((note) => note.id);

      const now = new Date().toISOString();
      const userMessage: ChatMessage = {
        id: createLocalId("user"),
        conversationId: conversationIdRef.current ?? undefined,
        role: "user",
        content: text,
        metadata: {
          referenced_note_ids: referencedNoteIds,
          ...(displayReferencedNotes.length > 0
            ? {
                referenceNotes: displayReferencedNotes.map((note) => ({
                  id: note.id,
                  title: note.title,
                  imageUrl: note.imageUrl,
                  category: note.category,
                })),
                attachmentLabel: i18next.t("chat.reference_attachment"),
              }
            : {}),
        },
        createdAt: now,
        status: "done",
        isLocal: true,
      };
      const assistantMessage: ChatMessage = {
        id: createLocalId("assistant"),
        conversationId: conversationIdRef.current ?? undefined,
        role: "assistant",
        content: "",
        createdAt: now,
        status: "streaming",
        isStreaming: true,
        isLocal: true,
      };

      setError(null);
      setMessages((prev) => [...prev, userMessage, assistantMessage]);

      const controller = new AbortController();
      abortControllerRef.current = controller;
      activeAssistantIdRef.current = assistantMessage.id;
      userStoppedRef.current = false;
      isSessionResettingRef.current = false;
      setIsStreaming(true);

      try {
        await chatService.streamChat(
          {
            conversation_id: conversationIdRef.current,
            message: text,
            referenced_note_ids: referencedNoteIds,
          },
          {
            signal: controller.signal,
            onEvent: (event) => {
              handleStreamEvent(event, assistantMessage.id);
            },
          },
        );

        finalizeAssistantMessage(assistantMessage.id);

        return true;
      } catch (streamError) {
        const isIntentionalInterrupt =
          userStoppedRef.current ||
          isUnmountingRef.current ||
          isSessionResettingRef.current;

        if (isIntentionalInterrupt) {
          if (isUnmountingRef.current || isSessionResettingRef.current) {
            return true;
          }

          markAssistantStopped(assistantMessage.id);
          return true;
        }

        if (isChatAbortError(streamError)) {
          markAssistantStopped(assistantMessage.id);
          return true;
        }

        if (isUnmountingRef.current || isSessionResettingRef.current) {
          return true;
        }

        const serviceError =
          streamError instanceof ServiceError
            ? streamError
            : createFallbackError();

        setError(serviceError);
        markAssistantFailed(assistantMessage.id, serviceError.message);

        return false;
      } finally {
        if (!isUnmountingRef.current) {
          setIsStreaming(false);
        }
        abortControllerRef.current = null;
        activeAssistantIdRef.current = null;
      }
    },
    [
      handleStreamEvent,
      finalizeAssistantMessage,
      markAssistantFailed,
      markAssistantStopped,
      showWarning,
    ],
  );

  const resetChat = useCallback(() => {
    isSessionResettingRef.current = true;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    activeAssistantIdRef.current = null;
    conversationIdRef.current = null;
    userStoppedRef.current = false;
    setConversationId(null);
    setMessages([]);
    setError(null);
    setLatestSuggestion(null);
    setIsStreaming(false);
  }, []);

  const restoreConversation = useCallback(
    (detail: ChatConversationDetailResponse) => {
      isSessionResettingRef.current = true;
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      activeAssistantIdRef.current = null;
      userStoppedRef.current = false;

      const nextConversationId = detail.conversation.id;
      conversationIdRef.current = nextConversationId;
      setConversationId(nextConversationId);
      setMessages(
        detail.messages
          .slice()
          .sort((a, b) => a.sequence - b.sequence)
          .map(normalizeStoredMessage),
      );
      setError(null);
      setLatestSuggestion(null);
      setIsStreaming(false);
      isSessionResettingRef.current = false;
    },
    [],
  );

  return {
    messages,
    conversationId,
    isStreaming,
    error,
    latestSuggestion,
    updateSuggestion,
    sendMessage,
    stopStreaming,
    resetChat,
    restoreConversation,
  };
};
