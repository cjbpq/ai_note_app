/**
 * 分类管理 Service 层
 *
 * 职责：
 *   - 调用后端 GET /library/categories 获取分类列表
 *   - 管理本地新建分类（AsyncStorage 暂存，上传后后端自动聚合）
 *
 * 数据来源说明：
 *   后端 GET /categories 是一个"聚合查询"——从当前用户的所有笔记中提取唯一的 category 值。
 *   它不支持"创建分类"API，新分类是通过上传笔记时 note_type 字段自动产生的。
 *   因此本地新建分类需要暂存到 AsyncStorage，等上传成功后后端自然包含该分类。
 *
 * 使用方：hooks/useCategories.ts（TanStack Query 包裹）
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ENDPOINTS, STORAGE_KEYS } from "../constants/config";
import { NoteCategory } from "../types";
import api from "./api";
import { parseServiceError } from "./errorService";

/**
 * 分类本地缓存 key（按账号隔离）
 * - 目的：避免不同账号共享同一份“本地新建分类”导致串数据
 */
const getLocalNewCategoriesKey = (userId: string) =>
  `${STORAGE_KEYS.LOCAL_NEW_CATEGORIES}_${userId}`;

// ============================================================================
// 后端 API：获取分类列表
// ============================================================================

/**
 * 调用 GET /library/categories 获取当前用户的分类列表
 *
 * 后端返回格式（聚合结果）可能是：
 *   - string[]  例如 ["学习笔记", "web", "课程管理"]
 *   - { categories: string[] }
 *   - { name: string, count: number }[]
 *
 * Service 层做防御性适配，统一输出为 NoteCategory[]
 */
export const fetchCategories = async (): Promise<NoteCategory[]> => {
  try {
    const response = await api.get(ENDPOINTS.LIBRARY.GET_CATEGORIES);
    const data = response as unknown;

    // 适配策略：尝试多种后端返回格式
    let rawList: string[] = [];

    if (Array.isArray(data)) {
      // 格式 A: string[] — ["学习笔记", "web"]
      rawList = data.filter(
        (item: unknown) => typeof item === "string" && item.trim(),
      );
    } else if (
      data &&
      typeof data === "object" &&
      "categories" in (data as Record<string, unknown>)
    ) {
      // 格式 B: { categories: string[] }
      const cats = (data as Record<string, unknown>).categories;
      if (Array.isArray(cats)) {
        rawList = cats.filter(
          (item: unknown) => typeof item === "string" && item.trim(),
        );
      }
    }

    // 转换为 NoteCategory（count 暂时不可用，统一填 0；由 UI 层统计）
    return rawList.map((name) => ({
      id: name,
      name,
      noteCount: 0,
    }));
  } catch (error) {
    throw parseServiceError(error, {
      fallbackKey: "error.category.fetchFailed",
      statusMap: {
        401: { key: "error.auth.unauthorized", toastType: "info" },
        500: {
          key: "error.server.unavailable",
          toastType: "error",
          retryable: true,
        },
      },
    });
  }
};

// ============================================================================
// 本地缓存：管理用户新建但尚未上传过的分类名
// ============================================================================

/**
 * 从 AsyncStorage 读取本地新建分类名列表（按账号隔离）
 * 用于在上传选择器中展示"已新建但尚未产生笔记"的分类
 */
export const getLocalNewCategories = async (
  userId: string,
): Promise<string[]> => {
  const key = getLocalNewCategoriesKey(userId);
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((s: unknown) => typeof s === "string" && s.trim())
      : [];
  } catch {
    return [];
  }
};

/**
 * 追加一个本地新建分类名到 AsyncStorage
 * 如果已存在同名则忽略（去重）
 *
 * @param userId 当前登录用户 ID
 * @param name 分类名称（已去除首尾空格）
 */
export const saveLocalNewCategory = async (
  userId: string,
  name: string,
): Promise<void> => {
  const trimmed = name.trim();
  if (!trimmed) return;
  const key = getLocalNewCategoriesKey(userId);

  try {
    const existing = await getLocalNewCategories(userId);
    if (existing.includes(trimmed)) return; // 已存在，无需重复

    existing.push(trimmed);
    await AsyncStorage.setItem(key, JSON.stringify(existing));
  } catch {
    // 写入失败不阻断主流程，仅在开发模式打印
    if (__DEV__) {
      console.warn("[categoryService] Failed to save local category:", trimmed);
    }
  }
};

/**
 * 清空本地新建分类缓存
 * - 传 userId: 仅清理当前账号
 * - 不传 userId: 清理历史遗留的全局 key（兼容旧版本）
 */
export const clearLocalNewCategories = async (
  userId?: string,
): Promise<void> => {
  try {
    if (userId) {
      await AsyncStorage.removeItem(getLocalNewCategoriesKey(userId));
      return;
    }

    // 兼容旧版本：清理曾经的全局共享 key，防止升级后继续污染
    await AsyncStorage.removeItem(STORAGE_KEYS.LOCAL_NEW_CATEGORIES);
  } catch {
    // ignore
  }
};
