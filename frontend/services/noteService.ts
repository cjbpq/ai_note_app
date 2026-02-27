import { Platform } from "react-native";
import { APP_CONFIG, ENDPOINTS } from "../constants/config";
import i18next from "../i18n";
import { useNetworkStore } from "../store/useNetworkStore";
import {
  JobStatusResponse,
  Note,
  NotesAPIResponse,
  RawNoteFromAPI,
  RawSmartNoteData,
  ServiceError,
  SmartNoteData,
  SmartNoteMeta,
  UploadResponse,
} from "../types";
import {
  toOptionalSafeSections,
  toOptionalSafeStringArray,
} from "../utils/safeData";
import api from "./api";
import {
  deleteNoteLocally,
  enqueueSyncOperation,
  fetchLocalNoteById,
  fetchLocalNotes,
  saveNoteLocally,
  saveNotesToLocal,
  updateNoteSyncStatus,
} from "./database";
import { parseServiceError } from "./errorService";

// ============================================================================
// 字段规范化工具函数
// ============================================================================

/**
 * 将后端 structured_data (snake_case) 转换为前端 SmartNoteData (camelCase)
 *
 * 转换映射：
 * - raw_text → rawText
 * - key_points → keyPoints
 * - study_advice → studyAdvice
 * - meta.prompt_profile → meta.promptProfile
 * - meta.original_note_type → meta.originalNoteType
 *
 * 注意：meta.response（AI 原始响应体）体积大且前端不使用，直接丢弃
 */
