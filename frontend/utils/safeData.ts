import { SmartNoteSection } from "../types";

/**
 * safeData 使用约定（重要）
 *
 * 何时必须使用：
 * 1) 数据来自 API / AsyncStorage / 路由参数 / unknown 输入
 * 2) 准备对数组做 map / filter / spread 等操作
 * 3) UI 渲染链路中，字段可能为空或类型漂移
 *
 * 何时可以不使用：
 * 1) 当前变量在本函数内刚创建，且类型已被严格保证
 * 2) TS 类型和运行时来源都可控（例如常量数组）
 *
 * 禁止事项：
 * - 不要在 UI 里直接对 unknown 做 map/spread
 * - 不要在各页面重复手写 Array.isArray + filter 逻辑
 *
 * 推荐落点：
 * - Service/Hooks 先归一化，UI 只消费安全数据
 */

/**
 * 将未知值安全转换为字符串数组
 * - 仅保留 string
 * - 自动 trim
 * - 自动过滤空字符串
 */
export const toSafeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
};

/**
 * 将未知值转换为可选字符串数组
 * - 空数组返回 undefined，方便与后端字段“缺省”语义保持一致
 */
export const toOptionalSafeStringArray = (
  value: unknown,
): string[] | undefined => {
  const normalized = toSafeStringArray(value);
  return normalized.length > 0 ? normalized : undefined;
};

/**
 * 将未知值安全转换为章节数组
 * - 仅保留对象项
 * - heading/content 仅接受字符串
 * - 同时为空的章节会被过滤
 */
export const toSafeSections = (value: unknown): SmartNoteSection[] => {
  if (!Array.isArray(value)) return [];

  return value
    .filter(
      (item): item is { heading?: unknown; content?: unknown } =>
        !!item && typeof item === "object",
    )
    .map((item) => ({
      heading: typeof item.heading === "string" ? item.heading : undefined,
      content: typeof item.content === "string" ? item.content : undefined,
    }))
    .filter((item) => !!item.heading || !!item.content);
};

/**
 * 将未知值转换为可选章节数组
 * - 空数组返回 undefined，避免向下游传递无意义空结构
 */
export const toOptionalSafeSections = (
  value: unknown,
): SmartNoteSection[] | undefined => {
  const normalized = toSafeSections(value);
  return normalized.length > 0 ? normalized : undefined;
};
