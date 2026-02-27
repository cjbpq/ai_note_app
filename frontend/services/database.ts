import * as SQLite from "expo-sqlite";
import { APP_CONFIG } from "../constants/config";
import { Note } from "../types";

/**
 * 数据库管理服务 (Database Service)
 *
 * 负责 SQLite 的所有底层操作。
 * 使用后端生成的 uuid 作为主键。
 *
 * 迁移策略：
 *   使用 PRAGMA user_version 做版本比对。
 *   - schema 不变 → 保留现有数据（缓存跨 Session 存活）
 *   - 版本升级 → 执行增量 ALTER TABLE 迁移
 *   - 退出登录 → clearLocalNotes() 清空数据（账号隔离）
 *
 * Phase B 新增：
 *   - sync_queue 表：记录离线操作（edit/delete/favorite），恢复在线后自动重放
 */

// ============================================================================
// 离线同步队列类型定义
// ============================================================================

/** 同步操作类型 */
export type SyncOperationType = "edit" | "delete" | "favorite";

/** 同步队列条目 */
export interface SyncQueueItem {
  /** 自增主键 */
  id: number;
  /** 操作类型 */
  type: SyncOperationType;
  /** 操作目标笔记 ID */
  noteId: string;
  /** 操作载荷（JSON 序列化），edit 时存更新字段，favorite 时存目标状态 */
  payload: string;
  /** 创建时间戳（毫秒） */
  createdAt: number;
  /** 重试次数 */
  retryCount: number;
}

let db: SQLite.SQLiteDatabase | null = null;

/**
 * 数据库版本号 — 每次 schema 变更时递增
 *
 * 变更历史：
 *   v3: 对齐后端 NoteResponse 全字段
 *   v4: 图片字段从单值改为数组（imageUrl→imageUrls 等）
 *   v5: 移除 DROP TABLE 策略，改为 PRAGMA user_version 增量迁移
 *   v6: 新增 sync_queue 表（Phase B 离线操作队列）
 */
const DB_VERSION = 6;

// 获取数据库实例
const getDB = async (): Promise<SQLite.SQLiteDatabase> => {
  if (db) {
    return db;
  }
  db = await SQLite.openDatabaseAsync(APP_CONFIG.DB_NAME);
  return db;
};

// 初始化数据库表结构（使用 PRAGMA user_version 增量迁移）
export const initDatabase = async () => {
  try {
    const database = await getDB();

    // 启用 WAL 模式提高性能
    await database.execAsync(`PRAGMA journal_mode = WAL;`);

    // 读取当前数据库版本号
    const versionResult = await database.getFirstAsync<{
      user_version: number;
    }>(`PRAGMA user_version;`);
    const currentVersion = versionResult?.user_version ?? 0;

    console.log(
      `📦 DB current version: ${currentVersion}, target: ${DB_VERSION}`,
    );

    if (currentVersion === 0) {
      // ── 全新安装 / 旧版 DROP TABLE 策略遗留（无版本号） ──
      // 安全地删除可能存在的旧 schema 表，然后创建最新 schema
      await database.execAsync(`DROP TABLE IF EXISTS notes;`);
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
      console.log("📦 Created notes table (fresh install).");
      // Phase B: 创建离线同步队列表
      await database.execAsync(`
        CREATE TABLE IF NOT EXISTS sync_queue (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          type TEXT NOT NULL,
          noteId TEXT NOT NULL,
          payload TEXT DEFAULT '{}',
          createdAt INTEGER NOT NULL,
          retryCount INTEGER DEFAULT 0
        );
      `);
      console.log("📦 Created sync_queue table (fresh install).");
    } else if (currentVersion < DB_VERSION) {
      // ── 增量迁移 ──
      // 未来 schema 变更在此添加条件分支，例如：
      // if (currentVersion < 6) {
      //   await database.execAsync(`ALTER TABLE notes ADD COLUMN newField TEXT DEFAULT '';`);
      // }
      console.log(
        `📦 Migrating database from v${currentVersion} to v${DB_VERSION}...`,
      );

      // v4 → v5: schema 不变，仅迁移策略升级（保留数据）
      // 确保表存在（防御性）
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

      // v5 → v6: 新增 sync_queue 离线操作队列表
      if (currentVersion < 6) {
        await database.execAsync(`
          CREATE TABLE IF NOT EXISTS sync_queue (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL,
            noteId TEXT NOT NULL,
            payload TEXT DEFAULT '{}',
            createdAt INTEGER NOT NULL,
            retryCount INTEGER DEFAULT 0
          );
        `);
        console.log("📦 Created sync_queue table (migration v5→v6).");
      }

      console.log("📦 Migration complete.");
    } else {
      // ── 版本一致，无需迁移 ──
      console.log("📦 Database schema up to date, preserving cached data.");
    }

    // 写入当前版本号
    await database.execAsync(`PRAGMA user_version = ${DB_VERSION};`);

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

  // 安全解析 structuredData：空对象 '{}' 视为 undefined
  // 列表 API 不返回 structuredData，本地存储为 '{}'，
  // 必须正确识别为「无详情缓存」，避免 UI 误以为有数据可展示
  let structuredData: Note["structuredData"] = undefined;
  if (
    row.structuredData &&
    row.structuredData !== "{}" &&
    row.structuredData !== "null"
  ) {
    try {
      const sd = JSON.parse(row.structuredData);
      if (
        sd &&
        typeof sd === "object" &&
        (sd.summary || sd.sections || sd.keyPoints || sd.rawText || sd.title)
      ) {
        structuredData = sd;
      }
    } catch {
      // JSON 解析失败，视为无数据
    }
  }

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
    structuredData,
  };
};

