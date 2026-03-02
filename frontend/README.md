# SnapNote (邮雁智记) — Frontend

«⚠️ This project is currently in the MVP stage and under active development. Features, UI, and structure may change frequently.»

---

## 📱 Overview

This repository contains the frontend implementation of the **SnapNote (邮雁智记)** mobile application.

The frontend focuses on:

- Mobile UI/UX implementation
- User interaction flows
- State management
- Integration with backend AI services

It is built with a mobile-first approach using Expo and React Native. Currently, the development follows an **Android-first** strategy, focusing on core functionality and MVP features before extensive UI polishing or iOS synchronization.

---

## ✨ Current Features (MVP)

The following features are currently available in the MVP stage:

- 📸 **Photo-to-Smart-Note**: Supports multiple images and concurrent upload tasks.
- 🗂 **Category Management**: Basic category system with a sidebar for easy browsing.
- 🔍 **Local Search**: Retrieve notes via categories, tags, and fuzzy keyword search.
- 📝 **Note Browsing**: Simple and efficient note list rendering.
- 🧠 **AI Smart Note Display**: View AI-generated notes with simple editing and favoriting capabilities.
- 🌗 **Theme Toggle**: Support for Dark and Light mode switching.

«Note: The current focus is on core functionality. UI polish and advanced features will be addressed in future iterations once the MVP is finalized.»

---

## 🧱 Tech Stack

**Framework & Core**

- Expo (SDK 54)
- React Native
- TypeScript

**UI & Styling**

- React Native Paper (Material Design)

**Navigation & State**

- Expo Router
- Zustand (Client state)
- TanStack Query (Server state & caching)

**Storage & Network**

- AsyncStorage + SQLite (Local data)
- Axios

**Build & Tooling**

- EAS Build
- ESLint
- Prettier

---

## 🚀 Local Development

Minimal setup for running the frontend locally:

```bash
npm install
npx expo start
```

**Requirements**

- Node.js (LTS recommended)
- Expo CLI
- Android Emulator or physical Android device (Recommended due to the Android-first development approach)

---

## 📂 Project Structure

```text
app/            # Expo Router pages and layouts
components/     # Reusable UI components (common, note, search, etc.)
services/       # API communication and local database layer
hooks/          # Custom React hooks (including TanStack Query hooks)
store/          # Zustand state management
utils/          # Helper utilities and data sanitization
constants/      # App constants and configurations
i18n/           # Internationalization (zh/en)
```

«Structure may evolve as the project grows.»

---

## 🔄 Version

**Current version:** v0.2.0

**Latest Updates:**

- 📐 Expanded math formula rendering coverage across note content
- 👤 Delivered MVP Profile (User Center) pages and navigation
- 📶 Landed a full offline-first notes architecture with silent sync
- 🔐 Integrated complete Auth APIs and UI flows (email verification)

---

## 🤝 Notes for Contributors

- This project is evolving rapidly in the MVP phase, prioritizing functionality over perfect UI design at this stage.
- Please keep components modular and well-typed.
- Follow existing folder conventions and the layered architecture (UI -> Hooks -> Services) when adding new features.
- **AI Assistance**: The development of this project is actively assisted by AI tools including GitHub Copilot, ChatGPT, and Claude Opus.

---

## 📌 Status

🚧 **Active MVP Development**

The frontend is functional but still under rapid iteration.
