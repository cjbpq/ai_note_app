import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert } from "react-native";
import i18n from "../i18n";
import { noteService } from "../services/noteService";
import { useScanStore } from "../store/useScanStore";
import { Note } from "../types";

/**
 * useScanNotes Hook
 *
 * 职责：管理图片扫描 -> 笔记生成 -> 保存的完整流程
 *
 * 数据流向说明：
 * ┌─────────────────────────────────────────────────────────────┐
 * │ 1. scanImage(uri)  → 上传图片到后端 → 后端生成笔记并保存    │
 * │ 2. 轮询等待        → 获取 note_id → Store 保存 scannedNoteId │
 * │ 3. confirmAndSave(note) → 同步到本地 SQLite → 刷新列表缓存  │
 * └─────────────────────────────────────────────────────────────┘
 *
 * SQLite 在本流程中的角色：
 * - 作为离线缓存 (Cache)，不是数据源 (Source of Truth)
 * - 后端才是数据的主要来源
 * - 保存按钮触发 confirmAndSave 时会同步到本地 SQLite
 */
export const useScanNotes = () => {
  const queryClient = useQueryClient();

  // 引入 Zustand Store 管理跨页面的扫描状态
  const {
    startScan,
    setScanStep,
    setScanError,
    setScannedResult,
    resetScan,
    // 导出状态供 UI 使用
    isScanning,
    scanStep,
    scanError,
    scannedNoteId,
  } = useScanStore();

  // =========================================================================
  // 1. 核心流程：上传 -> 轮询 -> 获取结果
  // =========================================================================
  const scanMutation = useMutation({
    mutationFn: async (imageUri: string) => {
      // Step A: 更新 Store 状态为上传中
      startScan();

      try {
        // Step B: 上传图片到后端
        console.log("[useScanNotes] Starting upload...");
        const uploadRes = await noteService.uploadImageNote(imageUri);

        // Step C: 状态转为处理中
        setScanStep("processing");
        console.log("[useScanNotes] Upload done, Job ID:", uploadRes.job_id);

        // Step D: 轮询等待后端处理完成
        const noteId = await noteService.waitForJobCompletion(uploadRes.job_id);

        return noteId;
      } catch (error: unknown) {
        throw error;
      }
    },
    onSuccess: (noteId) => {
      // Step E: 流程完成，更新 Store 中的 scannedNoteId
      // 此时后端已经保存了笔记，但本地 SQLite 尚未同步
      setScannedResult(noteId);
      console.log("[useScanNotes] Scan completed, noteId:", noteId);

      // 注意：这里不立即 invalidateQueries
      // 等用户点击"保存"按钮后，由 confirmAndSave 统一处理
    },
    onError: (error: Error) => {
      console.error("[useScanNotes] Scan failed:", error);
      setScanError(error.message || i18n.t("errors.scan_failed"));
      Alert.alert(i18n.t("common.error"), i18n.t("errors.scan_failed"));
    },
  });

  // =========================================================================
  // 2. 确认保存：将扫描结果同步到本地缓存并刷新列表
  // =========================================================================
  const confirmSaveMutation = useMutation({
    mutationFn: async (note: Note) => {
      // 调用 Service 层的 syncNoteToLocal 方法，将笔记同步到 SQLite
      // 这里不需要再请求后端，因为后端在扫描完成时已经保存了
      await noteService.syncNoteToLocal(note);
      return note;
    },
    onSuccess: () => {
      console.log(
        "[useScanNotes] Note saved to local cache, refreshing list...",
      );

      // 关键：刷新笔记列表缓存，让 read 界面能看到新笔记
      queryClient.invalidateQueries({ queryKey: ["notes"] });

      // 同时使单条笔记缓存失效，确保下次读取时获取最新数据
      queryClient.invalidateQueries({ queryKey: ["note"] });

      // 重置扫描状态，关闭 Modal
      resetScan();
    },
    onError: (error: Error) => {
      console.error("[useScanNotes] Failed to save note:", error);
      Alert.alert(i18n.t("common.error"), i18n.t("errors.save_failed"));
    },
  });

  // =========================================================================
  // 3. 辅助方法：编辑并更新已有笔记 (用于用户修改扫描结果后保存)
  // =========================================================================
  const updateNoteMutation = useMutation({
    mutationFn: async ({ id, ...changes }: { id: string } & Partial<Note>) => {
      // 调用 updateNote 更新后端和本地
      return noteService.updateNote(id, changes);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      resetScan();
    },
  });

  return {
    // ===== 动作方法 =====
    scanImage: scanMutation.mutate, // 触发扫描上传
    confirmAndSave: confirmSaveMutation.mutate, // 确认保存到本地
    updateScannedNote: updateNoteMutation.mutate, // 编辑后更新
    resetScan, // 重置状态 (不保存直接取消)

    // ===== 状态 (来自 Zustand Store) =====
    isScanning, // 是否正在扫描中
    scanStep, // 当前步骤: idle | uploading | processing | finished | error
    scanError, // 错误信息
    scannedNoteId, // 扫描完成后获得的 noteId

    // ===== Mutation 状态 =====
    isSaving: confirmSaveMutation.isPending, // 是否正在保存
  };
};
