import { fetch as expoFetch } from "expo/fetch";
import { APP_CONFIG, ENDPOINTS } from "../constants/config";
import i18next from "../i18n";
import { useNetworkStore } from "../store/useNetworkStore";
import {
  ChatDeltaPayload,
  ChatConversationBatchDeleteResponse,
  ChatConversationDetailResponse,
  ChatConversationListResponse,
  ChatDonePayload,
  ChatErrorPayload,
  ChatNoteSuggestion,
  ChatStreamEvent,
  ChatStreamRequest,
  ChatSuggestionAcceptResponse,
  ServiceError,
  ToastType,
} from "../types";
import api from "./api";
import { authEventEmitter } from "./api";
import { authService } from "./authService";
import { parseServiceError } from "./errorService";
import { tokenService } from "./tokenService";

interface StreamChatOptions {
  signal?: AbortSignal;
  onEvent?: (event: ChatStreamEvent) => void;
}

interface ParsedSseFrame {
  event: string;
  data: unknown;
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return !!value && typeof value === "object" && !Array.isArray(value);
};

const toOptionalString = (value: unknown): string | undefined => {
  return typeof value === "string" && value.length > 0 ? value : undefined;
};

const toNullableString = (value: unknown): string | null | undefined => {
  if (value === null) return null;
  return toOptionalString(value);
};

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
};

const createServiceError = (
  i18nKey: string,
  toastType: ToastType = "error",
  options?: { statusCode?: number; retryable?: boolean; message?: string },
) => {
  return new ServiceError({
    message: options?.message ?? i18next.t(i18nKey),
    i18nKey,
    toastType,
    statusCode: options?.statusCode,
    retryable: options?.retryable,
  });
};

export const isChatAbortError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return error.name === "AbortError" || message.includes("abort");
};

const readResponseBody = async (response: Response): Promise<unknown> => {
  try {
    const text = await response.text();
    if (!text) return undefined;
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
  } catch {
    return undefined;
  }
};

const getBackendMessage = (data: unknown): string | undefined => {
  if (typeof data === "string") return data;
  if (!isRecord(data)) return undefined;

  const detail = data.detail;
  if (typeof detail === "string") return detail;

  const message = data.message;
  if (typeof message === "string") return message;

  const error = data.error;
  if (typeof error === "string") return error;

  return undefined;
};

const mapHttpError = async (response: Response): Promise<ServiceError> => {
  const responseData = await readResponseBody(response);
  const statusCode = response.status;

  if (statusCode === 401) {
    await tokenService.clearAll();
    authEventEmitter.emit("AUTH_EXPIRED");
    return createServiceError("error.auth.unauthorized", "info", {
      statusCode,
    });
  }

  if (statusCode === 403) {
    return createServiceError("error.auth.forbidden", "error", {
      statusCode,
    });
  }

  if (statusCode === 404) {
    return createServiceError("error.common.notFound", "error", {
      statusCode,
    });
  }

  if (statusCode === 422) {
    return createServiceError("error.validation.invalid", "warning", {
      statusCode,
    });
  }

  if (statusCode === 429) {
    return createServiceError("error.common.rateLimited", "warning", {
      statusCode,
      retryable: true,
    });
  }

  if (statusCode >= 500) {
    return createServiceError("error.server.unavailable", "error", {
      statusCode,
      retryable: true,
    });
  }

  return createServiceError("error.chat.streamFailed", "error", {
    statusCode,
    retryable: true,
    message: getBackendMessage(responseData),
  });
};

const getAuthorizedToken = async (): Promise<string> => {
  if (await tokenService.isTokenExpiringSoon()) {
    const refreshed = await authService.refreshToken();
    return refreshed.access_token;
  }

  const token = await tokenService.getToken();
  if (!token) {
    throw createServiceError("error.auth.unauthorized", "info");
  }

  return token;
};

const normalizeRequest = (request: ChatStreamRequest): ChatStreamRequest => {
  const body: ChatStreamRequest = {
    conversation_id: request.conversation_id ?? null,
    message: request.message.trim(),
  };

  if (request.referenced_note_ids && request.referenced_note_ids.length > 0) {
    body.referenced_note_ids = request.referenced_note_ids.slice(0, 20);
  }

  if (request.rag_top_k != null) {
    body.rag_top_k = request.rag_top_k;
  }

  return body;
};

const parseJsonData = (data: string): unknown => {
  if (!data) return {};
  try {
    return JSON.parse(data) as unknown;
  } catch {
    return data;
  }
};

