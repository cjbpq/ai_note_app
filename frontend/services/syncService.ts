import AsyncStorage from "@react-native-async-storage/async-storage";
import { APP_CONFIG, ENDPOINTS, STORAGE_KEYS } from "../constants/config";
import {
  Note,
  NoteBatchRequest,
  NoteBatchResponse,
  NoteMutationBatchRequest,
  NoteMutationBatchResponse,
  NoteMutationItem,
  NoteSyncResponse,
  RawNoteFromAPI,
  RawSmartNoteData,
  SmartNoteData,
  SmartNoteMeta,
  SyncNoteSummary,
} from "../types";
import {
  toOptionalSafeSections,
  toOptionalSafeStringArray,
} from "../utils/safeData";
import api from "./api";
import { parseServiceError } from "./errorService";

/**
 * Sync Service（Phase C）
 *
 * 职责：
 * 1) 增量同步列表摘要（/library/notes/sync）
 * 2) 分批拉取详情并静默缓存（/library/notes/batch）
 * 3) 批量回放离线变更（/library/notes/mutations）
 * 4) 管理 lastSyncTime 游标（AsyncStorage）
 */

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getLastSyncTimeKey = (userId?: string) =>
  userId
    ? `${STORAGE_KEYS.LAST_SYNC_TIME}_${userId}`
    : STORAGE_KEYS.LAST_SYNC_TIME;

const normalizeStructuredData = (
  raw: RawSmartNoteData | Record<string, unknown> | undefined,
): SmartNoteData | undefined => {
  if (!raw || typeof raw !== "object") return undefined;

  const data = raw as RawSmartNoteData;

  if (!data.title && !data.summary && !data.sections && !data.key_points) {
    return undefined;
  }

  const keyPoints = toOptionalSafeStringArray(data.key_points);
  const sections = toOptionalSafeSections(data.sections);

  let meta: SmartNoteMeta | undefined;
  if (data.meta && typeof data.meta === "object") {
    meta = {
      subject: data.meta.subject,
      promptProfile: data.meta.prompt_profile,
      warnings: toOptionalSafeStringArray(data.meta.warnings),
      tags: toOptionalSafeStringArray(data.meta.tags),
      originalNoteType: data.meta.original_note_type,
      provider: data.meta.provider,
    };
  }

  return {
    title: data.title,
    summary: data.summary,
    rawText: data.raw_text,
    sections,
    keyPoints,
    studyAdvice: data.study_advice,
    meta,
  };
};

const parseTags = (rawTags: SyncNoteSummary["tags"]): string[] => {
  if (Array.isArray(rawTags)) return rawTags;
  if (typeof rawTags === "string") {
    try {
      const parsed = JSON.parse(rawTags);
      return Array.isArray(parsed) ? parsed : [rawTags];
    } catch {
      return rawTags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
    }
  }
  return [];
};

const buildImageUrls = (raw: {
  image_urls?: string[];
  image_url?: string;
}): string[] => {
  if (Array.isArray(raw.image_urls) && raw.image_urls.length > 0) {
    return raw.image_urls.map((url) =>
      url.startsWith("/") ? `${APP_CONFIG.STATIC_BASE_URL}${url}` : url,
    );
  }

  if (raw.image_url) {
    return [
      raw.image_url.startsWith("/")
        ? `${APP_CONFIG.STATIC_BASE_URL}${raw.image_url}`
        : raw.image_url,
    ];
  }

  return [];
};

const normalizeSummaryNote = (raw: SyncNoteSummary): Note => {
  const date = raw.created_at || new Date().toISOString();
  return {
    id: raw.id,
    title: raw.title || "Untitled",
    content: "",
    date,
    updatedAt: raw.updated_at || date,
    tags: parseTags(raw.tags),
    imageUrls: buildImageUrls(raw),
    imageFilenames: raw.image_filenames ?? [],
    imageSizes: raw.image_sizes ?? [],
    category: raw.category ?? "",
    isFavorite: raw.is_favorite ?? false,
    isArchived: raw.is_archived ?? false,
    userId: raw.user_id ?? undefined,
    deviceId: raw.device_id,
    structuredData: undefined,
  };
};

