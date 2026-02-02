import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { noteService } from "../services/noteService";

export const useNotes = () => {
  const queryClient = useQueryClient();

  // 1. 获取笔记列表 (Read)
  const notesQuery = useQuery({
    queryKey: ["notes"],
    queryFn: noteService.fetchNotes,
    staleTime: 1000 * 60 * 5, // 5分钟内数据视为新鲜
  });

  // 1.5 获取单条笔记 (Read Single)
  const useNote = (id: string | null) => {
    return useQuery({
      queryKey: ["note", id],
      queryFn: () => noteService.getNoteById(id!),
      enabled: !!id, // 只有当 id 存在时才请求
      staleTime: 1000 * 60 * 5,
    });
  };

  // 2. 添加笔记 (Create)
  const addNoteMutation = useMutation({
    mutationFn: noteService.createNote,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
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
      queryClient.invalidateQueries({ queryKey: ["notes"] });
    },
  });

  // 4. 删除笔记 (Delete)
  const deleteNoteMutation = useMutation({
    mutationFn: noteService.deleteNote,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
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
  };
};
