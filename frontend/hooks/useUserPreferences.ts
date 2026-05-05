import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import i18next from "../i18n";
import { authService } from "../services/authService";
import { useAuthStore } from "../store/useAuthStore";
import { ServiceError, UserPreferencesResponse } from "../types";
import { useToast } from "./useToast";

const USER_PREFERENCES_QUERY_KEY = ["auth", "preferences"] as const;

export const useUserPreferences = () => {
  const queryClient = useQueryClient();
  const { showError } = useToast();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const userId = useAuthStore((state) => state.user?.id) ?? "anonymous";
  const preferencesKey = [...USER_PREFERENCES_QUERY_KEY, userId] as const;

  const preferencesQuery = useQuery({
    queryKey: preferencesKey,
    queryFn: authService.getPreferences,
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 5,
  });

  const updatePreferencesMutation = useMutation({
    mutationFn: authService.updatePreferences,
    onMutate: async (nextPreferences) => {
      await queryClient.cancelQueries({ queryKey: preferencesKey });
      const previousPreferences =
        queryClient.getQueryData<UserPreferencesResponse>(preferencesKey);

      queryClient.setQueryData<UserPreferencesResponse>(preferencesKey, {
        chat_thinking_enabled: nextPreferences.chat_thinking_enabled,
      });

      return { previousPreferences };
    },
    onError: (error, _nextPreferences, context) => {
      if (context?.previousPreferences) {
        queryClient.setQueryData(preferencesKey, context.previousPreferences);
      }

      showError(
        error instanceof ServiceError
          ? error.message
          : i18next.t("error.auth.preferencesUpdateFailed"),
      );
    },
    onSuccess: (preferences) => {
      queryClient.setQueryData(preferencesKey, preferences);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: preferencesKey });
    },
  });

  const setChatThinkingEnabled = (enabled: boolean) => {
    updatePreferencesMutation.mutate({ chat_thinking_enabled: enabled });
  };

  return {
    chatThinkingEnabled:
      preferencesQuery.data?.chat_thinking_enabled ?? false,
    isLoadingPreferences: preferencesQuery.isLoading,
    isUpdatingPreferences: updatePreferencesMutation.isPending,
    setChatThinkingEnabled,
  };
};