/**
 * 判断本地缓存是否包含"详情级"富数据
 *
 * 列表 API 返回的数据通常没有 structuredData 和 content（original_text），
 * 而详情 API 返回完整数据。通过此函数区分本地缓存的丰富程度，
 * 避免列表刷新覆盖掉已缓存的详情数据。
 */
const localHasRichData = (row: {
  content?: string;
  structuredData?: string;
  imageUrls?: string;
}): { hasRichContent: boolean; hasRichImages: boolean } => {
  // 判断 structuredData 是否有实际内容（非空 JSON）
  let hasRichContent = false;
  if (
    row.structuredData &&
    row.structuredData !== "{}" &&
    row.structuredData !== "null"
  ) {
    try {
      const sd = JSON.parse(row.structuredData);
      hasRichContent = !!(
        sd.summary ||
        sd.sections ||
        sd.keyPoints ||
        sd.rawText
      );
    } catch {
      hasRichContent = false;
    }
  }
  // 如果 structuredData 不丰富，也看 content 字段
  if (!hasRichContent && row.content && row.content.length > 0) {
    hasRichContent = true;
  }

  // 判断图片数组是否比较丰富（>1 张认为是详情级数据）
  let hasRichImages = false;
  if (row.imageUrls) {
    try {
      const imgs = JSON.parse(row.imageUrls);
      hasRichImages = Array.isArray(imgs) && imgs.length > 1;
    } catch {
      hasRichImages = false;
    }
  }

  return { hasRichContent, hasRichImages };
};

/**
 * 批量合并保存笔记 (Smart Merge 策略)
 *
 * 设计变更（v5.1）：
 *   v5 策略：INSERT OR REPLACE 逐条合并（列表数据会覆盖已有详情缓存）
 *   v5.1 策略：先检测本地是否已有"详情级"数据，有则仅 UPDATE 元数据字段
 *
 * 核心问题：
 *   列表 API 返回缩略数据（无 structuredData / content / 完整图片数组），
 *   如果直接 INSERT OR REPLACE，会把之前通过详情 API 缓存的完整数据覆盖掉。
 *   离线查看详情页时就只剩空白内容。
 *
 * 解决：
 *   - 本地已有富数据 + 传入为列表级数据 → 仅 UPDATE 元数据（title/tags/date 等）
 *   - 本地无数据或传入也含富数据 → 正常 INSERT OR REPLACE
 *
 * @param notes - 从服务端获取的最新笔记列表
 */
