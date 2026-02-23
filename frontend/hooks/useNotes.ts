import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import i18next from "../i18n";
import { noteService } from "../services/noteService";
import { useAuthStore } from "../store/useAuthStore";
import { Note, ServiceError } from "../types";
import { useToast } from "./useToast";

export const useNotes = () => {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const userId = useAuthStore((state) => state.user?.id) ?? "anonymous";

  // 关键：QueryKey 必须包含 userId，避免切换账号后复用旧缓存
  const notesKey = ["notes", userId] as const;
  const noteKey = (id: string | null) => ["note", userId, id] as const;

  // 1. 获取笔记列表 (Read)
  const notesQuery = useQuery({
    queryKey: notesKey,
    queryFn: noteService.fetchNotes,
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 5, // 5分钟内数据视为新鲜
  });

  useEffect(() => {
    if (!notesQuery.error) return;
    const errorMessage =
      notesQuery.error instanceof ServiceError
        ? notesQuery.error.message
        : i18next.t("error.note.fetchFailed");
    showError(errorMessage);
  }, [notesQuery.error, showError]);

  // 1.5 获取单条笔记 (Read Single)
  const useNote = (id: string | null) => {
    return useQuery({
      queryKey: noteKey(id),
      queryFn: () => noteService.getNoteById(id!),
      enabled: isAuthenticated && !!id, // 只有当已登录且 id 存在时才请求
      staleTime: 1000 * 60 * 5,
    });
  };

  // 2. 添加笔记 (Create)
  const addNoteMutation = useMutation({
    mutationFn: noteService.createNote,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notesKey });
    },
  });

  // 3. 更新笔记 (Update)
  const updateNoteMutation = useMutation({
    mutationFn: ({
      id,
      ...data
    }: { id: string } & Partial<import("../types").Note>) =>
      noteService.updateNote(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notesKey });
    },
  });

  // 4. 删除笔记 (Delete)
  const deleteNoteMutation = useMutation({
    mutationFn: noteService.deleteNote,
    onSuccess: (_, id) => {
      /**
       * 重要：这里不要立刻 removeQueries(noteKey)
       *
       * 原因：详情页在删除成功后通常会立刻触发 router.back()。
       * 如果此时把当前正在被详情页观察的 note Query 直接 remove 掉，
       * React Query 会让详情页瞬间进入“无数据/重新请求”的渲染路径，
       * 在 Android 的 native-stack (react-native-screens) 返回动画期间，
       * 可能触发 Fragment/HeaderConfig 的竞态，从而抛出 java.lang.IllegalStateException。
       *
       * 处理：仅刷新列表缓存即可；单条详情缓存留给导航卸载后自然回收。
       */
      queryClient.invalidateQueries({ queryKey: notesKey });
      showSuccess(i18next.t("toast.delete_success"));
    },
    onError: (error) => {
      showError(
        error instanceof ServiceError
          ? error.message
          : i18next.t("error.note.deleteFailed"),
      );
    },
  });

  // 5. 切换收藏状态 (Favorite)
  const toggleFavoriteMutation = useMutation({
    mutationFn: (id: string) => noteService.toggleFavorite(id),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: noteKey(id) });
      await queryClient.cancelQueries({ queryKey: notesKey });

      const previousNote = queryClient.getQueryData<Note>(noteKey(id));
      const previousNotes = queryClient.getQueryData<Note[]>(notesKey);

      const toggleFlag = (isFav?: boolean) => !(isFav ?? false);

      if (previousNote) {
        queryClient.setQueryData<Note>(noteKey(id), {
          ...previousNote,
          isFavorite: toggleFlag(previousNote.isFavorite),
        });
      }

      if (previousNotes) {
        queryClient.setQueryData<Note[]>(notesKey, (old) => {
          if (!old) return old;
          return old.map((item) =>
            item.id === id
              ? { ...item, isFavorite: toggleFlag(item.isFavorite) }
              : item,
          );
        });
      }

      return { previousNote, previousNotes };
    },
    onError: (error, id, context) => {
      if (context?.previousNote) {
        queryClient.setQueryData(noteKey(id), context.previousNote);
      }
      if (context?.previousNotes) {
        queryClient.setQueryData(notesKey, context.previousNotes);
      }
      showError(
        error instanceof ServiceError
          ? error.message
          : i18next.t("toast.favorite_failed"),
      );
    },
    onSuccess: (data) => {
      if (data) {
        queryClient.setQueryData<Note>(noteKey(data.id), data);
        queryClient.setQueryData<Note[]>(notesKey, (old) => {
          if (!old) return old;
          return old.map((item) => (item.id === data.id ? data : item));
        });
      }

      const messageKey = data?.isFavorite
        ? "toast.favorite_added"
        : "toast.favorite_removed";
      showSuccess(i18next.t(messageKey));
    },
    onSettled: (data) => {
      if (data?.id) {
        queryClient.invalidateQueries({ queryKey: noteKey(data.id) });
      }
      queryClient.invalidateQueries({ queryKey: notesKey });
    },
  });

  return {
    // 数据状态
    notes: notesQuery.data ?? [],
    isLoading: notesQuery.isLoading,
    isError: notesQuery.isError,
    error: notesQuery.error,
    refetch: notesQuery.refetch,

    // 单条笔记查询 Hook (Expose for other components)
    useNote,

    // 操作方法
    addNote: addNoteMutation.mutate,
    isAdding: addNoteMutation.isPending,

    updateNote: updateNoteMutation.mutate,
    isUpdating: updateNoteMutation.isPending,

    deleteNote: deleteNoteMutation.mutate,
    isDeleting: deleteNoteMutation.isPending,

    toggleFavorite: toggleFavoriteMutation.mutate,
    isTogglingFavorite: toggleFavoriteMutation.isPending,
  };
};
