import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import i18next from "../i18n";
import { chatService } from "../services/chatService";
import { useAuthStore } from "../store/useAuthStore";
import { ChatConversationDetailResponse, ServiceError } from "../types";
import { useToast } from "./useToast";

const CHAT_CONVERSATIONS_QUERY_KEY = ["chat", "conversations"] as const;

export const useChatConversations = () => {
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useToast();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const userId = useAuthStore((state) => state.user?.id) ?? "anonymous";
  const conversationsKey = [...CHAT_CONVERSATIONS_QUERY_KEY, userId] as const;

  const conversationsQuery = useQuery({
    queryKey: conversationsKey,
    queryFn: () => chatService.listConversations({ limit: 50 }),
    enabled: isAuthenticated,
    staleTime: 1000 * 30,
  });

  const loadConversationMutation = useMutation({
    mutationFn: chatService.getConversationDetail,
    onError: (error) => {
      showError(
        error instanceof ServiceError
          ? error.message
          : i18next.t("error.chat.conversationLoadFailed"),
      );
    },
  });

  const deleteConversationMutation = useMutation({
    mutationFn: chatService.deleteConversation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: conversationsKey });
      showSuccess(i18next.t("chat.session_deleted"));
    },
    onError: (error) => {
      showError(
        error instanceof ServiceError
          ? error.message
          : i18next.t("error.chat.conversationDeleteFailed"),
      );
    },
  });

  const batchDeleteMutation = useMutation({
    mutationFn: chatService.batchDeleteConversations,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: conversationsKey });
      showSuccess(i18next.t("chat.sessions_deleted"));
    },
    onError: (error) => {
      showError(
        error instanceof ServiceError
          ? error.message
          : i18next.t("error.chat.conversationDeleteFailed"),
      );
    },
  });

  return {
    conversations: conversationsQuery.data?.conversations ?? [],
    total: conversationsQuery.data?.total ?? 0,
    isLoading: conversationsQuery.isLoading,
    isRefreshing: conversationsQuery.isFetching,
    error: conversationsQuery.error,
    refetch: conversationsQuery.refetch,
    loadConversation: loadConversationMutation.mutateAsync,
    loadedConversation:
      loadConversationMutation.data as ChatConversationDetailResponse | undefined,
    isLoadingConversation: loadConversationMutation.isPending,
    deleteConversation: deleteConversationMutation.mutateAsync,
    isDeletingConversation: deleteConversationMutation.isPending,
    batchDeleteConversations: batchDeleteMutation.mutateAsync,
    isBatchDeleting: batchDeleteMutation.isPending,
    invalidateConversations: () =>
      queryClient.invalidateQueries({ queryKey: conversationsKey }),
  };
};

