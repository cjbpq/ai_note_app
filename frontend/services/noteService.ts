import { AxiosError } from "axios";
import { Platform } from "react-native";
import { APP_CONFIG, ENDPOINTS } from "../constants/config";
import i18next from "../i18n";
import {
  JobStatusResponse,
  Note,
  NotesAPIResponse,
  RawNoteFromAPI,
  RawSmartNoteData,
  SmartNoteData,
  SmartNoteMeta,
  UploadResponse,
} from "../types";
import api from "./api";
import {
  deleteNoteLocally,
  fetchLocalNoteById,
  fetchLocalNotes,
  saveNoteLocally,
  saveNotesToLocal,
} from "./database";

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

  // 转换 meta 对象
  let meta: SmartNoteMeta | undefined;
  if (data.meta && typeof data.meta === "object") {
    meta = {
      subject: data.meta.subject,
      promptProfile: data.meta.prompt_profile,
      warnings: data.meta.warnings,
      tags: data.meta.tags,
      originalNoteType: data.meta.original_note_type,
      provider: data.meta.provider,
      // 故意不映射 meta.response — 体积大且前端不需要
    };
  }

  return {
    title: data.title,
    summary: data.summary,
    rawText: data.raw_text,
    sections: data.sections, // 内部字段 heading/content 无需转换
    keyPoints: data.key_points,
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
 * | image_url          | imageUrl          |
 * | image_filename     | imageFilename     |
 * | image_size         | imageSize         |
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

  // 图片 URL：相对路径拼接完整地址
  let imageUrl = raw.imageUrl || raw.image_url;
  if (imageUrl && imageUrl.startsWith("/")) {
    imageUrl = `${APP_CONFIG.STATIC_BASE_URL}${imageUrl}`;
  }

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
    imageUrl,
    imageFilename: raw.image_filename,
    imageSize: raw.image_size,
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
  },
  {
    id: "2",
    title: "React Native Learning",
    content: "Expo is convenient, especially routing and auto-build.",
    date: new Date(Date.now() - 86400000).toISOString(),
    tags: ["learning"],
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

/**
 * 提取后端错误信息，优先使用 detail.msg，避免 UI 处理 axios 细节
 */
const extractApiErrorMessage = (
  error: unknown,
  fallbackKey: string,
): string => {
  if (error instanceof AxiosError) {
    const data = error.response?.data as any;
    if (Array.isArray(data?.detail) && data.detail.length > 0) {
      const first = data.detail[0];
      const msg = first?.msg as string | undefined;
      const loc = Array.isArray(first?.loc) ? first.loc.join(".") : undefined;
      if (msg) {
        return loc ? `${loc}: ${msg}` : msg;
      }
    }
    if (typeof data?.message === "string") {
      return data.message;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return i18next.t(fallbackKey);
};

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
   */
  fetchNotes: async (): Promise<Note[]> => {
    if (USE_MOCK) {
      console.log("[Mock API] fetchNotes called");
      await new Promise((resolve) => setTimeout(resolve, 800));
      return MOCK_NOTES;
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
      };
    }

    // 真实 API：获取并规范化
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

    const response = await api.post<Note>(ENDPOINTS.LIBRARY.GET_NOTE, newNote);
    const createdNote = response as unknown as Note;

    // 成功后同步保存到本地
    saveNoteLocally(createdNote).catch((err: unknown) =>
      console.warn("Save local failed:", err),
    );

    return createdNote;
  },

  /**
   * 删除笔记
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
    // 本地优先删除，失败时回滚
    const localNote = await fetchLocalNoteById(id);

    await deleteNoteLocally(id);

    try {
      await api.delete(`${ENDPOINTS.LIBRARY.GET_NOTE}/${id}`);
    } catch (error) {
      // API 失败时回滚本地删除，保证离线一致性
      if (localNote) {
        saveNoteLocally(localNote).catch((err: unknown) =>
          console.warn("Rollback local failed:", err),
        );
      }
      throw error;
    }
  },

  /**
   * 更新笔记
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

    // 关键：将前端 Note 格式转换为后端 API 期望的格式
    const apiPayload = toAPIFormat(updatedNote);
    console.log("[Service] updateNote API payload:", apiPayload);

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
  },

  /**
   * 切换收藏状态
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
      throw new Error(extractApiErrorMessage(error, "service.favorite_failed"));
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
   * @param imageUri 图片本地URI
   * @param noteType 笔记类型
   */
  uploadImageNote: async (
    imageUri: string,
    noteType: string = "学习笔记",
  ): Promise<UploadResponse> => {
    if (USE_MOCK) {
      console.log("[Mock API] uploadImageNote called", imageUri, noteType);
      await new Promise((resolve) => setTimeout(resolve, 1500));
      return {
        job_id: "mock-job-" + Date.now().toString(),
        note_id: "mock-note-" + Date.now().toString(),
        status: "ENQUEUED",
      };
    }

    const formData = new FormData();

    if (Platform.OS === "web") {
      // Web 环境下，需要将 URI 转换为 Blob 上传
      const response = await fetch(imageUri);
      const blob = await response.blob();
      formData.append("file", blob, "upload.jpg");
    } else {
      // React Native 环境下，直接构造文件对象
      // @ts-ignore: React Native FormData append supports object for file
      formData.append("file", {
        uri: imageUri,
        name: "upload.jpg",
        type: "image/jpeg",
      });
    }

    formData.append("note_type", noteType);

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
        });

        return { status: "completed", note_id: noteId };
      } else if (random > 0.2) {
        return { status: "processing" };
      } else {
        return { status: "pending" };
      }
    }

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
          throw new Error(i18next.t("service.job_failed"));
        }
      } catch (error) {
        console.warn("轮询出错:", error);
      }

      await new Promise((r) => setTimeout(r, APP_CONFIG.JOB_POLL_INTERVAL));
      retries++;
    }
    throw new Error(i18next.t("service.job_timeout"));
  },
};