const normalizeDetailNote = (raw: RawNoteFromAPI): Note => {
  const date =
    raw.created_at || raw.date || raw.createdAt || new Date().toISOString();

  const tags = parseTags(raw.tags as SyncNoteSummary["tags"]);

  const structuredData = normalizeStructuredData(
    (raw.structured_data || raw.structuredData) as
      | RawSmartNoteData
      | Record<string, unknown>
      | undefined,
  );

  return {
    id: raw.id,
    title: raw.title || "Untitled",
    content: raw.original_text || raw.content || "",
    date,
    updatedAt: raw.updated_at || date,
    tags,
    imageUrls: buildImageUrls(raw),
    imageFilenames: Array.isArray(raw.image_filenames)
      ? raw.image_filenames
      : raw.image_filename
        ? [raw.image_filename]
        : [],
    imageSizes: Array.isArray(raw.image_sizes)
      ? raw.image_sizes
      : raw.image_size != null
        ? [raw.image_size]
        : [],
    category: raw.category || raw.categoryId || raw.category_id || "",
    isFavorite: raw.is_favorite ?? false,
    isArchived: raw.is_archived ?? false,
    userId: raw.user_id,
    deviceId: raw.device_id,
    structuredData,
  };
};

export const syncService = {
  getLastSyncTime: async (userId?: string): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem(getLastSyncTimeKey(userId));
    } catch {
      return null;
    }
  },

  setLastSyncTime: async (
    serverTime: string,
    userId?: string,
  ): Promise<void> => {
    await AsyncStorage.setItem(getLastSyncTimeKey(userId), serverTime);
  },

  clearLastSyncTime: async (userId?: string): Promise<void> => {
    await AsyncStorage.removeItem(getLastSyncTimeKey(userId));
  },

  incrementalSync: async (since?: string | null) => {
    try {
      const response = (await api.get<NoteSyncResponse>(
        ENDPOINTS.LIBRARY.SYNC_NOTES,
        {
          params: since ? { since } : undefined,
        },
      )) as unknown as NoteSyncResponse;

      const updated = (response.updated ?? []).map(normalizeSummaryNote);
      const deletedIds = response.deleted_ids ?? [];

      return {
        updated,
        deletedIds,
        serverTime: response.server_time,
      };
    } catch (error) {
      throw parseServiceError(error, {
        fallbackKey: "error.sync.pullFailed",
        statusMap: {
          401: { key: "error.auth.unauthorized", toastType: "info" },
          429: { key: "error.common.rateLimited", toastType: "warning" },
        },
      });
    }
  },

  batchFetchNoteDetails: async (
    noteIds: string[],
    onProgress?: (done: number, total: number) => void,
  ): Promise<Note[]> => {
    if (!Array.isArray(noteIds) || noteIds.length === 0) {
      return [];
    }

    const chunkSize = APP_CONFIG.SYNC.BATCH_SIZE;
    const chunks: string[][] = [];

    for (let i = 0; i < noteIds.length; i += chunkSize) {
      chunks.push(noteIds.slice(i, i + chunkSize));
    }

    const mergedNotes: Note[] = [];
    let done = 0;

    for (const chunk of chunks) {
      const payload: NoteBatchRequest = { note_ids: chunk };
      try {
        const response = (await api.post<NoteBatchResponse>(
          ENDPOINTS.LIBRARY.BATCH_NOTES,
          payload,
        )) as unknown as NoteBatchResponse;

        const normalized = (response.notes ?? []).map(normalizeDetailNote);
        mergedNotes.push(...normalized);

        done += chunk.length;
        onProgress?.(Math.min(done, noteIds.length), noteIds.length);

        if (APP_CONFIG.SYNC.BATCH_DELAY_MS > 0) {
          await sleep(APP_CONFIG.SYNC.BATCH_DELAY_MS);
        }
      } catch (error) {
        throw parseServiceError(error, {
          fallbackKey: "error.sync.batchCacheFailed",
          statusMap: {
            401: { key: "error.auth.unauthorized", toastType: "info" },
            422: { key: "error.validation.invalid", toastType: "warning" },
            429: { key: "error.common.rateLimited", toastType: "warning" },
          },
        });
      }
    }

    return mergedNotes;
  },

  replayMutationsBatch: async (mutations: NoteMutationItem[]) => {
    if (!Array.isArray(mutations) || mutations.length === 0) {
      return {
        results: [],
        applied_count: 0,
        failed_count: 0,
        server_time: new Date().toISOString(),
      } as NoteMutationBatchResponse;
    }

    const payload: NoteMutationBatchRequest = { mutations };

    try {
      return (await api.post<NoteMutationBatchResponse>(
        ENDPOINTS.LIBRARY.MUTATIONS,
        payload,
      )) as unknown as NoteMutationBatchResponse;
    } catch (error) {
      throw parseServiceError(error, {
        fallbackKey: "error.sync.replayFailed",
        statusMap: {
          401: { key: "error.auth.unauthorized", toastType: "info" },
          422: { key: "error.validation.invalid", toastType: "warning" },
          429: { key: "error.common.rateLimited", toastType: "warning" },
        },
      });
    }
  },
};
