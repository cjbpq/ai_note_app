import { Platform } from "react-native";
import { APP_CONFIG, ENDPOINTS } from "../constants/config";
import i18next from "../i18n";
import { JobStatusResponse, Note, UploadResponse } from "../types";
import api from "./api";
import {
  deleteNoteLocally,
  fetchLocalNotes,
  saveNoteLocally,
  saveNotesToLocal,
} from "./database";

// ============================================================================
// Mock Data
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
  // 模拟 AI 生成的笔记
  {
    id: "note-ai-generated",
    title: "AI Recognition Result",
    content: "This is the content generated from image recognition...",
    date: new Date().toISOString(),
    tags: ["AI", "Image"],
    structuredData: {
      summary: "Image contains...",
      keyPoints: ["Point 1", "Point 2"],
    },
  },
];

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
    } catch (e) {
      return undefined;
    }
  },

  /**
   * 上传图片 Note (Mock 模式)
   */
  fetchNotes: async (): Promise<Note[]> => {
    if (USE_MOCK) {
      console.log("[Mock API] fetchNotes called");
      await new Promise((resolve) => setTimeout(resolve, 800));
      return MOCK_NOTES;
    }

    try {
      // 优先从网络获取
      const response = await api.get<Note[]>(ENDPOINTS.LIBRARY.GET_NOTE);
      const notes = response as unknown as Note[];

      // 如果网络请求成功，缓存到本地数据库 (Cache Aside Pattern)
      if (notes && Array.isArray(notes)) {
        saveNotesToLocal(notes).catch((err: any) =>
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
    const response = await api.get<Note>(
      `${ENDPOINTS.LIBRARY.GET_NOTE}/${noteId}`,
    );
    const note = response as unknown as Note;

    // 获取单条详情成功后，也更新本地缓存，确保离线可用
    saveNoteLocally(note).catch((err: any) =>
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
      return {
        ...newNote,
        id: Math.random().toString(36).substr(2, 9),
        date: new Date().toISOString(),
      };
    }

    const response = await api.post<Note>(ENDPOINTS.LIBRARY.GET_NOTE, newNote);
    const createdNote = response as unknown as Note;

    // 成功后同步保存到本地
    saveNoteLocally(createdNote).catch((err: any) =>
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
      return;
    }
    await api.delete(`${ENDPOINTS.LIBRARY.GET_NOTE}/${id}`);

    // 成功后删除本地
    deleteNoteLocally(id).catch((err: any) =>
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
      const existing = MOCK_NOTES.find((n) => n.id === id);
      if (existing) {
        return { ...existing, ...updatedNote };
      }
      throw new Error("Note not found in mock");
    }
    const response = await api.put<Note>(
      `${ENDPOINTS.LIBRARY.GET_NOTE}/${id}`,
      updatedNote,
    );
    const finalNote = response as unknown as Note;

    // 成功后更新本地
    saveNoteLocally(finalNote).catch((err: any) =>
      console.warn("Update local failed:", err),
    );

    return finalNote;
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
      if (random > 0.7) {
        return { status: "completed", note_id: "note-ai-generated" };
      } else if (random > 0.4) {
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
