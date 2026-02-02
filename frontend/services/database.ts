import * as SQLite from "expo-sqlite";
import { APP_CONFIG } from "../constants/config";
import { Note } from "../types";

/**
 * 数据库管理服务 (Database Service)
 *
 * 负责 SQLite 的所有底层操作。
 * 我们将使用 server 端生成的 ID (uuid) 作为主键，方便对应。
 */

let db: SQLite.SQLiteDatabase | null = null;

// 数据库版本号 - 用于迁移
const DB_VERSION = 2;

// 1. 获取数据库实例
const getDB = async (): Promise<SQLite.SQLiteDatabase> => {
  if (db) {
    return db;
  }
  db = await SQLite.openDatabaseAsync(APP_CONFIG.DB_NAME);
  return db;
};

// 2. 初始化数据库表结构
export const initDatabase = async () => {
  try {
    const database = await getDB();

    // 启用 WAL 模式提高性能
    await database.execAsync(`PRAGMA journal_mode = WAL;`);

    // 检查是否需要迁移：删除旧表并重建
    // 这是简单粗暴但对新手友好的迁移策略
    // 生产环境应该使用更精细的迁移方案
    try {
      // 尝试删除旧表 (如果存在)
      await database.execAsync(`DROP TABLE IF EXISTS notes;`);
      console.log("📦 Dropped old notes table for migration.");
    } catch {
      // 忽略删除失败
    }

    // 创建新表结构
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL DEFAULT 'Untitled',
        content TEXT DEFAULT '',
        date TEXT DEFAULT '',
        tags TEXT DEFAULT '[]',
        imageUrl TEXT DEFAULT '',
        categoryId TEXT DEFAULT '',
        structuredData TEXT DEFAULT '{}',
        isSynced INTEGER DEFAULT 1
      );
    `);

    console.log("📦 SQLite database initialized (v" + DB_VERSION + ").");
  } catch (error) {
    console.error("❌ Failed to initialize database:", error);
  }
};

/**
 * 将 Note 对象转换为 SQLite 存储格式
 *
 * 关键：处理可能缺失的字段，确保不会因为 undefined 导致插入失败
 */
const normalizeNoteForDb = (note: Note): (string | number)[] => {
  // 防御性处理：确保日期字段有值
  const safeDate = note.date || new Date().toISOString();

  // 防御性处理：确保 tags 是数组
  let safeTags: string[] = [];
  if (Array.isArray(note.tags)) {
    safeTags = note.tags;
  } else if (typeof note.tags === "string") {
    // 如果后端返回的是字符串，尝试解析
    try {
      safeTags = JSON.parse(note.tags);
    } catch {
      safeTags = [note.tags];
    }
  }

  return [
    note.id,
    note.title || "Untitled",
    note.content || "",
    safeDate,
    JSON.stringify(safeTags),
    note.imageUrl || "",
    note.categoryId || "",
    JSON.stringify(note.structuredData || {}),
    1, // isSynced: 默认为已同步
  ];
};

/**
 * 批量覆盖/保存笔记 (用于 fetchNotes 下拉刷新)
 * 使用事务一次性写入，提高性能
 */
export const saveNotesToLocal = async (notes: Note[]) => {
  const database = await getDB();

  try {
    // 简单策略：清空旧表 -> 写入新数据 (适合数据量不大的场景)
    // 进阶策略是做 Diff，但对新手来说，清空重写最稳健
    await database.runAsync("DELETE FROM notes");

    if (notes.length === 0) return;

    // 批量插入
    for (const note of notes) {
      await database.runAsync(
        `INSERT OR REPLACE INTO notes 
        (id, title, content, date, tags, imageUrl, categoryId, structuredData, isSynced) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        // @ts-ignore
        normalizeNoteForDb(note),
      );
    }
  } catch (error) {
    console.error("Failed to save notes locally:", error);
  }
};

/**
 * 保存单个笔记 (用于 create/update)
 */
export const saveNoteLocally = async (note: Note) => {
  const database = await getDB();
  await database.runAsync(
    `INSERT OR REPLACE INTO notes 
    (id, title, content, date, tags, imageUrl, categoryId, structuredData, isSynced) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    // @ts-ignore
    normalizeNoteForDb(note),
  );
};

/**
 * 删除本地笔记
 */
export const deleteNoteLocally = async (id: string) => {
  const database = await getDB();
  await database.runAsync("DELETE FROM notes WHERE id = ?", [id]);
};

/**
 * 获取所有本地笔记 (离线模式)
 */
export const fetchLocalNotes = async (): Promise<Note[]> => {
  const database = await getDB();
  const allRows = await database.getAllAsync(
    "SELECT * FROM notes ORDER BY date DESC",
  );

  return allRows.map((row: any) => ({
    id: row.id,
    title: row.title,
    content: row.content,
    date: row.date,
    tags: row.tags ? JSON.parse(row.tags) : [],
    imageUrl: row.imageUrl,
    categoryId: row.categoryId,
    structuredData: row.structuredData
      ? JSON.parse(row.structuredData)
      : undefined,
  }));
};
