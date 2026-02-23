/**
 * 笔记编辑状态管理 Store
 *
 * 职责：
 * 1. 管理笔记编辑模式的状态（是否编辑中、表单数据）
 * 2. 草稿自动保存到 AsyncStorage
 * 3. 提供编辑状态的初始化、重置、更新操作
 *
 * 设计说明：
 * - 使用 Zustand 管理纯客户端状态
 * - 与 React Query 管理的服务端状态分离
 * - 草稿保存到 AsyncStorage，支持离开后恢复
 * - formData 支持结构化字段（summary / keyPoints），保存时可构造 structuredData 更新
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

// ========== 常量配置 ==========
/** AsyncStorage 中草稿的 key 前缀 */
const DRAFT_STORAGE_KEY_PREFIX = "note_draft_";

// ========== 类型定义 ==========

/**
 * 编辑表单数据（扩展版，支持结构化字段编辑）
 *
 * 字段说明：
 * - title: 笔记标题（可编辑）
 * - category: 分类（可编辑，自由文本）
 * - tags: 标签数组（Chip 形式增删）
 * - summary: AI 摘要（可编辑多行文本）
 * - keyPoints: 知识要点数组（逐条增删编辑）
 * - content: 已废弃，保留空串以兼容草稿恢复
 */
export interface NoteEditFormData {
  title: string;
  category: string;
  tags: string[];
  summary: string;
  keyPoints: string[];
  /** @deprecated 保留以兼容旧草稿恢复，新编辑流程不再使用 */
  content: string;
}

/**
 * 草稿数据（包含元信息）
 */
interface DraftData extends NoteEditFormData {
  savedAt: number; // 保存时间戳
}

/**
 * 编辑状态 Store 的完整类型
 */
interface NoteEditState {
  // ===== 状态 =====
  /** 当前正在编辑的笔记 ID，null 表示未在编辑任何笔记 */
  editingNoteId: string | null;
  /** 是否处于编辑模式 */
  isEditing: boolean;
  /** 编辑表单数据 */
  formData: NoteEditFormData;
  /** 是否有未保存的更改（用于离开提示） */
  hasUnsavedChanges: boolean;

  // ===== 基础操作 =====
  /** 进入编辑模式 */
  startEditing: (noteId: string, initialData: NoteEditFormData) => void;
  /** 更新表单的文本字段（title / category / summary / content） */
  updateField: <K extends keyof NoteEditFormData>(
    field: K,
    value: NoteEditFormData[K],
  ) => void;
  /** 取消编辑，重置为初始数据，并清除草稿 */
  cancelEditing: (initialData?: NoteEditFormData) => void;
  /** 完成编辑（保存成功后调用），并清除草稿 */
  finishEditing: () => void;

  // ===== 标签操作 =====
  /** 添加标签 */
  addTag: (tag: string) => void;
  /** 移除标签 */
  removeTag: (tag: string) => void;

  // ===== 知识要点操作 =====
  /** 添加一条要点 */
  addKeyPoint: (point: string) => void;
  /** 移除指定索引的要点 */
  removeKeyPoint: (index: number) => void;
  /** 更新指定索引的要点文本 */
  updateKeyPoint: (index: number, text: string) => void;

  // ===== 草稿操作 =====
  /** 离开页面时保存草稿（如果有未保存更改） */
  saveDraftAndClear: () => Promise<void>;
  /** 检查是否存在草稿 */
  checkDraft: (noteId: string) => Promise<DraftData | null>;
  /** 从草稿恢复编辑状态 */
  restoreFromDraft: (noteId: string, draft: DraftData) => void;
  /** 清除指定笔记的草稿 */
  clearDraft: (noteId: string) => Promise<void>;

  // ===== 兼容方法 =====
  /** 获取标签数组（直接返回 tags，向后兼容） */
  getTagsArray: () => string[];
}

// ========== 初始状态 ==========
const initialFormData: NoteEditFormData = {
  title: "",
  category: "",
  tags: [],
  summary: "",
  keyPoints: [],
  content: "",
};

// ========== 辅助函数 ==========
/** 生成草稿存储的 key */
const getDraftKey = (noteId: string) => `${DRAFT_STORAGE_KEY_PREFIX}${noteId}`;

/**
 * 兼容旧草稿格式（tags 可能是逗号分隔字符串）
 * 确保恢复后 formData 是新格式
 */
const normalizeDraftData = (raw: Record<string, unknown>): DraftData => {
  const title = (raw.title as string) ?? "";
  const category = (raw.category as string) ?? "";
  const summary = (raw.summary as string) ?? "";
  const content = (raw.content as string) ?? "";
  const savedAt = (raw.savedAt as number) ?? Date.now();

  // tags 兼容：旧格式为逗号分隔字符串，新格式为数组
  let tags: string[] = [];
  if (Array.isArray(raw.tags)) {
    tags = raw.tags as string[];
  } else if (typeof raw.tags === "string") {
    tags = (raw.tags as string)
      .split(",")
      .map((t: string) => t.trim())
      .filter((t: string) => t.length > 0);
  }

  // keyPoints 兼容：旧草稿可能没有此字段
  let keyPoints: string[] = [];
  if (Array.isArray(raw.keyPoints)) {
    keyPoints = raw.keyPoints as string[];
  }

  return { title, category, tags, summary, keyPoints, content, savedAt };
};

