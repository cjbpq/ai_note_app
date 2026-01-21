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
    await database.execAsync(`
      PRAGMA journal_mode = WAL;
      
      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY NOT NULL, -- 使用服务器ID作为主键
        title TEXT NOT NULL,
        content TEXT,
        date TEXT,
        tags TEXT,                    -- JSON String
        imageUrl TEXT,
        categoryId TEXT,
        structuredData TEXT,          -- JSON String
        isSynced INTEGER DEFAULT 1    -- 1: 已同步, 0: 未同步 (本地新建)
      );
    `);
    console.log("📦 SQLite database initialized.");
  } catch (error) {
    console.error("❌ Failed to initialize database:", error);
  }
};

/**
 * 将 API 返回的 Note 对象转换为存储格式
 */
const normalizeNoteForDb = (note: Note) => {
  return [
    note.id,
    note.title,
    note.content || "",
    note.date,
    JSON.stringify(note.tags || []),
    note.imageUrl || "",
    note.categoryId || "",
    JSON.stringify(note.structuredData || {}),
    1, // 默认为已同步
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
