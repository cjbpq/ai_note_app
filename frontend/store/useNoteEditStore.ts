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
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

// ========== 常量配置 ==========
/** AsyncStorage 中草稿的 key 前缀 */
const DRAFT_STORAGE_KEY_PREFIX = "note_draft_";

// ========== 类型定义 ==========

/**
 * 编辑表单数据
 */
interface NoteEditFormData {
  title: string;
  content: string;
  tags: string; // 逗号分隔的标签字符串，便于用户输入
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

  // ===== 操作方法 =====
  /**
   * 进入编辑模式
   * @param noteId - 笔记ID
   * @param initialData - 初始表单数据（来自笔记原始数据）
   */
  startEditing: (noteId: string, initialData: NoteEditFormData) => void;

  /**
   * 更新表单字段
   * @param field - 字段名
   * @param value - 新值
   */
  updateField: <K extends keyof NoteEditFormData>(
    field: K,
    value: NoteEditFormData[K],
  ) => void;

  /**
   * 取消编辑，重置为初始数据，并清除草稿
   * @param initialData - 原始数据（可选，用于重置表单）
   */
  cancelEditing: (initialData?: NoteEditFormData) => void;

  /**
   * 完成编辑（保存成功后调用），并清除草稿
   */
  finishEditing: () => void;

  /**
   * 离开页面时保存草稿（如果有未保存更改）
   */
  saveDraftAndClear: () => Promise<void>;

  /**
   * 检查是否存在草稿
   * @param noteId - 笔记ID
   * @returns 草稿数据或 null
   */
  checkDraft: (noteId: string) => Promise<DraftData | null>;

  /**
   * 从草稿恢复编辑状态
   * @param noteId - 笔记ID
   * @param draft - 草稿数据
   */
  restoreFromDraft: (noteId: string, draft: DraftData) => void;

  /**
   * 清除指定笔记的草稿
   * @param noteId - 笔记ID
   */
  clearDraft: (noteId: string) => Promise<void>;

  /**
   * 获取标签数组（将逗号分隔的字符串转为数组）
   */
  getTagsArray: () => string[];
}

// ========== 初始状态 ==========
const initialFormData: NoteEditFormData = {
  title: "",
  content: "",
  tags: "",
};

// ========== 辅助函数 ==========
/**
 * 生成草稿存储的 key
 */
const getDraftKey = (noteId: string) => `${DRAFT_STORAGE_KEY_PREFIX}${noteId}`;

// ========== Store 实现 ==========
export const useNoteEditStore = create<NoteEditState>((set, get) => ({
  // 初始状态
  editingNoteId: null,
  isEditing: false,
  formData: { ...initialFormData },
  hasUnsavedChanges: false,

  // 进入编辑模式
  startEditing: (noteId, initialData) => {
    set({
      editingNoteId: noteId,
      isEditing: true,
      formData: { ...initialData },
      hasUnsavedChanges: false,
    });
  },

  // 更新表单字段
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
    // 清除草稿
    if (editingNoteId) {
      AsyncStorage.removeItem(getDraftKey(editingNoteId)).catch(() => {
        // 静默失败，不影响用户体验
      });
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
    // 保存成功后清除草稿
    if (editingNoteId) {
      AsyncStorage.removeItem(getDraftKey(editingNoteId)).catch(() => {
        // 静默失败
      });
    }
    set({
      isEditing: false,
      editingNoteId: null,
      hasUnsavedChanges: false,
    });
  },

  // 离开页面时保存草稿
  saveDraftAndClear: async () => {
    const { editingNoteId, formData, hasUnsavedChanges } = get();

    // 只有在有未保存更改时才保存草稿
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

    // 清除内存状态
    set({
      editingNoteId: null,
      isEditing: false,
      formData: { ...initialFormData },
      hasUnsavedChanges: false,
    });
  },

  // 检查是否存在草稿
  checkDraft: async (noteId: string): Promise<DraftData | null> => {
    try {
      const draftJson = await AsyncStorage.getItem(getDraftKey(noteId));
      if (draftJson) {
        return JSON.parse(draftJson) as DraftData;
      }
    } catch {
      // 解析失败，返回 null
    }
    return null;
  },

  // 从草稿恢复
  restoreFromDraft: (noteId: string, draft: DraftData) => {
    set({
      editingNoteId: noteId,
      isEditing: true,
      formData: {
        title: draft.title,
        content: draft.content,
        tags: draft.tags,
      },
      hasUnsavedChanges: true, // 恢复后视为有更改
    });
  },

  // 清除指定笔记的草稿
  clearDraft: async (noteId: string) => {
    try {
      await AsyncStorage.removeItem(getDraftKey(noteId));
    } catch {
      // 静默失败
    }
  },

  // 获取标签数组
  getTagsArray: () => {
    const { tags } = get().formData;
    return tags
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
  },
}));
