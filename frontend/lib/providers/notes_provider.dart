import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/models/note_model.dart';
import '../data/repositories/notes_repository.dart';

/// Note edit mode enum - represents the three editing modes
enum NoteEditMode {
  /// Preview mode - read-only, renders Markdown with LaTeX
  preview,
  /// WYSIWYG mode - rich text editing with flutter_quill
  wysiwyg,
  /// Source mode - raw Markdown text editing
  source,
}

/// Notes list state
class NotesListState {
  final List<NoteModel> notes;
  final int total;
  final bool isLoading;
  final bool isLoadingMore;
  final bool hasMore;
  final String? error;
  final String? selectedCategory;
  final bool isOffline;
  final DateTime? lastSyncTime;

  const NotesListState({
    this.notes = const [],
    this.total = 0,
    this.isLoading = false,
    this.isLoadingMore = false,
    this.hasMore = true,
    this.error,
    this.selectedCategory,
    this.isOffline = false,
    this.lastSyncTime,
  });

  NotesListState copyWith({
    List<NoteModel>? notes,
    int? total,
    bool? isLoading,
    bool? isLoadingMore,
    bool? hasMore,
    String? error,
    String? selectedCategory,
    bool clearError = false,
    bool clearCategory = false,
    bool? isOffline,
    DateTime? lastSyncTime,
  }) {
    return NotesListState(
      notes: notes ?? this.notes,
      total: total ?? this.total,
      isLoading: isLoading ?? this.isLoading,
      isLoadingMore: isLoadingMore ?? this.isLoadingMore,
      hasMore: hasMore ?? this.hasMore,
      error: clearError ? null : (error ?? this.error),
      selectedCategory: clearCategory ? null : (selectedCategory ?? this.selectedCategory),
      isOffline: isOffline ?? this.isOffline,
      lastSyncTime: lastSyncTime ?? this.lastSyncTime,
    );
  }
}

/// Notes list notifier with pagination
class NotesListNotifier extends StateNotifier<NotesListState> {
  final NotesRepository _repository;
  static const int _pageSize = 20;

  NotesListNotifier(this._repository) : super(const NotesListState());

  /// Load initial notes (cache-first strategy for better UX)
  Future<void> loadNotes({String? category, bool refresh = false}) async {
    if (state.isLoading && !refresh) return;

    // 如果不是强制刷新，先尝试显示缓存
    if (!refresh && state.notes.isEmpty) {
      await _loadCacheFirst(category);
    } else {
      // 强制刷新或已有数据时，直接从网络加载
      await _loadFromNetwork(category, showLoading: refresh || state.notes.isEmpty);
    }
  }

  /// 缓存优先策略：先显示缓存，再后台刷新
  Future<void> _loadCacheFirst(String? category) async {
    state = state.copyWith(
      isLoading: true,
      clearError: true,
      selectedCategory: category,
      clearCategory: category == null,
    );

    // 1. 先尝试加载缓存
    try {
      final cachedNotes = await _repository.getCachedNotes();
      final lastSync = await _repository.getLastSyncTime();

      // 过滤分类
      final filteredNotes = category == null
          ? cachedNotes
          : cachedNotes.where((n) => n.category == category).toList();

      if (filteredNotes.isNotEmpty) {
        // 立即显示缓存数据
        state = state.copyWith(
          notes: filteredNotes,
          total: filteredNotes.length,
          isLoading: false,
          hasMore: false,
          lastSyncTime: lastSync,
        );

        // 2. 后台静默刷新网络数据
        _silentRefresh(category);
        return;
      }
    } catch (e) {
      // 缓存读取失败，继续尝试网络
    }

    // 没有缓存，从网络加载
    await _loadFromNetwork(category, showLoading: true);
  }

  /// 从网络加载数据
  Future<void> _loadFromNetwork(String? category, {bool showLoading = true}) async {
    if (showLoading) {
      state = state.copyWith(
        isLoading: true,
        clearError: true,
        selectedCategory: category,
        clearCategory: category == null,
      );
    }

    try {
      final response = await _repository.getNotes(
        skip: 0,
        limit: _pageSize,
        category: category,
      );

      final lastSync = await _repository.getLastSyncTime();

      state = state.copyWith(
        notes: response.notes,
        total: response.total,
        isLoading: false,
        hasMore: response.notes.length < response.total,
        isOffline: false,
        lastSyncTime: lastSync,
      );
    } catch (e) {
      // 网络失败，尝试加载缓存
      await _loadFromCache(category);
    }
  }

