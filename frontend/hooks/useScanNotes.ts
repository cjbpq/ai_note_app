import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert } from "react-native";
import i18n from "../i18n";
import { noteService } from "../services/noteService";
import { useScanStore } from "../store/useScanStore";

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

  // 1. 核心流程：上传 -> 轮询 -> 获取结果
  const scanMutation = useMutation({
    mutationFn: async (imageUri: string) => {
      // Step A: 更新 Store 状态为上传中
      startScan();

      try {
        // Step B: 上传图片
        console.log("Hooks: Starting upload...");
        const uploadRes = await noteService.uploadImageNote(imageUri);

        // Step C: 状态转为处理中
        setScanStep("processing");
        console.log("Hooks: Upload done, Job ID:", uploadRes.job_id);

        // Step D: 轮询等待结果
        const noteId = await noteService.waitForJobCompletion(uploadRes.job_id);

        return noteId;
      } catch (error: any) {
        throw error;
      }
    },
    onSuccess: (noteId) => {
      // Step E: 流程完成，更新 Store
      setScannedResult(noteId);

      // 关键：因为后端已经对应生成了 Note，我们需要刷新此时的笔记列表缓存
      queryClient.invalidateQueries({ queryKey: ["notes"] });

      // 可以在这里自动跳转，或者让 UI 监听 scanStep === 'finished' 来跳转
      // 推荐：让 UI 层决定跳转，Hook 只负责逻辑
    },
    onError: (error: any) => {
      console.error("Scan failed:", error);
      setScanError(error.message || i18n.t("errors.scan_failed"));
      Alert.alert(i18n.t("common.error"), i18n.t("errors.scan_failed"));
    },
  });

  // 2. 辅助方法：处理从扫描结果 -> 确认保存 (如果需要二次确认)
  // 如果后端自动保存，这个步骤可能是 "编辑并更新"
  const confirmNoteMutation = useMutation({
    mutationFn: async ({
      id,
      ...changes
    }: { id: string } & Partial<import("../types").Note>) => {
      // 实际上是调用 updateNote
      return noteService.updateNote(id, changes);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      resetScan(); // 确认保存后，重置扫描状态
    },
  });

  return {
    // 动作
    scanImage: scanMutation.mutate,
    confirmScanResult: confirmNoteMutation.mutate,
    resetScan,

    // 状态 (来自 Store + React Query)
    isScanning,
    scanStep,
    scanError,
    scannedNoteId,
  };
};
