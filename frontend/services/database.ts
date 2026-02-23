import * as SQLite from "expo-sqlite";
import { APP_CONFIG } from "../constants/config";
import { Note } from "../types";

/**
 * 数据库管理服务 (Database Service)
 *
 * 负责 SQLite 的所有底层操作。
 * 使用后端生成的 uuid 作为主键。
 */

let db: SQLite.SQLiteDatabase | null = null;

// 数据库版本号 - 每次 schema 变更时递增
// v3: 对齐后端 NoteResponse 全字段
// v4: 图片字段从单值改为数组（imageUrl→imageUrls, imageFilename→imageFilenames, imageSize→imageSizes）
const DB_VERSION = 4;

// 获取数据库实例
const getDB = async (): Promise<SQLite.SQLiteDatabase> => {
  if (db) {
    return db;
  }
  db = await SQLite.openDatabaseAsync(APP_CONFIG.DB_NAME);
  return db;
};

// 初始化数据库表结构
export const initDatabase = async () => {
  try {
    const database = await getDB();

    // 启用 WAL 模式提高性能
    await database.execAsync(`PRAGMA journal_mode = WAL;`);

    // 简单迁移策略：删除旧表并重建（本地仅做缓存，数据以服务端为准）
    try {
      await database.execAsync(`DROP TABLE IF EXISTS notes;`);
      console.log("📦 Dropped old notes table for migration.");
    } catch {
      // 忽略删除失败
    }

    // 创建新表结构，对齐 Note 接口（v4：图片字段为 JSON 数组）
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL DEFAULT 'Untitled',
        content TEXT DEFAULT '',
        date TEXT DEFAULT '',
        updatedAt TEXT DEFAULT '',
        tags TEXT DEFAULT '[]',
        imageUrls TEXT DEFAULT '[]',
        imageFilenames TEXT DEFAULT '[]',
        imageSizes TEXT DEFAULT '[]',
        category TEXT DEFAULT '',
        isFavorite INTEGER DEFAULT 0,
        isArchived INTEGER DEFAULT 0,
        userId TEXT DEFAULT '',
        deviceId TEXT DEFAULT '',
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
 * 将 Note 对象转换为 SQLite 参数数组
 */
const noteToDbRow = (note: Note): (string | number)[] => {
  const safeDate = note.date || new Date().toISOString();

  let safeTags: string[] = [];
  if (Array.isArray(note.tags)) {
    safeTags = note.tags;
  } else if (typeof note.tags === "string") {
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
    note.updatedAt || safeDate,
    JSON.stringify(safeTags),
    JSON.stringify(note.imageUrls ?? []),
    JSON.stringify(note.imageFilenames ?? []),
    JSON.stringify(note.imageSizes ?? []),
    note.category || "",
    note.isFavorite ? 1 : 0,
    note.isArchived ? 1 : 0,
    note.userId || "",
    note.deviceId || "",
    JSON.stringify(note.structuredData || {}),
    1,
  ];
};

/**
 * 将 SQLite 行数据转换为 Note 对象
 */
const dbRowToNote = (row: any): Note => {
  // 安全解析 JSON 数组字段（兼容旧版 DB 单值 / 空值）
  const parseJsonArray = <T>(val: unknown, fallback: T[] = []): T[] => {
    if (!val) return fallback;
    if (typeof val === "string") {
      try {
        const parsed = JSON.parse(val);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        return fallback;
      }
    }
    return fallback;
  };

  return {
    id: row.id,
    title: row.title,
    content: row.content,
    date: row.date,
    updatedAt: row.updatedAt || undefined,
    tags: row.tags ? JSON.parse(row.tags) : [],
    imageUrls: parseJsonArray<string>(row.imageUrls),
    imageFilenames: parseJsonArray<string>(row.imageFilenames),
    imageSizes: parseJsonArray<number>(row.imageSizes),
    category: row.category || undefined,
    isFavorite: row.isFavorite === 1,
    isArchived: row.isArchived === 1,
    userId: row.userId || undefined,
    deviceId: row.deviceId || undefined,
    structuredData: row.structuredData
      ? JSON.parse(row.structuredData)
      : undefined,
  };
};

/**
 * 批量覆盖/保存笔记 (用于 fetchNotes 下拉刷新)
 * 使用事务一次性写入，提高性能
 */
export const saveNotesToLocal = async (notes: Note[]) => {
  const database = await getDB();

  try {
    await database.runAsync("DELETE FROM notes");

    if (notes.length === 0) return;

    for (const note of notes) {
      await database.runAsync(
        `INSERT OR REPLACE INTO notes 
        (id, title, content, date, updatedAt, tags, imageUrls, imageFilenames, imageSizes,
         category, isFavorite, isArchived, userId, deviceId, structuredData, isSynced)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        // @ts-ignore SQLite 参数限制
        noteToDbRow(note),
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
    (id, title, content, date, updatedAt, tags, imageUrls, imageFilenames, imageSizes,
     category, isFavorite, isArchived, userId, deviceId, structuredData, isSynced)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    // @ts-ignore SQLite 参数限制
    noteToDbRow(note),
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

  return allRows.map((row: any) => dbRowToNote(row));
};

/**
 * 获取单条本地笔记
 */
export const fetchLocalNoteById = async (id: string): Promise<Note | null> => {
  const database = await getDB();
  const rows = await database.getAllAsync(
    "SELECT * FROM notes WHERE id = ? LIMIT 1",
    [id],
  );

  const row = rows?.[0] as any;
  if (!row) return null;
  return dbRowToNote(row);
};

/**
 * 清空本地笔记缓存
 *
 * 说明：本地 SQLite 仅作为临时缓存（Source of Truth 仍是后端）。
 * 在切换账号 / 退出登录时清空，避免不同账号数据串号。
 */
export const clearLocalNotes = async (): Promise<void> => {
  try {
    const database = await getDB();
    await database.runAsync("DELETE FROM notes");
  } catch (error) {
    // 防御性：DB 尚未初始化或表不存在时，直接忽略即可
    console.warn("[Database] Failed to clear local notes:", error);
  }
};
