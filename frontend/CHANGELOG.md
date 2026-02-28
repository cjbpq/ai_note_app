# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] - 2026-02-28

### Added

- **Favorites UI**: Introduced a dedicated "My Favorites" list page accessible via the settings menu, reusing the existing note card components.
- **Offline Mode (Phase B)**: Implemented initial local offline capabilities.
  - Added support for offline writing operations, including edit, delete, and favorite actions.
  - Implemented an automatic background sync engine (`syncEngine.ts`) to seamlessly replay offline actions upon network recovery.
  - Added global offline banner and unified UI state indicators to reflect real-time network connectivity and syncing progress.

### Changed

- **Database Cache Strategy**: Migrated to a smart incremental merge strategy for local SQLite queries to preserve detailed rich data (including multiple images and structured content) across independent sessions smoothly.
- **Improved Networking Architecture**: Integrated a centralized network store using `@react-native-community/netinfo` to skip API requests dynamically when navigating offline.

### Fixed

- **Data Integrity Issues**: Resolved various data overwrites and caching bugs associated with list navigation and note favorite toggles to ensure data reliability under extreme offline conditions.

## [0.1.0] - 2026-02-25

### Added

- **Multi-Image Upload & Display**: Support for selecting and uploading multiple images concurrently. Added an image carousel for note details and a full-screen image viewer with pinch-to-zoom capabilities.
- **Local Search Capability**: Completely revamped the search functionality to utilize local memory filtering (JS Pipeline) instead of backend API calls, significantly improving search speed and responsiveness.
- **Search History**: Added local search history tracking, saving recently clicked search results for quick access.
- **Category System (MVP)**: Introduced a basic category management system.
  - Added a sidebar (Drawer) in the reading view for easy category filtering.
  - Added a category picker during the note upload process, supporting the creation of new local categories.
  - Added a filter summary bar in the search view to clearly display active filters.
- **Photo Cropping**: Added a mode selection for image picking, allowing free cropping for Android devices and original image upload options.

### Changed

- **Edit Mode Experience**: Redesigned the note editing experience (Plan B). Metadata (title, category, tags, summary, key points) is now editable, while AI-generated sections and advice remain read-only to ensure data consistency.
- **Search UI**: Simplified the search state machine from 6 states to 3 states (idle/results/empty) and optimized the filter chips layout.
- **Data Normalization**: Implemented a robust defensive programming strategy (`safe-data-guard`) across the Service and UI layers to normalize unpredictable backend data (arrays, sections) and prevent app crashes.

### Fixed

- **Favorite Icon Display**: Fixed a bug where the favorite (heart) icon was not displaying correctly when a note had no images.
- **Theme Consistency**: Fixed an issue where the bottom tab bar on the login/register screens did not sync with the dark mode toggle.
- **Auth Transitions**: Smoothed out the transition animations between login and register screens, fixing a white flash issue in dark mode.

---

_Note: This is the initial documented version for the MVP phase. Previous foundational work (API integration, basic UI, authentication, math rendering, etc.) is considered part of the baseline for this release._
