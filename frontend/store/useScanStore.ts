import { create } from "zustand";

/**
 * ScanStore - 图片选取状态管理
 *
 * 职责：
 *   管理用户当前选中的图片 URI 列表（拍照/相册选取后的临时状态）。
 *   支持多图选取：相册多选一次添加多张，拍照逐张追加。
 *   上传任务状态已迁移至 useUploadTaskStore。
 *
 * 消费者：
 *   - useImagePicker: 写入 pickedImageUris
 *   - HomeScreen (index.tsx): 读取 pickedImageUris 做预览
 */

interface ScanState {
  /** 用户选中的图片本地 URI 列表（空数组表示未选取） */
  pickedImageUris: string[];

  /** 追加新的图片 URI（拍照单张追加 / 相册多选批量追加） */
  addPickedImageUris: (uris: string[]) => void;

  /** 移除指定索引的图片（用户点击删除某张预览） */
  removePickedImageAt: (index: number) => void;

  /** 清空所有已选图片 */
  clearPickedImages: () => void;

  // ── 兼容旧字段（方便迁移期获取单张，等同 pickedImageUris[0]） ──
  /** @deprecated 请使用 pickedImageUris */
  pickedImageUri: string | null;
  /** @deprecated 请使用 addPickedImageUris */
  setPickedImageUri: (uri: string | null) => void;

  // === 兼容旧接口（useScanNotes 尚未完全删除时保留） ===
  isScanning: boolean;
  scanStep: "idle" | "uploading" | "processing" | "finished" | "error";
  scanError: string | null;
  scannedNoteId: string | null;
  startScan: () => void;
  setScanStep: (step: ScanState["scanStep"]) => void;
  setScanError: (error: string) => void;
  setScannedResult: (noteId: string) => void;
  resetScan: () => void;
}

export const useScanStore = create<ScanState>((set, get) => ({
  pickedImageUris: [],

  addPickedImageUris: (uris) =>
    set((state) => {
      const next = [...state.pickedImageUris, ...uris];
      return {
        pickedImageUris: next,
        pickedImageUri: next[0] ?? null, // 保持兼容字段同步
      };
    }),

  removePickedImageAt: (index) =>
    set((state) => {
      const next = state.pickedImageUris.filter((_, i) => i !== index);
      return {
        pickedImageUris: next,
        pickedImageUri: next[0] ?? null,
      };
    }),

  clearPickedImages: () => set({ pickedImageUris: [], pickedImageUri: null }),

  // ── 兼容旧单张接口 ──
  pickedImageUri: null,
  setPickedImageUri: (uri) =>
    set({
      pickedImageUri: uri,
      pickedImageUris: uri ? [uri] : [],
    }),

  // === 兼容旧接口（MOCK/旧 Hook 仍引用，安全保留） ===
  isScanning: false,
  scanStep: "idle",
  scanError: null,
  scannedNoteId: null,
  startScan: () =>
    set({
      isScanning: true,
      scanStep: "uploading",
      scanError: null,
      scannedNoteId: null,
    }),
  setScanStep: (step) => set({ scanStep: step }),
  setScanError: (error) =>
    set({ scanError: error, scanStep: "error", isScanning: false }),
  setScannedResult: (noteId) =>
    set({ scannedNoteId: noteId, scanStep: "finished", isScanning: false }),
  resetScan: () =>
    set({
      isScanning: false,
      scanStep: "idle",
      scanError: null,
      pickedImageUri: null,
      pickedImageUris: [],
      scannedNoteId: null,
    }),
}));
