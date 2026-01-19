// 核心笔记类型定义
export interface Note {
  id: string;
  title: string;
  content: string;
  date: string;
  tags: string[];
  // 可选：添加更多字段如 imageUrl, categoryId 等
}

// 用户类型定义 (示例)
export interface User {
  id: string;
  username: string;
  avatar?: string;
}
