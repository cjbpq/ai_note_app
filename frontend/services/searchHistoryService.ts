/**
 * 搜索历史 Service
 *
 * 职责：管理本地搜索历史记录的 CRUD 操作（AsyncStorage 持久化）
 *
 * 存储结构：string[]（按时间倒序，最新在前）
 * 上限：APP_CONFIG.MAX_SEARCH_HISTORY 条
 *
 * 规则：
 * - 新增时去重（已存在则提升到最前）
 * - 超出上限自动裁剪末尾
 * - 所有方法为无状态 async 函数，供 Hook 层调用
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { APP_CONFIG, STORAGE_KEYS } from "../constants/config";

/**
 * 搜索历史缓存 key（按账号隔离）
 */
const getSearchHistoryKey = (userId: string) =>
  `${STORAGE_KEYS.SEARCH_HISTORY}_${userId}`;

/**
 * 从 AsyncStorage 读取搜索历史列表
 * @param userId 当前登录用户 ID
 * @returns 历史记录数组（最新在前），失败或为空时返回 []
 */
const getHistory = async (userId: string): Promise<string[]> => {
  const key = getSearchHistoryKey(userId);
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    // 防御：确保返回值为字符串数组
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    // 解析失败时返回空数组，不阻塞 UI
    return [];
  }
};

/**
 * 新增一条搜索历史记录
 *
 * 去重逻辑：如果标题已存在，先移除旧的再插入到最前面（提升位置）
 * 超出上限时裁剪末尾记录
 *
 * @param userId 当前登录用户 ID
 * @param title 笔记标题（用户点击查看的笔记标题）
 */
const addHistory = async (userId: string, title: string): Promise<void> => {
  const trimmed = title.trim();
  if (!trimmed) return;
  const key = getSearchHistoryKey(userId);

  try {
    const current = await getHistory(userId);
    // 去重：移除已存在的相同标题
    const filtered = current.filter((item) => item !== trimmed);
    // 插入到最前面
    const updated = [trimmed, ...filtered].slice(
      0,
      APP_CONFIG.MAX_SEARCH_HISTORY,
    );
    await AsyncStorage.setItem(key, JSON.stringify(updated));
  } catch {
    // 写入失败静默处理，不影响主流程
  }
};

/**
 * 删除单条搜索历史记录
 * @param userId 当前登录用户 ID
 * @param title 要删除的历史记录标题
 */
const removeOne = async (userId: string, title: string): Promise<void> => {
  const key = getSearchHistoryKey(userId);
  try {
    const current = await getHistory(userId);
    const updated = current.filter((item) => item !== title);
    await AsyncStorage.setItem(key, JSON.stringify(updated));
  } catch {
    // 删除失败静默处理
  }
};

/**
 * 清空所有搜索历史记录
 */
const clearAll = async (userId?: string): Promise<void> => {
  try {
    if (userId) {
      await AsyncStorage.removeItem(getSearchHistoryKey(userId));
      return;
    }

    // 兼容旧版本：清理历史全局 key
    await AsyncStorage.removeItem(STORAGE_KEYS.SEARCH_HISTORY);
  } catch {
    // 清空失败静默处理
  }
};

export const searchHistoryService = {
  getHistory,
  addHistory,
  removeOne,
  clearAll,
};
