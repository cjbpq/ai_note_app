import { useCallback, useEffect, useRef, useState } from "react";
import i18next from "../i18n";
import { chatService, isChatAbortError } from "../services/chatService";
import {
  ChatMessage,
  ChatNoteSuggestion,
  ChatReferenceNote,
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

  const updateAssistantMessage = useCallback(
    (assistantId: string, patch: Partial<ChatMessage>) => {
      setMessages((prev) =>
        prev.map((message) =>
          message.id === assistantId ? { ...message, ...patch } : message,
        ),
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
          break;
        case "done": {
          const nextConversationId = event.data.conversation_id;
          if (nextConversationId) {
            conversationIdRef.current = nextConversationId;
            setConversationId(nextConversationId);
          }
          updateAssistantMessage(assistantId, {
            serverId: event.data.message_id,
            conversationId:
              nextConversationId ?? conversationIdRef.current ?? undefined,
            isStreaming: false,
            status: "done",
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
    [appendAssistantDelta, updateAssistantMessage],
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
        metadata: displayReferencedNotes.length > 0
          ? {
              referenceNotes: displayReferencedNotes.map((note) => ({
                id: note.id,
                title: note.title,
                imageUrl: note.imageUrl,
                category: note.category,
              })),
              attachmentLabel: i18next.t("chat.reference_attachment"),
            }
          : undefined,
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

        updateAssistantMessage(assistantMessage.id, {
          isStreaming: false,
          status: "done",
        });

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
      markAssistantFailed,
      markAssistantStopped,
      showWarning,
      updateAssistantMessage,
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

  return {
    messages,
    conversationId,
    isStreaming,
    error,
    latestSuggestion,
    sendMessage,
    stopStreaming,
    resetChat,
  };
};