export const parseSseFrame = (frame: string): ParsedSseFrame | null => {
  const dataLines: string[] = [];
  let eventName = "message";

  frame.split("\n").forEach((line) => {
    if (!line || line.startsWith(":")) return;

    const separatorIndex = line.indexOf(":");
    const field =
      separatorIndex === -1 ? line : line.slice(0, separatorIndex);
    let value = separatorIndex === -1 ? "" : line.slice(separatorIndex + 1);

    if (value.startsWith(" ")) {
      value = value.slice(1);
    }

    if (field === "event") {
      eventName = value;
    }

    if (field === "data") {
      dataLines.push(value);
    }
  });

  if (dataLines.length === 0) {
    return null;
  }

  return {
    event: eventName,
    data: parseJsonData(dataLines.join("\n")),
  };
};

const normalizeSseBuffer = (value: string) => {
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
};

const splitSseFrames = (buffer: string) => {
  const normalized = normalizeSseBuffer(buffer);
  const parts = normalized.split("\n\n");
  const remainder = parts.pop() ?? "";
  return { frames: parts, remainder };
};

const normalizeSuggestion = (data: unknown): ChatNoteSuggestion => {
  const raw = isRecord(data) ? data : {};
  const status = raw.status === "accepted" || raw.status === "dismissed"
    ? raw.status
    : "pending";

  return {
    id: toOptionalString(raw.id) ?? "",
    conversation_id: toOptionalString(raw.conversation_id) ?? "",
    message_id: toNullableString(raw.message_id),
    title: toOptionalString(raw.title) ?? "",
    content: toOptionalString(raw.content) ?? "",
    category: toNullableString(raw.category),
    tags: toStringArray(raw.tags),
    status,
    note_id: toNullableString(raw.note_id),
    metadata: isRecord(raw.metadata) ? raw.metadata : {},
    created_at: toOptionalString(raw.created_at) ?? new Date().toISOString(),
    updated_at: toOptionalString(raw.updated_at) ?? new Date().toISOString(),
  };
};

const toChatStreamEvent = (frame: ParsedSseFrame): ChatStreamEvent => {
  const data = isRecord(frame.data) ? frame.data : {};

  switch (frame.event) {
    case "conversation_id":
      return {
        type: "conversation_id",
        data: {
          conversation_id: toOptionalString(data.conversation_id),
        },
      };
    case "retrieval":
      return {
        type: "retrieval",
        data,
      };
    case "delta": {
      const payload: ChatDeltaPayload = {
        delta:
          toOptionalString(data.delta) ??
          (typeof frame.data === "string" ? frame.data : ""),
      };
      return { type: "delta", data: payload };
    }
    case "note_suggestion":
      return {
        type: "note_suggestion",
        data: normalizeSuggestion(frame.data),
      };
    case "done": {
      const payload: ChatDonePayload = {
        conversation_id: toOptionalString(data.conversation_id),
        message_id: toOptionalString(data.message_id),
        suggestion_id: toNullableString(data.suggestion_id),
      };
      return { type: "done", data: payload };
    }
    case "error": {
      const payload: ChatErrorPayload = {
        ...(isRecord(frame.data) ? frame.data : {}),
        message: getBackendMessage(frame.data),
      };
      return { type: "error", data: payload };
    }
    default:
      return {
        type: "unknown",
        event: frame.event,
        data: frame.data,
      };
  }
};

const createStreamEventError = (payload: ChatErrorPayload): ServiceError => {
  return createServiceError("error.chat.streamFailed", "error", {
    retryable: true,
    message: payload.message ?? payload.detail ?? payload.error,
  });
};

