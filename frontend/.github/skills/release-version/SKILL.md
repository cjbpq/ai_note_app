# Skill: 版本发布与日志更新 (Release Version)

## 1. 技能描述 (Description)

自动化处理项目版本号升级、CHANGELOG 编写以及 README 同步更新的流程。
当用户准备发布新版本，并提供核心更新点时，AI 将自动提取上下文，将更新内容翻译并分类为专业的英文描述，同步更新到所有相关文件中。

## 2. 触发条件 (Trigger)

当用户输入类似以下指令时触发：

> “我需要更新一下版本，更新后的版本号为 v0.2.0。本次更新的主要内容：1.新增本地搜索功能 2.新增侧边栏UI 3.修复不同账户本地缓存串数据bug 4.编辑页面UI重构 5.新增支持多图、并发上传功能”

## 3. 执行步骤 (Workflow)

### Step 1: 解析输入与收集上下文

1. 提取用户提供的**目标版本号**（如 `v0.2.0`）和**核心更新点**。
2. **(可选但推荐)** 读取 `LOG/History.md` 中最近的记录，以补充用户简写内容的细节（例如：用户说“修复串数据bug”，AI 可从 History 中查阅具体是“登出清理 Query 缓存与 SQLite 数据”）。

### Step 2: 更新 `CHANGELOG.md`

1. 将用户提供的更新点翻译并润色为专业的英文描述。
2. 按照 [Keep a Changelog](https://keepachangelog.com/) 规范，将更新点分类为 `Added`, `Changed`, `Fixed` 等。
3. 在 `CHANGELOG.md` 文件的顶部（现有版本记录之上）插入新的版本块，格式如下：

   ```markdown
   ## [X.X.X] - YYYY-MM-DD

   ### Added

   - **Feature Name**: Description...

   ### Changed

   - **Feature Name**: Description...

   ### Fixed

   - **Bug Name**: Description...
   ```

### Step 3: 更新 `README.md`

1. 找到 `## 🔄 Version` 部分。
2. 更新当前版本号：`**Current version:** vX.X.X`。
3. 更新 `**Latest Updates:**` 列表。
   - **注意**：这里的更新点必须是**极简版**的英文描述（通常 3-5 条，直接对应用户提供的核心点），不要像 CHANGELOG 那样详细。
   - 示例：

     ```markdown
     **Latest Updates:**

     - ✨ Added local search capability
     - 🎨 Added sidebar UI for category management
     - 🐛 Fixed local cache data cross-contamination between accounts
     - ♻️ Refactored edit page UI
     - 🚀 Added support for concurrent multi-image uploads
     ```

### Step 4: 更新 `package.json`

1. 找到 `"version": "..."` 字段。
2. 将其更新为用户提供的新版本号（去掉 `v` 前缀，如 `"version": "0.2.0"`）。

### Step 5: 总结与反馈

1. 向用户报告已成功更新的文件列表（`CHANGELOG.md`, `README.md`, `package.json`）。
2. 简要展示生成的 CHANGELOG 预览，以便用户确认。

## 4. 禁忌与注意事项 (Constraints)

- **语言要求**：`CHANGELOG.md` 和 `README.md` 中的更新记录**必须使用英文**。
- **保持简洁**：MVP 阶段不要把所有细枝末节（如某行代码的微调）都塞进 CHANGELOG，只记录面向用户的功能变化或重大的架构调整。
- **不要修改历史记录**：在 `CHANGELOG.md` 中插入新版本时，绝对不要破坏或修改之前版本的记录。
- **版本号格式**：`package.json` 中的版本号不能包含 `v` 前缀（必须是 `0.2.0` 而不是 `v0.2.0`）。