// ========== Store 实现 ==========
export const useNoteEditStore = create<NoteEditState>((set, get) => ({
  // 初始状态
  editingNoteId: null,
  isEditing: false,
  formData: { ...initialFormData },
  hasUnsavedChanges: false,

  // ===== 基础操作 =====

  // 进入编辑模式
  startEditing: (noteId, initialData) => {
    set({
      editingNoteId: noteId,
      isEditing: true,
      formData: { ...initialData },
      hasUnsavedChanges: false,
    });
  },

  // 更新表单字段（通用）
  updateField: (field, value) => {
    set((state) => ({
      formData: {
        ...state.formData,
        [field]: value,
      },
      hasUnsavedChanges: true,
    }));
  },

  // 取消编辑并清除草稿
  cancelEditing: (initialData) => {
    const { editingNoteId } = get();
    if (editingNoteId) {
      AsyncStorage.removeItem(getDraftKey(editingNoteId)).catch(() => {});
    }
    set({
      isEditing: false,
      formData: initialData ? { ...initialData } : { ...initialFormData },
      hasUnsavedChanges: false,
    });
  },

  // 完成编辑并清除草稿
  finishEditing: () => {
    const { editingNoteId } = get();
    if (editingNoteId) {
      AsyncStorage.removeItem(getDraftKey(editingNoteId)).catch(() => {});
    }
    set({
      isEditing: false,
      editingNoteId: null,
      hasUnsavedChanges: false,
    });
  },

  // ===== 标签操作 =====

  addTag: (tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed) return;
    set((state) => {
      // 去重：忽略已存在的标签
      if (state.formData.tags.includes(trimmed)) return state;
      return {
        formData: {
          ...state.formData,
          tags: [...state.formData.tags, trimmed],
        },
        hasUnsavedChanges: true,
      };
    });
  },

  removeTag: (tag: string) => {
    set((state) => ({
      formData: {
        ...state.formData,
        tags: state.formData.tags.filter((t) => t !== tag),
      },
      hasUnsavedChanges: true,
    }));
  },

  // ===== 知识要点操作 =====

  addKeyPoint: (point: string) => {
    const trimmed = point.trim();
    if (!trimmed) return;
    set((state) => ({
      formData: {
        ...state.formData,
        keyPoints: [...state.formData.keyPoints, trimmed],
      },
      hasUnsavedChanges: true,
    }));
  },

  removeKeyPoint: (index: number) => {
    set((state) => ({
      formData: {
        ...state.formData,
        keyPoints: state.formData.keyPoints.filter((_, i) => i !== index),
      },
      hasUnsavedChanges: true,
    }));
  },

  updateKeyPoint: (index: number, text: string) => {
    set((state) => {
      const newPoints = [...state.formData.keyPoints];
      if (index >= 0 && index < newPoints.length) {
        newPoints[index] = text;
      }
      return {
        formData: {
          ...state.formData,
          keyPoints: newPoints,
        },
        hasUnsavedChanges: true,
      };
    });
  },

  // ===== 草稿操作 =====

  saveDraftAndClear: async () => {
    const { editingNoteId, formData, hasUnsavedChanges } = get();

    if (editingNoteId && hasUnsavedChanges) {
      const draftData: DraftData = {
        ...formData,
        savedAt: Date.now(),
      };
      try {
        await AsyncStorage.setItem(
          getDraftKey(editingNoteId),
          JSON.stringify(draftData),
        );
      } catch {
        // 静默失败，不影响用户体验
      }
    }

    set({
      editingNoteId: null,
      isEditing: false,
      formData: { ...initialFormData },
      hasUnsavedChanges: false,
    });
  },

  checkDraft: async (noteId: string): Promise<DraftData | null> => {
    try {
      const draftJson = await AsyncStorage.getItem(getDraftKey(noteId));
      if (draftJson) {
        const raw = JSON.parse(draftJson) as Record<string, unknown>;
        return normalizeDraftData(raw);
      }
    } catch {
      // 解析失败，返回 null
    }
    return null;
  },

  restoreFromDraft: (noteId: string, draft: DraftData) => {
    set({
      editingNoteId: noteId,
      isEditing: true,
      formData: {
        title: draft.title ?? "",
        category: draft.category ?? "",
        tags: Array.isArray(draft.tags) ? draft.tags : [],
        summary: draft.summary ?? "",
        keyPoints: Array.isArray(draft.keyPoints) ? draft.keyPoints : [],
        content: draft.content ?? "",
      },
      hasUnsavedChanges: true,
    });
  },

  clearDraft: async (noteId: string) => {
    try {
      await AsyncStorage.removeItem(getDraftKey(noteId));
    } catch {
      // 静默失败
    }
  },

  // ===== 兼容方法 =====

  getTagsArray: () => {
    return get().formData.tags;
  },
}));