  /// 后台静默刷新（不显示loading）
  Future<void> _silentRefresh(String? category) async {
    try {
      final response = await _repository.getNotes(
        skip: 0,
        limit: _pageSize,
        category: category,
      );

      final lastSync = await _repository.getLastSyncTime();

      // 只有数据有变化时才更新
      if (response.notes.isNotEmpty) {
        state = state.copyWith(
          notes: response.notes,
          total: response.total,
          hasMore: response.notes.length < response.total,
          isOffline: false,
          lastSyncTime: lastSync,
        );
      }
    } catch (e) {
      // 静默刷新失败，保持当前缓存数据，不显示错误
      state = state.copyWith(isOffline: true);
    }
  }

  /// Load from cache (offline mode)
  Future<void> _loadFromCache(String? category) async {
    try {
      final cachedNotes = await _repository.getCachedNotes();
      final lastSync = await _repository.getLastSyncTime();

      // Filter by category if needed
      final filteredNotes = category == null
          ? cachedNotes
          : cachedNotes.where((n) => n.category == category).toList();

      if (filteredNotes.isNotEmpty) {
        state = state.copyWith(
          notes: filteredNotes,
          total: filteredNotes.length,
          isLoading: false,
          hasMore: false, // No pagination in offline mode
          isOffline: true,
          lastSyncTime: lastSync,
        );
      } else {
        state = state.copyWith(
          isLoading: false,
          error: 'offline_no_cache',
          isOffline: true,
        );
      }
    } catch (cacheError) {
      state = state.copyWith(
        isLoading: false,
        error: cacheError.toString(),
        isOffline: true,
      );
    }
  }

  /// Load more notes (pagination)
  Future<void> loadMore() async {
    if (state.isLoadingMore || !state.hasMore) return;

    state = state.copyWith(isLoadingMore: true);

    try {
      final response = await _repository.getNotes(
        skip: state.notes.length,
        limit: _pageSize,
        category: state.selectedCategory,
      );

      final allNotes = [...state.notes, ...response.notes];
      state = state.copyWith(
        notes: allNotes,
        isLoadingMore: false,
        hasMore: allNotes.length < response.total,
      );
    } catch (e) {
      state = state.copyWith(
        isLoadingMore: false,
        error: e.toString(),
      );
    }
  }

  /// Refresh notes
  Future<void> refresh() async {
    await loadNotes(category: state.selectedCategory, refresh: true);
  }

  /// Toggle favorite for a note
  Future<void> toggleFavorite(String noteId) async {
    try {
      final updatedNote = await _repository.toggleFavorite(noteId);
      final notes = state.notes.map((note) {
        return note.id == noteId ? updatedNote : note;
      }).toList();
      state = state.copyWith(notes: notes);
    } catch (e) {
      state = state.copyWith(error: e.toString());
    }
  }

  /// Delete a note
  Future<bool> deleteNote(String noteId) async {
    try {
      await _repository.deleteNote(noteId);
      final notes = state.notes.where((note) => note.id != noteId).toList();
      state = state.copyWith(
        notes: notes,
        total: state.total - 1,
      );
      return true;
    } catch (e) {
      state = state.copyWith(error: e.toString());
      return false;
    }
  }

  /// Update note in list
  void updateNoteInList(NoteModel updatedNote) {
    final notes = state.notes.map((note) {
      return note.id == updatedNote.id ? updatedNote : note;
    }).toList();
    state = state.copyWith(notes: notes);
  }

  /// Add note to list (after upload)
  Future<void> addNote(NoteModel note) async {
    // Also add to cache
    await _repository.addNoteToCache(note);

    state = state.copyWith(
      notes: [note, ...state.notes],
      total: state.total + 1,
    );
  }
}

/// Notes list provider
final notesListProvider =
    StateNotifierProvider<NotesListNotifier, NotesListState>((ref) {
  return NotesListNotifier(ref.watch(notesRepositoryProvider));
});

/// Note detail state
class NoteDetailState {
  final NoteModel? note;
  final bool isLoading;
  final String? error;
  final bool isOffline;

  const NoteDetailState({
    this.note,
    this.isLoading = false,
    this.error,
    this.isOffline = false,
  });

  NoteDetailState copyWith({
    NoteModel? note,
    bool? isLoading,
    String? error,
    bool clearError = false,
    bool? isOffline,
  }) {
    return NoteDetailState(
      note: note ?? this.note,
      isLoading: isLoading ?? this.isLoading,
      error: clearError ? null : (error ?? this.error),
      isOffline: isOffline ?? this.isOffline,
    );
  }
}