export const saveNotesToLocal = async (notes: Note[]) => {
  const database = await getDB();

  try {
    // Step 1: 删除本地存在但服务端已删除的笔记（仅清理已同步的）
    // 注意：isSynced=0 的本地离线记录不应被误删（Phase B 预留）
    if (notes.length > 0) {
      const placeholders = notes.map(() => "?").join(",");
      await database.runAsync(
        `DELETE FROM notes WHERE id NOT IN (${placeholders}) AND isSynced = 1`,
        notes.map((n) => n.id),
      );
    } else {
      // 服务端返回空列表 → 清除所有已同步缓存
      await database.runAsync(`DELETE FROM notes WHERE isSynced = 1`);
    }

    // Step 2: Smart Merge — 按本地数据丰富程度决定写入方式
    let smartMergeCount = 0;
    for (const note of notes) {
      // 查询本地是否已有该笔记的缓存
      const localRow = await database.getFirstAsync<{
        content: string;
        structuredData: string;
        imageUrls: string;
      }>("SELECT content, structuredData, imageUrls FROM notes WHERE id = ?", [
        note.id,
      ]);

      // 判断传入数据是否为"列表级"（缺少结构化内容）
      const incomingIsListLevel =
        !note.structuredData ||
        (!note.structuredData.summary &&
          !note.structuredData.sections &&
          !note.structuredData.keyPoints);

      // 判断本地是否有详情级富数据
      const local = localRow
        ? localHasRichData(localRow)
        : { hasRichContent: false, hasRichImages: false };

      if (local.hasRichContent && incomingIsListLevel) {
        // ── 保护模式：仅更新元数据字段，不覆盖 content / structuredData ──
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

        // 图片：如果本地更丰富（多图），也不覆盖
        const imageUpdateClause = local.hasRichImages
          ? "" // 不更新图片字段
          : ", imageUrls = ?, imageFilenames = ?, imageSizes = ?";

        const params: (string | number)[] = [
          note.title || "Untitled",
          safeDate,
          note.updatedAt || safeDate,
          JSON.stringify(safeTags),
          note.category || "",
          note.isFavorite ? 1 : 0,
          note.isArchived ? 1 : 0,
          note.userId || "",
          note.deviceId || "",
        ];

        if (!local.hasRichImages) {
          params.push(
            JSON.stringify(note.imageUrls ?? []),
            JSON.stringify(note.imageFilenames ?? []),
            JSON.stringify(note.imageSizes ?? []),
          );
        }

        params.push(note.id); // WHERE 条件

        await database.runAsync(
          `UPDATE notes SET
            title = ?, date = ?, updatedAt = ?, tags = ?,
            category = ?, isFavorite = ?, isArchived = ?,
            userId = ?, deviceId = ?, isSynced = 1
            ${imageUpdateClause}
          WHERE id = ?`,
          params,
        );

        smartMergeCount++;
      } else {
        // ── 正常模式：全量写入（本地无数据 或 传入数据也很丰富） ──
        await database.runAsync(
          `INSERT OR REPLACE INTO notes
          (id, title, content, date, updatedAt, tags, imageUrls, imageFilenames, imageSizes,
           category, isFavorite, isArchived, userId, deviceId, structuredData, isSynced)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          // @ts-ignore SQLite 参数限制
          noteToDbRow(note),
        );
      }
    }

    // Smart Merge 汇总日志（避免每条笔记都打印，减少控制台噪音）
    if (smartMergeCount > 0) {
      console.log(
        `📦 Smart merge: preserved rich cache for ${smartMergeCount}/${notes.length} notes`,
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

// ============================================================================
// 离线同步队列操作 (Phase B)
// ============================================================================

/**
 * 将离线操作入队
 *
 * 在离线状态下，编辑/删除/收藏操作先写入本地 SQLite + sync_queue，
 * 恢复在线后由同步引擎按创建时间顺序逐条重放。
 *
 * @param type - 操作类型：edit / delete / favorite
 * @param noteId - 目标笔记 ID
 * @param payload - 操作载荷（edit 时为更新字段，favorite 时为目标状态）
 */
export const enqueueSyncOperation = async (
  type: SyncOperationType,
  noteId: string,
  payload: Record<string, unknown> = {},
): Promise<void> => {
  const database = await getDB();
  await database.runAsync(
    `INSERT INTO sync_queue (type, noteId, payload, createdAt, retryCount)
     VALUES (?, ?, ?, ?, 0)`,
    [type, noteId, JSON.stringify(payload), Date.now()],
  );
  console.log(`📤 Enqueued sync operation: ${type} for note ${noteId}`);
};

/**
 * 获取所有待同步操作（按创建时间升序）
 */
export const fetchPendingSyncOps = async (): Promise<SyncQueueItem[]> => {
  const database = await getDB();
  const rows = await database.getAllAsync(
    "SELECT * FROM sync_queue ORDER BY createdAt ASC",
  );
  return rows as SyncQueueItem[];
};

/**
 * 获取待同步操作数量（用于 UI 角标）
 */
export const getPendingSyncCount = async (): Promise<number> => {
  const database = await getDB();
  const row = await database.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM sync_queue",
  );
  return row?.count ?? 0;
};

/**
 * 移除已成功同步的操作
 */
export const removeSyncOperation = async (id: number): Promise<void> => {
  const database = await getDB();
  await database.runAsync("DELETE FROM sync_queue WHERE id = ?", [id]);
};

/**
 * 增加重试计数（用于失败重试限制）
 */
export const incrementSyncRetry = async (id: number): Promise<void> => {
  const database = await getDB();
  await database.runAsync(
    "UPDATE sync_queue SET retryCount = retryCount + 1 WHERE id = ?",
    [id],
  );
};

/**
 * 清空同步队列（退出登录时调用，配合 clearLocalNotes 做账号隔离）
 */
export const clearSyncQueue = async (): Promise<void> => {
  try {
    const database = await getDB();
    await database.runAsync("DELETE FROM sync_queue");
  } catch (error) {
    console.warn("[Database] Failed to clear sync queue:", error);
  }
};

/**
 * 更新本地笔记的 isSynced 标记
 *
 * Phase B 使用：
 *   - 离线修改时标记 isSynced=0（本地有未同步变更）
 *   - 同步成功后标记 isSynced=1（已与服务端一致）
 */
export const updateNoteSyncStatus = async (
  noteId: string,
  isSynced: boolean,
): Promise<void> => {
  const database = await getDB();
  await database.runAsync("UPDATE notes SET isSynced = ? WHERE id = ?", [
    isSynced ? 1 : 0,
    noteId,
  ]);
};
