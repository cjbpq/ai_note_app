# AGENTS.md

## Project

SnapNote / 邮雁智记 frontend is an Expo SDK 54 mobile app built with React Native, TypeScript, Expo Router, React Native Paper, Zustand, TanStack Query, Axios, AsyncStorage, and SQLite.

The product is an Android-first smart note MVP. The core flow is:

1. Capture or select note images.
2. Upload them to the backend AI pipeline.
3. Poll for generated structured notes.
4. Read, edit, favorite, search, categorize, and cache notes locally.

## Maintainer Context

The maintainer is learning frontend engineering and prefers solutions that are easy to understand, maintain, and debug. When a decision affects long-term maintainability, explain the tradeoff briefly and give a clear recommendation.

For implementation tasks, edit the project files directly after the plan is accepted. Avoid large example-only answers when the user has asked for execution.

## Default Workflow

Before coding:

1. Read `LOG/TODO.md` for current active work.
2. Read the latest relevant entries in `LOG/DEV_LOG.md`, `LOG/ROADMAP.md`, or `LOG/History.md` when the task touches existing product decisions.
3. Inspect existing `hooks/`, `services/`, `store/`, and related UI components for the touched module.
4. For larger tasks, present a short layered plan before editing.

During coding:

- Prefer small, coherent changes that follow existing project patterns.
- Do not create duplicate business logic when a hook, service, store, or utility already exists.
- Keep user-facing text in i18n files.
- Keep colors and UI state tied to React Native Paper theme and the project theme system.
- Use key comments for non-obvious logic, especially sync, caching, auth, and data normalization paths.

After coding:

- Run `npm.cmd run lint` when possible.
- Update `LOG/TODO.md` when a tracked task was completed or when the work creates an important follow-up.
- Add or update development logs only when the user asks for logging/release work, or when a substantial tracked milestone is completed.
- Report Android/iOS compatibility notes for mobile-impacting changes.

## Architecture Rules

The project uses strict one-way layering:

1. UI layer: `app/` and `components/`
   - Renders screens and handles interaction.
   - Must not call Axios directly.
   - Must not execute raw SQLite queries.
   - Gets data through custom hooks.

2. Hooks layer: `hooks/`
   - Acts as the ViewModel between UI and services.
   - Uses TanStack Query for server state, caching, mutations, and invalidation.
   - Triggers toast/snackbar feedback when appropriate.

3. Service layer: `services/`
   - Owns API calls, SQLite access, data mapping, and backend error parsing.
   - Produces UI-safe domain data and `ServiceError` where applicable.
   - Keeps functions stateless and async.

4. Store layer: `store/`
   - Uses Zustand for client-only state such as auth state, UI preferences, upload task state, theme mode, toast queue, and transient edit state.
   - Must not become the source of truth for server business data that belongs in TanStack Query.

5. Types:
   - Shared business interfaces live in `types/index.ts` by default.
   - Local-only helper types are allowed when keeping them local improves readability and they do not leak across modules.

## Data Safety

Treat API responses, AsyncStorage data, SQLite rows, route params, and drafts as untrusted input.

Use `utils/safeData.ts` before UI rendering when handling data that may drift in shape, especially:

- `structuredData`
- `sections`
- `tags`
- `warnings`
- `keyPoints`
- any value used with `map`, `filter`, `spread`, or `.length`

Preferred helpers:

- `toSafeStringArray`
- `toOptionalSafeStringArray`
- `toSafeSections`
- `toOptionalSafeSections`

Do not copy repeated `Array.isArray(...)` normalization logic across screens. Put reusable normalization in `utils/safeData.ts` or the service mapping layer.

## API And Errors

Any API-facing change must include an error strategy.

Expected layering:

- Service: parse backend/network errors into friendly messages, i18n keys, or `ServiceError`.
- Hooks: expose React Query status and trigger toast/snackbar when needed.
- UI: show state and actions only; avoid scattered `try/catch`.

Common mapping:

- Network unavailable or timeout: `error.network.unavailable` / `error.network.timeout`
- 401: `error.auth.unauthorized`, usually clear auth and guide to login
- 403: `error.auth.forbidden`
- 404: `error.common.notFound`
- 409: `error.common.conflict`
- 422: `error.validation.invalid`
- 429: `error.common.rateLimited`
- 5xx: `error.server.unavailable`
- Unknown: `error.common.unknown`

If a user-facing string is added, add keys to both `i18n/zh.ts` and `i18n/en.ts`.

## Expo And Mobile Rules

- Android is the primary test target; keep iOS-compatible code unless a platform difference is explicitly accepted.
- Prefer Expo-managed configuration and plugins over manual native edits.
- Do not add native dependencies, prebuild requirements, or EAS-only workflows without explaining the maintenance cost.
- Use Expo Go or `expo start` for the default local development loop.
- Keep EAS build and store submission as explicit release operations, not default local run actions.
- For image, camera, WebView, SQLite, permissions, and navigation work, call out platform differences before implementation.

## UI Rules

- Use React Native Paper and project theme tokens.
- Keep hardcoded colors out of components unless there is a documented reason.
- Use `StyleSheet.create` for reusable styles, matching the existing codebase.
- Avoid hardcoded Chinese UI copy in components; use i18n.
- Build defensive loading, empty, and error states for user-facing flows.

## Project Records

`LOG/TODO.md` is the active task board.

`LOG/DEV_LOG.md` is the readable development summary.

`LOG/History.md` is the detailed archive.

When the user asks to close a development session or sync logs, use this flow:

1. Read `LOG/TODO.md`, `LOG/DEV_LOG.md`, and `LOG/History.md`.
2. Extract completed `[x]` items, preferably with `✅ YYYY-MM-DD`.
3. Avoid duplicate DEV_LOG/History entries.
4. Write a concise DEV_LOG summary with decisions, architecture placement, compatibility, and follow-ups.
5. Archive detailed completed items in History.
6. Keep TODO focused on active and future work.

## Version Release Flow

When preparing a version release:

1. Update `CHANGELOG.md` with a new Keep a Changelog style entry.
2. Update the README version and latest updates.
3. Update `package.json` version without a `v` prefix.
4. Keep release notes user-facing and concise.
5. Do not rewrite older changelog entries.

## Commands

Use Windows-safe npm commands in this workspace:

- Install: `npm.cmd install`
- Start Expo: `npm.cmd run start`
- Start Android: `npm.cmd run android`
- Start iOS: `npm.cmd run ios`
- Start Web: `npm.cmd run web`
- Lint: `npm.cmd run lint`
- Generate math assets: `npm.cmd run generate:math-assets`

Avoid plain `npm` in PowerShell because `npm.ps1` may be blocked by execution policy.

## Git And Safety

- Do not revert user changes unless the user explicitly asks.
- Do not run destructive git commands without explicit approval.
- Keep generated changes scoped to the requested task.
- Preserve existing Android-first MVP decisions unless the user decides otherwise.