export const chatService = {
  listConversations: async (
    params: { skip?: number; limit?: number } = {},
  ): Promise<ChatConversationListResponse> => {
    try {
      const response = await api.get<ChatConversationListResponse>(
        ENDPOINTS.CHAT.CONVERSATIONS,
        {
          params: {
            skip: params.skip ?? 0,
            limit: params.limit ?? 50,
          },
        },
      );
      return response as unknown as ChatConversationListResponse;
    } catch (error) {
      throw parseServiceError(error, {
        fallbackKey: "error.chat.conversationListFailed",
        statusMap: {
          422: { key: "error.validation.invalid", toastType: "warning" },
        },
      });
    }
  },

  getConversationDetail: async (
    conversationId: string,
  ): Promise<ChatConversationDetailResponse> => {
    try {
      const response = await api.get<ChatConversationDetailResponse>(
        ENDPOINTS.CHAT.CONVERSATION_DETAIL(conversationId),
      );
      return response as unknown as ChatConversationDetailResponse;
    } catch (error) {
      throw parseServiceError(error, {
        fallbackKey: "error.chat.conversationLoadFailed",
        statusMap: {
          404: { key: "error.common.notFound", toastType: "error" },
          422: { key: "error.validation.invalid", toastType: "warning" },
        },
      });
    }
  },

  deleteConversation: async (conversationId: string): Promise<void> => {
    try {
      await api.delete(ENDPOINTS.CHAT.CONVERSATION_DETAIL(conversationId));
    } catch (error) {
      throw parseServiceError(error, {
        fallbackKey: "error.chat.conversationDeleteFailed",
        statusMap: {
          404: { key: "error.common.notFound", toastType: "error" },
          422: { key: "error.validation.invalid", toastType: "warning" },
        },
      });
    }
  },

  batchDeleteConversations: async (
    conversationIds: string[],
  ): Promise<ChatConversationBatchDeleteResponse> => {
    try {
      const response = await api.post<ChatConversationBatchDeleteResponse>(
        ENDPOINTS.CHAT.BATCH_DELETE_CONVERSATIONS,
        { conversation_ids: conversationIds },
      );
      return response as unknown as ChatConversationBatchDeleteResponse;
    } catch (error) {
      throw parseServiceError(error, {
        fallbackKey: "error.chat.conversationDeleteFailed",
        statusMap: {
          422: { key: "error.validation.invalid", toastType: "warning" },
        },
      });
    }
  },

  acceptSuggestion: async (
    suggestionId: string,
  ): Promise<ChatSuggestionAcceptResponse> => {
    try {
      const response = await api.post<ChatSuggestionAcceptResponse>(
        ENDPOINTS.CHAT.ACCEPT_SUGGESTION(suggestionId),
      );
      return response as unknown as ChatSuggestionAcceptResponse;
    } catch (error) {
      throw parseServiceError(error, {
        fallbackKey: "error.chat.suggestionAcceptFailed",
        statusMap: {
          404: { key: "error.common.notFound", toastType: "error" },
          409: { key: "error.common.conflict", toastType: "warning" },
          422: { key: "error.validation.invalid", toastType: "warning" },
        },
      });
    }
  },

  dismissSuggestion: async (
    suggestionId: string,
  ): Promise<ChatNoteSuggestion> => {
    try {
      const response = await api.post<ChatNoteSuggestion>(
        ENDPOINTS.CHAT.DISMISS_SUGGESTION(suggestionId),
      );
      return normalizeSuggestion(response) as ChatNoteSuggestion;
    } catch (error) {
      throw parseServiceError(error, {
        fallbackKey: "error.chat.suggestionDismissFailed",
        statusMap: {
          404: { key: "error.common.notFound", toastType: "error" },
          422: { key: "error.validation.invalid", toastType: "warning" },
        },
      });
    }
  },

  streamChat: async (
    request: ChatStreamRequest,
    options: StreamChatOptions = {},
  ): Promise<void> => {
    if (!request.message.trim()) {
      throw createServiceError("error.validation.required", "warning");
    }

    if (!useNetworkStore.getState().isOnline) {
      throw createServiceError("error.network.unavailable", "error", {
        retryable: true,
      });
    }

    let response: Response;

    try {
      const token = await getAuthorizedToken();
      response = await expoFetch(
        `${APP_CONFIG.API_BASE_URL}${ENDPOINTS.CHAT.STREAM}`,
        {
          method: "POST",
          headers: {
            Accept: "text/event-stream",
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(normalizeRequest(request)),
          signal: options.signal,
        },
      );
    } catch (error) {
      if (isChatAbortError(error) || error instanceof ServiceError) {
        throw error;
      }

      throw createServiceError("error.network.unavailable", "error", {
        retryable: true,
      });
    }

    if (!response.ok) {
      throw await mapHttpError(response);
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (contentType && !contentType.includes("text/event-stream")) {
      throw createServiceError("error.chat.invalidStreamResponse", "error", {
        retryable: true,
      });
    }

    if (!response.body) {
      throw createServiceError("error.chat.streamUnavailable", "error", {
        retryable: true,
      });
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const { frames, remainder } = splitSseFrames(buffer);
        buffer = remainder;

        for (const frameText of frames) {
          const frame = parseSseFrame(frameText);
          if (!frame) continue;

          const event = toChatStreamEvent(frame);
          options.onEvent?.(event);

          if (event.type === "error") {
            throw createStreamEventError(event.data);
          }

          if (event.type === "done") {
            return;
          }
        }
      }

      const tail = decoder.decode();
      if (tail) {
        buffer += tail;
      }

      const frame = parseSseFrame(buffer.trim());
      if (frame) {
        const event = toChatStreamEvent(frame);
        options.onEvent?.(event);
        if (event.type === "error") {
          throw createStreamEventError(event.data);
        }
        if (event.type === "done") {
          return;
        }
      }

      throw createServiceError("error.chat.streamIncomplete", "error", {
        retryable: true,
      });
    } catch (error) {
      if (isChatAbortError(error) || error instanceof ServiceError) {
        throw error;
      }

      throw createServiceError("error.chat.streamFailed", "error", {
        retryable: true,
      });
    } finally {
      try {
        reader.releaseLock();
      } catch {
        // Reader may already be released after cancel; no UI action needed.
      }
    }
  },
};
