import { create } from "zustand";

interface ScanState {
  isScanning: boolean;
  scanStep: "idle" | "uploading" | "processing" | "finished" | "error";
  scanError: string | null;
  // 选中的原始图片 URI
  pickedImageUri: string | null;
  // AI 处理完后返回的临时 noteId (如果是后端直接生成) 或者 文本结果
  scannedNoteId: string | null;

  startScan: () => void;
  setPickedImageUri: (uri: string | null) => void;
  setScanStep: (step: ScanState["scanStep"]) => void;
  setScanError: (error: string) => void;
  setScannedResult: (noteId: string) => void;
  resetScan: () => void;
}

export const useScanStore = create<ScanState>((set) => ({
  isScanning: false,
  scanStep: "idle",
  scanError: null,
  pickedImageUri: null,
  scannedNoteId: null,

  startScan: () =>
    set({
      isScanning: true,
      scanStep: "uploading",
      scanError: null,
      scannedNoteId: null,
    }),
  setPickedImageUri: (uri) => set({ pickedImageUri: uri }),
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
      scannedNoteId: null,
    }),
}));