/// Note detail notifier
class NoteDetailNotifier extends StateNotifier<NoteDetailState> {
  final NotesRepository _repository;

  NoteDetailNotifier(this._repository) : super(const NoteDetailState());

  /// Load note detail (cache-first strategy for instant display)
  Future<void> loadNote(String id) async {
    // 1. 先尝试从缓存加载，立即显示
    try {
      final cachedNote = await _repository.getCachedNote(id);
      if (cachedNote != null) {
        // 立即显示缓存数据，不需要 loading
        state = state.copyWith(
          note: cachedNote,
          isLoading: false,
          isOffline: false,
          clearError: true,
        );
        // 后台静默刷新（可选，因为列表数据通常已是最新的）
        _silentRefresh(id);
        return;
      }
    } catch (e) {
      // 缓存读取失败，继续尝试网络
    }

    // 2. 没有缓存，从网络加载（显示 loading）
    state = state.copyWith(isLoading: true, clearError: true);

    try {
      final note = await _repository.getNoteDetail(id);
      state = state.copyWith(note: note, isLoading: false, isOffline: false);
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: e.toString(),
        isOffline: true,
      );
    }
  }

  /// 后台静默刷新（不影响用户体验）
  Future<void> _silentRefresh(String id) async {
    try {
      final note = await _repository.getNoteDetail(id);
      // 只有数据有变化时才更新
      if (mounted) {
        state = state.copyWith(note: note, isOffline: false);
      }
    } catch (e) {
      // 静默刷新失败，不显示错误，保持当前缓存数据
      if (mounted) {
        state = state.copyWith(isOffline: true);
      }
    }
  }

  /// Update note
  Future<bool> updateNote({
    String? title,
    String? category,
    List<String>? tags,
    String? originalText,
    Map<String, dynamic>? structuredData,
  }) async {
    if (state.note == null) return false;

    state = state.copyWith(isLoading: true, clearError: true);

    try {
      final updatedNote = await _repository.updateNote(
        state.note!.id,
        title: title,
        category: category,
        tags: tags,
        originalText: originalText,
        structuredData: structuredData,
      );
      state = state.copyWith(note: updatedNote, isLoading: false);
      return true;
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
      return false;
    }
  }

  /// Toggle favorite
  Future<void> toggleFavorite() async {
    if (state.note == null) return;

    try {
      final updatedNote = await _repository.toggleFavorite(state.note!.id);
      state = state.copyWith(note: updatedNote);
    } catch (e) {
      state = state.copyWith(error: e.toString());
    }
  }
}

/// Note detail provider family
final noteDetailProvider =
    StateNotifierProvider.family<NoteDetailNotifier, NoteDetailState, String>(
        (ref, noteId) {
  final notifier = NoteDetailNotifier(ref.watch(notesRepositoryProvider));
  notifier.loadNote(noteId);
  return notifier;
});

/// Categories provider
final categoriesProvider = FutureProvider<List<String>>((ref) async {
  final repository = ref.watch(notesRepositoryProvider);
  return await repository.getCategories();
});

/// Search history state notifier
class SearchHistoryNotifier extends StateNotifier<List<String>> {
  final NotesRepository _repository;

  SearchHistoryNotifier(this._repository) : super([]);

  /// Load search history
  Future<void> load() async {
    state = await _repository.getSearchHistory();
  }

  /// Clear all history
  Future<void> clearAll() async {
    await _repository.clearSearchHistory();
    state = [];
  }

  /// Remove single item
  Future<void> remove(String query) async {
    await _repository.removeSearchHistoryItem(query);
    state = state.where((q) => q != query).toList();
  }

  /// Add item (called after search)
  void addItem(String query) {
    if (query.trim().isEmpty) return;
    state = [query, ...state.where((q) => q != query)].take(10).toList();
  }
}

/// Search history provider
final searchHistoryProvider =
    StateNotifierProvider<SearchHistoryNotifier, List<String>>((ref) {
  return SearchHistoryNotifier(ref.watch(notesRepositoryProvider));
});

/// Search state
class SearchState {
  final List<NoteModel> results;
  final bool isLoading;
  final String? error;
  final String? query;
  final String? category;
  final int total;
  final bool hasMore;

  const SearchState({
    this.results = const [],
    this.isLoading = false,
    this.error,
    this.query,
    this.category,
    this.total = 0,
    this.hasMore = false,
  });

