import { AxiosError } from "axios";
import i18next from "../i18n";
import { FieldErrorMap, ServiceError, ToastType } from "../types";

interface StatusRule {
  key: string;
  toastType?: ToastType;
  actionKey?: string;
  retryable?: boolean;
}

interface ParseServiceErrorOptions {
  fallbackKey: string;
  fallbackToastType?: ToastType;
  statusMap?: Record<number, StatusRule>;
}

const VALIDATION_MESSAGE_RULES: { match: RegExp; key: string }[] = [
  { match: /field required/i, key: "error.validation.required" },
  { match: /valid email/i, key: "error.validation.email" },
  {
    match: /at least|too short|min length/i,
    key: "error.validation.minLength",
  },
  { match: /at most|too long|max length/i, key: "error.validation.maxLength" },
];

const getValidationKeyFromMessage = (message?: string): string => {
  const safeMessage = message ?? "";
  const matched = VALIDATION_MESSAGE_RULES.find((rule) =>
    rule.match.test(safeMessage),
  );
  return matched?.key ?? "error.validation.invalid";
};

const parseValidationErrors = (data: any): FieldErrorMap | undefined => {
  const details = data?.detail;
  if (!Array.isArray(details) || details.length === 0) {
    return undefined;
  }

  const fieldErrors: FieldErrorMap = {};

  details.forEach((item: any) => {
    const loc = Array.isArray(item?.loc) ? item.loc : [];
    const field = String(loc[loc.length - 1] ?? "").trim();
    const key = getValidationKeyFromMessage(item?.msg);
    if (field) {
      fieldErrors[field] = i18next.t(key);
    }
  });

  return Object.keys(fieldErrors).length > 0 ? fieldErrors : undefined;
};

const buildServiceError = (params: {
  key: string;
  toastType: ToastType;
  statusCode?: number;
  fieldErrors?: FieldErrorMap;
  actionKey?: string;
  retryable?: boolean;
}): ServiceError => {
  return new ServiceError({
    message: i18next.t(params.key),
    i18nKey: params.key,
    toastType: params.toastType,
    statusCode: params.statusCode,
    fieldErrors: params.fieldErrors,
    actionKey: params.actionKey,
    retryable: params.retryable,
  });
};

/**
 * Service 层统一错误解析入口
 * 目标：把 axios/network/422 结构统一映射为可展示错误对象
 */
export const parseServiceError = (
  error: unknown,
  options: ParseServiceErrorOptions,
): ServiceError => {
  if (error instanceof ServiceError) {
    return error;
  }

  const fallbackToastType = options.fallbackToastType ?? "error";

  if (!(error instanceof AxiosError)) {
    return buildServiceError({
      key: options.fallbackKey,
      toastType: fallbackToastType,
    });
  }

  // 超时优先判断
  if (error.code === "ECONNABORTED") {
    return buildServiceError({
      key: "error.network.timeout",
      toastType: "error",
      retryable: true,
    });
  }

  // 无响应：通常为断网/域名不可达/被系统拦截
  if (!error.response) {
    return buildServiceError({
      key: "error.network.unavailable",
      toastType: "error",
      retryable: true,
    });
  }

  const statusCode = error.response.status;
  const responseData = error.response.data as any;
  const matchedRule = options.statusMap?.[statusCode];

  if (matchedRule) {
    return buildServiceError({
      key: matchedRule.key,
      toastType: matchedRule.toastType ?? fallbackToastType,
      statusCode,
      actionKey: matchedRule.actionKey,
      retryable: matchedRule.retryable,
      fieldErrors:
        statusCode === 422 ? parseValidationErrors(responseData) : undefined,
    });
  }

  // 通用 422 映射
  if (statusCode === 422) {
    const fieldErrors = parseValidationErrors(responseData);
    return buildServiceError({
      key: "error.validation.invalid",
      toastType: "warning",
      statusCode,
      fieldErrors,
    });
  }

  // 通用状态码兜底
  if (statusCode === 401) {
    return buildServiceError({
      key: "error.auth.unauthorized",
      toastType: "info",
      statusCode,
      actionKey: "common.login",
    });
  }

  if (statusCode === 403) {
    return buildServiceError({
      key: "error.auth.forbidden",
      toastType: "error",
      statusCode,
    });
  }

  if (statusCode === 404) {
    return buildServiceError({
      key: "error.common.notFound",
      toastType: "error",
      statusCode,
    });
  }

  if (statusCode === 409) {
    return buildServiceError({
      key: "error.common.conflict",
      toastType: "warning",
      statusCode,
    });
  }

  if (statusCode === 429) {
    return buildServiceError({
      key: "error.common.rateLimited",
      toastType: "warning",
      statusCode,
      retryable: true,
    });
  }

  if (statusCode >= 500) {
    return buildServiceError({
      key: "error.server.unavailable",
      toastType: "error",
      statusCode,
      retryable: true,
    });
  }

  if (statusCode === 400) {
    return buildServiceError({
      key: "error.common.badRequest",
      toastType: "warning",
      statusCode,
    });
  }

  return buildServiceError({
    key: options.fallbackKey,
    toastType: fallbackToastType,
    statusCode,
  });
};
