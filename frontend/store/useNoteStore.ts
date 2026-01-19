import { create } from "zustand";

// 定义笔记的数据结构
export interface Note {
  id: string;
  title: string;
  content: string;
  date: string;
  tags: string[];
}

// 定义 Store 的状态和动作
interface NoteState {
  notes: Note[];
  addNote: (note: Omit<Note, "id" | "date">) => void;
  removeNote: (id: string) => void;
  updateNote: (id: string, updatedNote: Partial<Note>) => void;
}

export const useNoteStore = create<NoteState>((set) => ({
  // 初始数据（这里放一些假数据方便调试，正式上线可以置空）
  notes: [
    {
      id: "1",
      title: "Zustand 学习笔记",
      content: "Zustand 是一个非常轻量级的状态管理库，API 设计极其简洁...",
      date: "2026-01-18",
      tags: ["学习", "React Native"],
    },
    {
      id: "2",
      title: "项目灵感",
      content: "要做一个 AI 驱动的笔记应用，能够自动总结和分类...",
      date: "2026-01-18",
      tags: ["灵感", "AI"],
    },
  ],

  // 添加笔记
  addNote: (note) =>
    set((state) => ({
      notes: [
        {
          id: Math.random().toString(36).substring(7), // 简单的 ID 生成
          date: new Date().toISOString().split("T")[0], // 简单的日期格式
          ...note,
        },
        ...state.notes,
      ],
    })),

  // 删除笔记
  removeNote: (id) =>
    set((state) => ({
      notes: state.notes.filter((n) => n.id !== id),
    })),

  // 更新笔记
  updateNote: (id, updatedNote) =>
    set((state) => ({
      notes: state.notes.map((n) =>
        n.id === id ? { ...n, ...updatedNote } : n,
      ),
    })),
}));
