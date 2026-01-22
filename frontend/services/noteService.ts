import { Platform } from "react-native";
import { APP_CONFIG, ENDPOINTS } from "../constants/config";
import i18next from "../i18n";
import {
  JobStatusResponse,
  Note,
  NotesAPIResponse,
  RawNoteFromAPI,
  UploadResponse,
} from "../types";
import api from "./api";
import {
  deleteNoteLocally,
  fetchLocalNotes,
  saveNoteLocally,
  saveNotesToLocal,
} from "./database";

// ============================================================================
// 字段规范化工具函数
// ============================================================================

/**
 * 将后端返回的原始笔记数据规范化为前端统一的 Note 格式
 *
 * 后端字段映射：
 * - original_text → content (后端使用 original_text 存储笔记内容)
 * - category → categoryId (后端使用 category 存储分类名)
 * - created_at → date
 * - image_url → imageUrl (并转换为完整 URL)
 * - structured_data → structuredData
 */
const normalizeNote = (raw: RawNoteFromAPI): Note => {
  // 处理日期字段 (优先使用 created_at)
  const date =
    raw.created_at || raw.date || raw.createdAt || new Date().toISOString();

  // 处理内容字段 (后端使用 original_text)
  const content = raw.original_text || raw.content || "";

  // 处理分类字段 (后端使用 category)
  const categoryId = raw.category || raw.categoryId || raw.category_id || "";

  // 处理 tags 字段 (可能是字符串或数组)
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

  // 处理结构化数据
  const structuredData = raw.structuredData || raw.structured_data;

  // 处理图片 URL
  // 后端返回的可能是相对路径（如 /static/xxx.jpg），需要拼接服务器地址
  let imageUrl = raw.imageUrl || raw.image_url;
  if (imageUrl && imageUrl.startsWith("/")) {
    // 相对路径，拼接静态资源基础 URL
    imageUrl = `${APP_CONFIG.STATIC_BASE_URL}${imageUrl}`;
  }

  return {
    id: raw.id,
    title: raw.title || "Untitled",
    content,
    date,
    tags,
    imageUrl,
    categoryId,
    structuredData: structuredData as Note["structuredData"],
  };
};

/**
 * 批量规范化笔记数组
 */
const normalizeNotes = (rawNotes: RawNoteFromAPI[]): Note[] => {
  return rawNotes.map(normalizeNote);
};

/**
 * 将前端 Note 格式转换为后端 API 期望的请求格式
 *
 * 前端字段 → 后端字段映射：
 * - content → original_text
 * - categoryId → category
 * - tags → tags (保持不变)
 * - title → title (保持不变)
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

  // 分类字段: categoryId → category
  if (note.categoryId !== undefined) {
    apiData.category = note.categoryId;
  }

  // 标签字段 (无需转换)
  if (note.tags !== undefined) {
    apiData.tags = note.tags;
  }

  // 结构化数据: structuredData → structured_data
  if (note.structuredData !== undefined) {
    apiData.structured_data = note.structuredData;
  }

  return apiData;
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
      if (notes && notes.length > 0) {
        saveNotesToLocal(notes).catch((err: unknown) =>
          console.warn("Sync to local DB failed:", err),
        );
      }

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
    await api.delete(`${ENDPOINTS.LIBRARY.GET_NOTE}/${id}`);

    // 成功后删除本地
    deleteNoteLocally(id).catch((err: unknown) =>
      console.warn("Delete local failed:", err),
    );
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