const normalizeStructuredData = (
  raw: RawSmartNoteData | Record<string, unknown> | undefined,
): SmartNoteData | undefined => {
  if (!raw || typeof raw !== "object") return undefined;

  const data = raw as RawSmartNoteData;

  // 如果 data 中没有任何有意义的字段，视为空
  if (!data.title && !data.summary && !data.sections && !data.key_points) {
    return undefined;
  }

  const keyPoints = toOptionalSafeStringArray(data.key_points);
  const sections = toOptionalSafeSections(data.sections);

  // 转换 meta 对象
  let meta: SmartNoteMeta | undefined;
  if (data.meta && typeof data.meta === "object") {
    meta = {
      subject: data.meta.subject,
      promptProfile: data.meta.prompt_profile,
      warnings: toOptionalSafeStringArray(data.meta.warnings),
      tags: toOptionalSafeStringArray(data.meta.tags),
      originalNoteType: data.meta.original_note_type,
      provider: data.meta.provider,
      // 故意不映射 meta.response — 体积大且前端不需要
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

/**
 * 将后端原始笔记数据规范化为前端统一的 Note 格式
 *
 * 完整字段映射表：
 * | 后端 (snake_case)  | 前端 (camelCase)  |
 * |--------------------|-------------------|
 * | original_text      | content           |
 * | created_at         | date              |
 * | updated_at         | updatedAt         |
 * | image_urls         | imageUrls         |
 * | image_filenames    | imageFilenames    |
 * | image_sizes        | imageSizes        |
 * | is_favorite        | isFavorite        |
 * | is_archived        | isArchived        |
 * | user_id            | userId            |
 * | device_id          | deviceId          |
 * | structured_data    | structuredData (经 normalizeStructuredData 深度转换) |
 */
const normalizeNote = (raw: RawNoteFromAPI): Note => {
  // 日期：优先 created_at
  const date =
    raw.created_at || raw.date || raw.createdAt || new Date().toISOString();

  // 内容：优先 original_text
  const content = raw.original_text || raw.content || "";

  // 分类
  const category = raw.category || raw.categoryId || raw.category_id || "";

  // 标签：处理可能的字符串或数组
  let tags: string[] = [];
  if (Array.isArray(raw.tags)) {
    tags = raw.tags;
  } else if (typeof raw.tags === "string") {
    try {
      tags = JSON.parse(raw.tags);
    } catch {
      tags = raw.tags ? [raw.tags] : [];
    }
  }

  // 图片 URL：新后端返回 image_urls 数组，兼容旧单值字段
  // 相对路径拼接完整地址
  let imageUrls: string[] = [];
  if (Array.isArray(raw.image_urls) && raw.image_urls.length > 0) {
    // 新后端格式：image_urls 数组
    imageUrls = raw.image_urls.map((url) =>
      url.startsWith("/") ? `${APP_CONFIG.STATIC_BASE_URL}${url}` : url,
    );
  } else {
    // 兼容旧后端：单值 image_url / imageUrl 回退
    const legacyUrl = raw.image_url ?? raw.imageUrl;
    if (legacyUrl) {
      const fullUrl = legacyUrl.startsWith("/")
        ? `${APP_CONFIG.STATIC_BASE_URL}${legacyUrl}`
        : legacyUrl;
      imageUrls = [fullUrl];
    }
  }

  // 图片文件名：新后端 image_filenames 数组，兼容旧 image_filename 单值
  const imageFilenames: string[] = Array.isArray(raw.image_filenames)
    ? raw.image_filenames
    : raw.image_filename
      ? [raw.image_filename]
      : [];

  // 图片大小：新后端 image_sizes 数组，兼容旧 image_size 单值
  const imageSizes: number[] = Array.isArray(raw.image_sizes)
    ? raw.image_sizes
    : raw.image_size != null
      ? [raw.image_size]
      : [];

  // 结构化数据：深度 snake_case → camelCase 转换
  const rawStructured = raw.structured_data || raw.structuredData;
  const structuredData = normalizeStructuredData(
    rawStructured as RawSmartNoteData | undefined,
  );

  return {
    id: raw.id,
    title: raw.title || "Untitled",
    content,
    date,
    updatedAt: raw.updated_at,
    tags,
    imageUrls,
    imageFilenames,
    imageSizes,
    category,
    isFavorite: raw.is_favorite ?? false,
    isArchived: raw.is_archived ?? false,
    userId: raw.user_id,
    deviceId: raw.device_id,
    structuredData,
  };
};

/**
 * 批量规范化笔记数组
 */
const normalizeNotes = (rawNotes: RawNoteFromAPI[]): Note[] => {
  return rawNotes.map(normalizeNote);
};

/**
 * 将前端 Note 格式转换为后端 API 期望的请求格式 (camelCase → snake_case)
 *
 * 前端字段 → 后端字段映射：
 * - content → original_text
 * - category → category (保持不变)
 * - tags → tags (保持不变)
 * - title → title (保持不变)
 * - isFavorite → is_favorite
 * - structuredData → structured_data (经 reverseStructuredData 反向转换)
 */
const toAPIFormat = (note: Partial<Note>): Record<string, unknown> => {
  const apiData: Record<string, unknown> = {};

  // 标题字段 (无需转换)
  if (note.title !== undefined) {
    apiData.title = note.title;
  }

  // 内容字段: content → original_text
  if (note.content !== undefined) {
    apiData.original_text = note.content;
  }

  // 分类字段: category → category
  if (note.category !== undefined) {
    apiData.category = note.category;
  }

  // 标签字段 (无需转换)
  if (note.tags !== undefined) {
    apiData.tags = note.tags;
  }

  // 结构化数据: structuredData → structured_data (反向深度转换)
  if (note.structuredData !== undefined) {
    apiData.structured_data = reverseStructuredData(note.structuredData);
  }

  // 收藏字段: isFavorite → is_favorite
  if (note.isFavorite !== undefined) {
    apiData.is_favorite = note.isFavorite;
  }

  return apiData;
};

/**
 * 将前端 SmartNoteData 反向转为后端 snake_case 格式
 * 仅在需要提交 structured_data 修改时使用
 */
const reverseStructuredData = (
  data: SmartNoteData | undefined,
): Record<string, unknown> | undefined => {
  if (!data) return undefined;

  return {
    title: data.title,
    summary: data.summary,
    raw_text: data.rawText,
    sections: data.sections,
    key_points: data.keyPoints,
    study_advice: data.studyAdvice,
    meta: data.meta
      ? {
          subject: data.meta.subject,
          prompt_profile: data.meta.promptProfile,
          warnings: data.meta.warnings,
          tags: data.meta.tags,
          original_note_type: data.meta.originalNoteType,
          provider: data.meta.provider,
        }
      : undefined,
  };
};

/**
 * 判断笔记是否包含「详情级」数据
 *
 * 列表 API 仅返回标题/标签/首图等元数据（不含 structuredData / content），
 * 只有通过详情 API 获取的笔记才包含完整的结构化数据或正文内容。
 *
 * 用途：
 *   - 离线时判断本地缓存是否为「完整缓存」（值得展示给用户）
 *   - 在线 API 失败回退本地时，判断是否有足够丰富的缓存可用
 *   - 如果仅有列表级数据 → 不应作为详情页数据源（避免展示空白内容）
 */
const hasDetailLevelData = (note: Note): boolean => {
  // 有结构化数据（含实际内容字段）
  if (
    note.structuredData &&
    (note.structuredData.summary ||
      note.structuredData.sections ||
      note.structuredData.keyPoints ||
      note.structuredData.rawText)
  ) {
    return true;
  }
  // 有正文内容
  if (note.content && note.content.trim().length > 0) {
    return true;
  }
  return false;
};

// ============================================================================
// Mock Data - 使用可变数组，支持运行时增删改
// ============================================================================
const MOCK_NOTES: Note[] = [
  {
    id: "1",
    title: "Mock Note 1",
    content:
      "Content displayed when no backend connection. You can disable MOCK mode in .env.",
    date: new Date().toISOString(),
    tags: ["mock", "demo"],
    imageUrls: [],
    imageFilenames: [],
    imageSizes: [],
  },
  {
    id: "2",
    title: "React Native Learning",
    content: "Expo is convenient, especially routing and auto-build.",
    date: new Date(Date.now() - 86400000).toISOString(),
    tags: ["learning"],
    imageUrls: [],
    imageFilenames: [],
    imageSizes: [],
  },
];

/**
 * Helper: 向 Mock 列表添加笔记（避免重复）
 */
const addMockNote = (note: Note) => {
  const exists = MOCK_NOTES.find((n) => n.id === note.id);
  if (!exists) {
    MOCK_NOTES.unshift(note); // 添加到列表顶部
  }
};

const USE_MOCK = process.env.EXPO_PUBLIC_USE_MOCK === "true";

// ============================================================================
// Service Implementation
// ============================================================================

export const noteService = {
  // 统一后端状态到前端可识别状态
  normalizeJobStatus: (status?: string): JobStatusResponse["status"] => {
    const normalized = status?.toLowerCase();
    if (normalized === "persisted" || normalized === "completed") {
      return "completed";
    }
    if (normalized === "processing" || normalized === "running") {
      return "processing";
    }
    if (normalized === "failed" || normalized === "error") {
      return "failed";
    }
    return "pending";
  },
  /**
   * 获取单条笔记（Mock 环境下模拟）
   */
  getNote: async (id: string): Promise<Note | undefined> => {
    if (USE_MOCK) {
      if (id === "note-ai-generated") {
        await new Promise((resolve) => setTimeout(resolve, 300));
        return {
          id: "note-ai-generated",
          title: "AI 识别结果",
          content:
            "这是从图片中提取的文字内容：\n\n1. 关键公式 E=mc²\n2. 历史背景...\n\n(此为 Mock 数据)",
          date: new Date().toISOString(),
          tags: ["AI", "识别"],
          imageUrls: [],
          imageFilenames: [],
          imageSizes: [],
        };
      }
      return MOCK_NOTES.find((n) => n.id === id);
    }
    // 真实 API
    try {
      const resp = await api.get<Note>(`${ENDPOINTS.LIBRARY.GET_NOTE}/${id}`);
      return resp as unknown as Note;
    } catch {
      return undefined;
    }
  },

  /**
   * 获取笔记列表
   *
   * 策略：
   *   1. 在线 → 请求 API → 成功后 UPSERT 本地缓存 → 返回
   *   2. 在线但 API 失败 → 降级读取本地 SQLite 缓存 → 返回
   *   3. 离线 → 直接读取本地 SQLite 缓存，跳过 API（避免 10s 超时等待）
   */
  fetchNotes: async (): Promise<Note[]> => {
    if (USE_MOCK) {
      console.log("[Mock API] fetchNotes called");
      await new Promise((resolve) => setTimeout(resolve, 800));
      return MOCK_NOTES;
    }

    // 网络感知：离线时直接走本地缓存，无需等待 API 超时
    const isOnline = useNetworkStore.getState().isOnline;

    if (!isOnline) {
      console.log("[Service] Offline detected, reading local cache directly");
      const localNotes = await fetchLocalNotes();
      // 离线时即使本地为空也不抛错（用户可能刚安装、未曾联网过）
      return localNotes;
    }

    try {
      // 优先从网络获取
      // 注意：后端返回 { notes: [...] } 包装对象
      const response = await api.get<NotesAPIResponse | RawNoteFromAPI[]>(
        ENDPOINTS.LIBRARY.GET_NOTE,
      );

      // 处理两种可能的响应格式：{ notes: [...] } 或直接 [...]
      let rawNotes: RawNoteFromAPI[];
      if (response && typeof response === "object" && "notes" in response) {
        // 后端返回 { notes: [...] } 格式
        rawNotes = (response as NotesAPIResponse).notes || [];
      } else if (Array.isArray(response)) {
        // 直接返回数组格式
        rawNotes = response as RawNoteFromAPI[];
      } else {
        console.warn("Unexpected fetchNotes response format:", response);
        rawNotes = [];
      }

      // 关键：规范化后端返回的数据
      const notes = normalizeNotes(rawNotes);
      console.log(`[Service] Fetched ${notes.length} notes from API`);

      // 如果网络请求成功，缓存到本地数据库 (Cache Aside Pattern)
      // 注意：即便 notes 为空，也需要覆盖本地缓存，避免残留旧账号/旧数据
      saveNotesToLocal(notes).catch((err: unknown) =>
        console.warn("Sync to local DB failed:", err),
      );

      return notes;
    } catch (error) {
      console.warn("fetchNotes network error, falling back to local DB", error);
      // 网络失败，降级读取本地缓存
      const localNotes = await fetchLocalNotes();
      if (localNotes.length > 0) {
        return localNotes;
      }
      throw error; // 如果本地也没数据，抛出异常
    }
  },

  /**
   * 获取笔记详情
   *
   * 策略：
   *   - 在线 → 请求 API → 成功后写本地缓存
   *   - 离线 → 直接读本地 SQLite 缓存（若命中）
   *
   * @param noteId - 笔记ID
   */
  getNoteById: async (noteId: string): Promise<Note> => {
    if (USE_MOCK) {
      console.log("[Mock API] getNoteById called", noteId);
      await new Promise((resolve) => setTimeout(resolve, 500));
      const note = MOCK_NOTES.find((n) => n.id === noteId);
      if (note) return note;
      return {
        id: noteId,
        title: `Mock Note ${noteId}`,
        content: "Detailed content for mock note...",
        date: new Date().toISOString(),
        tags: ["mock-detail"],
        imageUrls: [],
        imageFilenames: [],
        imageSizes: [],
      };
    }

    // 网络感知：离线时直接读本地缓存
    const isOnline = useNetworkStore.getState().isOnline;

    if (!isOnline) {
      console.log("[Service] Offline — reading note from local cache:", noteId);
      const localNote = await fetchLocalNoteById(noteId);
      // 只返回包含详情级数据的缓存（列表级缓存不足以展示详情页）
      if (localNote && hasDetailLevelData(localNote)) return localNote;
      // 无缓存或仅列表级缓存 → 提示「未缓存」
      throw parseServiceError(null, {
        fallbackKey: "error.note.offlineNotCached",
        statusMap: {},
      });
    }

    // 在线 → 请求 API
    try {
      const response = await api.get<RawNoteFromAPI>(
        `${ENDPOINTS.LIBRARY.GET_NOTE}/${noteId}`,
      );
      const rawNote = response as unknown as RawNoteFromAPI;
      const note = normalizeNote(rawNote);

      // 获取单条详情成功后，也更新本地缓存，确保离线可用
      saveNoteLocally(note).catch((err: unknown) =>
        console.warn("Save note locally failed:", err),
      );

      return note;
    } catch (error) {
      // API 失败时尝试读本地缓存作为兆底（仅返回详情级缓存，避免展示空白）
      const localNote = await fetchLocalNoteById(noteId);
      if (localNote && hasDetailLevelData(localNote)) {
        console.log(
          "[Service] API failed, returning cached detail note:",
          noteId,
        );
        return localNote;
      }

      throw parseServiceError(error, {
        fallbackKey: "error.note.loadFailed",
        statusMap: {
          403: { key: "error.note.forbidden", toastType: "error" },
          404: { key: "error.note.notFound", toastType: "error" },
          422: { key: "error.validation.invalid", toastType: "warning" },
        },
      });
    }
  },

  /**
   * 创建新笔记
   */
  createNote: async (newNote: Omit<Note, "id" | "date">): Promise<Note> => {
    if (USE_MOCK) {
      console.log("[Mock API] createNote called", newNote);
      await new Promise((resolve) => setTimeout(resolve, 800));
      const created: Note = {
        ...newNote,
        id: Math.random().toString(36).substr(2, 9),
        date: new Date().toISOString(),
      };
      // 关键：将新笔记添加到 Mock 列表
      addMockNote(created);
      return created;
    }

    try {
      const response = await api.post<Note>(
        ENDPOINTS.LIBRARY.GET_NOTE,
        newNote,
      );
      const createdNote = response as unknown as Note;

      // 成功后同步保存到本地
      saveNoteLocally(createdNote).catch((err: unknown) =>
        console.warn("Save local failed:", err),
      );

      return createdNote;
    } catch (error) {
      throw parseServiceError(error, {
        fallbackKey: "error.note.createFailed",
        statusMap: {
          422: { key: "error.validation.invalid", toastType: "warning" },
          429: {
            key: "error.common.rateLimited",
            toastType: "warning",
            retryable: true,
          },
        },
      });
    }
  },

  /**
   * 删除笔记
   *
   * 离线模式 (Phase B)：
   *   - 先从本地 SQLite 删除 → 用户立即看到笔记消失
   *   - 同时将 delete 操作入队 sync_queue → 恢复在线后重放
   */
  deleteNote: async (id: string): Promise<void> => {
    if (USE_MOCK) {
      console.log("[Mock API] deleteNote called", id);
      await new Promise((resolve) => setTimeout(resolve, 500));
      // 关键：从 Mock 列表中移除
      const index = MOCK_NOTES.findIndex((n) => n.id === id);
      if (index !== -1) {
        MOCK_NOTES.splice(index, 1);
      }
      return;
    }

    const isOnline = useNetworkStore.getState().isOnline;

    if (!isOnline) {
      // ── 离线模式：本地删除 + 入队 ──
      console.log("[Service] Offline delete — local + enqueue:", id);
      await deleteNoteLocally(id);
      await enqueueSyncOperation("delete", id);
      return;
    }

    // ── 在线模式：本地优先删除，API 失败时回滚 ──
    const localNote = await fetchLocalNoteById(id);
    await deleteNoteLocally(id);

    try {
      await api.delete(`${ENDPOINTS.LIBRARY.GET_NOTE}/${id}`);
    } catch (error) {
      // API 失败时回滚本地删除，保证一致性
      if (localNote) {
        saveNoteLocally(localNote).catch((err: unknown) =>
          console.warn("Rollback local failed:", err),
        );
      }
      throw parseServiceError(error, {
        fallbackKey: "error.note.deleteFailed",
        statusMap: {
          404: { key: "error.note.notFound", toastType: "error" },
          403: { key: "error.note.forbidden", toastType: "error" },
        },
      });
    }
  },

  /**
   * 更新笔记
   *
   * 离线模式 (Phase B)：
   *   - 将更新合并到本地 SQLite 缓存 → 用户立即看到新数据
   *   - 标记 isSynced=0（有未同步变更）
   *   - edit 操作入队 sync_queue → 恢复在线后重放
   */
  updateNote: async (id: string, updatedNote: Partial<Note>): Promise<Note> => {
    if (USE_MOCK) {
      console.log("[Mock API] updateNote called", id, updatedNote);
      await new Promise((resolve) => setTimeout(resolve, 500));
      const index = MOCK_NOTES.findIndex((n) => n.id === id);
      if (index !== -1) {
        MOCK_NOTES[index] = { ...MOCK_NOTES[index], ...updatedNote };
        return MOCK_NOTES[index];
      }
      throw new Error("Note not found in mock");
    }

    const isOnline = useNetworkStore.getState().isOnline;

    if (!isOnline) {
      // ── 离线模式：本地合并 + 标记未同步 + 入队 ──
      console.log("[Service] Offline edit — local merge + enqueue:", id);
      const localNote = await fetchLocalNoteById(id);
      if (!localNote) {
        throw parseServiceError(null, {
          fallbackKey: "error.note.offlineNotCached",
          statusMap: {},
        });
      }
      // 合并更新到本地
      const merged: Note = { ...localNote, ...updatedNote };
      await saveNoteLocally(merged);
      await updateNoteSyncStatus(id, false); // isSynced=0
      // 入队：payload 存更新字段的 API 格式
      await enqueueSyncOperation("edit", id, toAPIFormat(updatedNote));
      return merged;
    }

    // ── 在线模式 ──
    // 关键：将前端 Note 格式转换为后端 API 期望的格式
    const apiPayload = toAPIFormat(updatedNote);
    console.log("[Service] updateNote API payload:", apiPayload);

    try {
      const response = await api.put<RawNoteFromAPI>(
        `${ENDPOINTS.LIBRARY.GET_NOTE}/${id}`,
        apiPayload,
      );

      // 规范化后端返回的数据
      const rawNote = response as unknown as RawNoteFromAPI;
      const finalNote = normalizeNote(rawNote);

      // 成功后更新本地
      saveNoteLocally(finalNote).catch((err: unknown) =>
        console.warn("Update local failed:", err),
      );

      return finalNote;
    } catch (error) {
      throw parseServiceError(error, {
        fallbackKey: "error.note.updateFailed",
        statusMap: {
          404: { key: "error.note.notFound", toastType: "error" },
          403: { key: "error.note.forbidden", toastType: "error" },
          422: { key: "error.validation.invalid", toastType: "warning" },
        },
      });
    }
  },

  /**
   * 切换收藏状态
   *
   * 离线模式 (Phase B)：
   *   - 本地切换 isFavorite → 用户立即看到收藏变化
   *   - 标记 isSynced=0 + 入队 sync_queue
   */
  toggleFavorite: async (id: string): Promise<Note> => {
    if (USE_MOCK) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      const index = MOCK_NOTES.findIndex((n) => n.id === id);
      if (index === -1) {
        throw new Error(i18next.t("service.note_not_found"));
      }
      const current = MOCK_NOTES[index];
      const nextFavorite = !current.isFavorite;
      const updated = { ...current, isFavorite: nextFavorite };
      MOCK_NOTES[index] = updated;
      return updated;
    }

    const isOnline = useNetworkStore.getState().isOnline;

    if (!isOnline) {
      // ── 离线模式：本地切换 + 入队 ──
      console.log("[Service] Offline favorite toggle — local + enqueue:", id);
      const localNote = await fetchLocalNoteById(id);
      if (!localNote) {
        throw parseServiceError(null, {
          fallbackKey: "error.note.offlineNotCached",
          statusMap: {},
        });
      }
      const nextFavorite = !(localNote.isFavorite ?? false);
      const merged: Note = { ...localNote, isFavorite: nextFavorite };
      await saveNoteLocally(merged);
      await updateNoteSyncStatus(id, false);
      await enqueueSyncOperation("favorite", id, {
        is_favorite: nextFavorite,
      });
      return merged;
    }

    // ── 在线模式 ──
    try {
      const response = await api.post<RawNoteFromAPI>(
        ENDPOINTS.LIBRARY.TOGGLE_FAVORITE(id),
      );
      const rawNote = response as unknown as RawNoteFromAPI;
      const finalNote = normalizeNote(rawNote);
      saveNoteLocally(finalNote).catch((err: unknown) =>
        console.warn("Save favorite locally failed:", err),
      );
      return finalNote;
    } catch (error) {
      throw parseServiceError(error, {
        fallbackKey: "error.note.favoriteFailed",
        statusMap: {
          404: { key: "error.note.notFound", toastType: "error" },
          403: { key: "error.note.forbidden", toastType: "error" },
        },
      });
    }
  },

  // =========================================================================
  // 同步笔记到本地缓存 (供 Hook 层调用，不涉及网络请求)
  // =========================================================================
  /**
   * 将单条笔记同步到本地 SQLite 缓存
   *
   * 使用场景：
   * - 用户点击"保存"按钮后，将已从后端获取的笔记持久化到本地
   * - 确保离线时也能访问该笔记
   *
   * @param note - 完整的笔记对象
   */
  syncNoteToLocal: async (note: Note): Promise<void> => {
    if (USE_MOCK) {
      // Mock 模式：确保笔记在内存列表中
      console.log("[Mock] syncNoteToLocal called", note.id);
      addMockNote(note);
      return;
    }

    // 非 Mock 模式：写入 SQLite
    console.log("[Service] Syncing note to local SQLite:", note.id);
    await saveNoteLocally(note);
  },

  /**
   * 上传图片生成笔记 (Scene 1)
   * 支持单张或多张图片上传 —— 后端 "files" 字段接收多文件
   * @param imageUris 图片本地 URI 数组（至少 1 张）
   * @param noteType 笔记类型
   */
  uploadImageNote: async (
    imageUris: string[],
    noteType: string = "学习笔记",
  ): Promise<UploadResponse> => {
    if (USE_MOCK) {
      console.log("[Mock API] uploadImageNote called", imageUris, noteType);
      await new Promise((resolve) => setTimeout(resolve, 1500));
      return {
        job_id: "mock-job-" + Date.now().toString(),
        note_id: "mock-note-" + Date.now().toString(),
        status: "ENQUEUED",
      };
    }

    const formData = new FormData();

    // 逐张追加到同一个 "files" 字段（后端按 multipart 接收多文件）
    for (let i = 0; i < imageUris.length; i++) {
      const uri = imageUris[i];
      const filename = `upload_${i}.jpg`;

      if (Platform.OS === "web") {
        const response = await fetch(uri);
        const blob = await response.blob();
        formData.append("files", blob, filename);
      } else {
        // @ts-ignore: React Native FormData append supports object for file
        formData.append("files", {
          uri,
          name: filename,
          type: "image/jpeg",
        });
      }
    }

    formData.append("note_type", noteType);

    try {
      const response = await api.post<UploadResponse>(
        ENDPOINTS.LIBRARY.UPLOAD_IMAGE,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
          transformRequest: (data) => data,
        },
      );
      return response as unknown as UploadResponse;
    } catch (error) {
      throw parseServiceError(error, {
        fallbackKey: "error.upload.failed",
        statusMap: {
          400: { key: "error.upload.invalidFile", toastType: "warning" },
          401: { key: "error.auth.unauthorized", toastType: "info" },
          422: { key: "error.validation.invalid", toastType: "warning" },
          429: {
            key: "error.common.rateLimited",
            toastType: "warning",
            retryable: true,
          },
          500: {
            key: "error.server.unavailable",
            toastType: "error",
            retryable: true,
          },
        },
      });
    }
  },

  /**
   * 轮询查询任务状态
   * @param jobId - 任务ID
   * @returns 任务状态和 note_id
   */
  getJobStatus: async (jobId: string): Promise<JobStatusResponse> => {
    if (USE_MOCK) {
      console.log("[Mock API] getJobStatus called", jobId);
      await new Promise((resolve) => setTimeout(resolve, 300));

      const random = Math.random();
      // 提高完成概率便于测试
      if (random > 0.4) {
        // 生成唯一的 noteId 并创建对应的笔记
        const noteId = `note-ai-${jobId}`;

        // 关键：在 Mock 模式下，当任务完成时创建对应的笔记
        addMockNote({
          id: noteId,
          title: "AI 识别结果 (Mock)",
          content: `这是模拟 AI 识别生成的笔记内容。\n\n任务 ID: ${jobId}\n生成时间: ${new Date().toLocaleString()}`,
          date: new Date().toISOString(),
          tags: ["AI", "扫描"],
          imageUrls: [],
          imageFilenames: [],
          imageSizes: [],
        });

        return { status: "completed", note_id: noteId };
      } else if (random > 0.2) {
        return { status: "processing" };
      } else {
        return { status: "pending" };
      }
    }

    try {
      const response = (await api.get<{
        status?: string;
        note_id?: string;
        id?: string;
      }>(`${ENDPOINTS.UPLOAD.GET_JOB}/${jobId}`)) as unknown as {
        status?: string;
        note_id?: string;
        id?: string;
      };
      return {
        status: noteService.normalizeJobStatus(response?.status),
        note_id: response?.note_id,
      };
    } catch (error) {
      throw parseServiceError(error, {
        fallbackKey: "error.upload.jobStatusFailed",
        statusMap: {
          403: { key: "error.upload.jobForbidden", toastType: "error" },
          404: { key: "error.upload.jobNotFound", toastType: "error" },
          422: { key: "error.validation.invalid", toastType: "warning" },
        },
      });
    }
  },

  /**
   * 等待任务完成并获取 note_id
   * 这是一个高级封装，内部实现轮询逻辑
   */
  waitForJobCompletion: async (jobId: string): Promise<string> => {
    if (USE_MOCK) {
      console.log("[Mock Service] waitForJobCompletion started for", jobId);
      let attempts = 0;
      while (attempts < 5) {
        // 简单模拟轮询
        attempts++;
        await new Promise((r) => setTimeout(r, 500));
        const status = await noteService.getJobStatus(jobId);
        if (status.status === "completed" && status.note_id) {
          return status.note_id;
        }
      }
      return "note-ai-generated";
    }

    let retries = 0;
    while (retries < APP_CONFIG.JOB_MAX_RETRIES) {
      try {
        const result = await noteService.getJobStatus(jobId);
        if (result.status === "completed" && result.note_id) {
          return result.note_id;
        }
        if (result.status === "failed") {
          throw new ServiceError({
            message: i18next.t("error.upload.jobFailed"),
            i18nKey: "error.upload.jobFailed",
            toastType: "error",
            retryable: true,
          });
        }
      } catch (error) {
        console.warn("轮询出错:", error);
      }

      await new Promise((r) => setTimeout(r, APP_CONFIG.JOB_POLL_INTERVAL));
      retries++;
    }
    throw new ServiceError({
      message: i18next.t("error.upload.jobTimeout"),
      i18nKey: "error.upload.jobTimeout",
      toastType: "error",
      retryable: true,
    });
  },
};