  SearchState copyWith({
    List<NoteModel>? results,
    bool? isLoading,
    String? error,
    String? query,
    String? category,
    int? total,
    bool? hasMore,
    bool clearError = false,
    bool clearQuery = false,
    bool clearCategory = false,
  }) {
    return SearchState(
      results: results ?? this.results,
      isLoading: isLoading ?? this.isLoading,
      error: clearError ? null : (error ?? this.error),
      query: clearQuery ? null : (query ?? this.query),
      category: clearCategory ? null : (category ?? this.category),
      total: total ?? this.total,
      hasMore: hasMore ?? this.hasMore,
    );
  }
}

/// Search notifier
class SearchNotifier extends StateNotifier<SearchState> {
  final NotesRepository _repository;
  static const int _pageSize = 20;

  SearchNotifier(this._repository) : super(const SearchState());

  /// Search notes
  Future<void> search(String query, {String? category}) async {
    if (query.trim().isEmpty) {
      state = const SearchState();
      return;
    }

    state = state.copyWith(
      isLoading: true,
      clearError: true,
      query: query,
      category: category,
      clearCategory: category == null,
    );

    try {
      final response = await _repository.searchNotes(
        query: query,
        category: category,
        skip: 0,
        limit: _pageSize,
      );

      state = state.copyWith(
        results: response.notes,
        total: response.total,
        isLoading: false,
        hasMore: response.notes.length < response.total,
      );
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: e.toString(),
      );
    }
  }

  /// Load more results
  Future<void> loadMore() async {
    if (state.isLoading || !state.hasMore || state.query == null) return;

    state = state.copyWith(isLoading: true);

    try {
      final response = await _repository.searchNotes(
        query: state.query!,
        category: state.category,
        skip: state.results.length,
        limit: _pageSize,
      );

      final allResults = [...state.results, ...response.notes];
      state = state.copyWith(
        results: allResults,
        isLoading: false,
        hasMore: allResults.length < response.total,
      );
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: e.toString(),
      );
    }
  }

  /// Clear search
  void clear() {
    state = const SearchState();
  }
}

/// Search provider
final searchProvider = StateNotifierProvider<SearchNotifier, SearchState>((ref) {
  return SearchNotifier(ref.watch(notesRepositoryProvider));
});

/// Note edit mode state - tracks the current editing mode for a note
class NoteEditModeState {
  final NoteEditMode mode;
  final bool hasUnsavedChanges;
  final String? editingContent; // Current content being edited

  const NoteEditModeState({
    this.mode = NoteEditMode.preview,
    this.hasUnsavedChanges = false,
    this.editingContent,
  });

  NoteEditModeState copyWith({
    NoteEditMode? mode,
    bool? hasUnsavedChanges,
    String? editingContent,
    bool clearContent = false,
  }) {
    return NoteEditModeState(
      mode: mode ?? this.mode,
      hasUnsavedChanges: hasUnsavedChanges ?? this.hasUnsavedChanges,
      editingContent: clearContent ? null : (editingContent ?? this.editingContent),
    );
  }

  /// Check if currently in any editing mode
  bool get isEditing => mode != NoteEditMode.preview;
}

/// Note edit mode notifier - manages editing state for a specific note
class NoteEditModeNotifier extends StateNotifier<NoteEditModeState> {
  NoteEditModeNotifier() : super(const NoteEditModeState());

  /// Switch to preview mode
  void setPreviewMode() {
    state = state.copyWith(mode: NoteEditMode.preview);
  }

  /// Switch to WYSIWYG editing mode
  void setWysiwygMode() {
    state = state.copyWith(mode: NoteEditMode.wysiwyg);
  }

  /// Switch to source (Markdown) editing mode
  void setSourceMode() {
    state = state.copyWith(mode: NoteEditMode.source);
  }

  /// Update the editing content
  void updateContent(String content) {
    state = state.copyWith(
      editingContent: content,
      hasUnsavedChanges: true,
    );
  }

  /// Mark changes as saved
  void markSaved() {
    state = state.copyWith(hasUnsavedChanges: false);
  }

  /// Reset to initial state (preview mode, no changes)
  void reset() {
    state = const NoteEditModeState();
  }

  /// Initialize with content (when entering edit mode)
  void initializeWithContent(String content) {
    state = state.copyWith(
      editingContent: content,
      hasUnsavedChanges: false,
    );
  }
}

/// Note edit mode provider - family provider keyed by note ID
final noteEditModeProvider = StateNotifierProvider.family<NoteEditModeNotifier, NoteEditModeState, String>(
  (ref, noteId) => NoteEditModeNotifier(),
);
