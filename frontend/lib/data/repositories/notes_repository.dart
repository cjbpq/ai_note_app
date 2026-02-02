import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../datasources/notes_api.dart';
import '../models/note_model.dart';
import '../../core/storage/local_cache.dart';

/// Provider for NotesRepository
final notesRepositoryProvider = Provider<NotesRepository>((ref) {
  return NotesRepository(
    ref.watch(notesApiProvider),
    ref.watch(localCacheProvider),
  );
});

/// Notes repository - handles notes business logic
class NotesRepository {
  final NotesApi _notesApi;
  final LocalCache _localCache;

  NotesRepository(this._notesApi, this._localCache);

  /// Get notes with pagination
  Future<NoteListResponse> getNotes({
    int skip = 0,
    int limit = 20,
    String? category,
    bool? isFavorite,
  }) async {
    final response = await _notesApi.getNotes(
      skip: skip,
      limit: limit,
      category: category,
      isFavorite: isFavorite,
    );

    // Cache first page of notes (no filter)
    if (skip == 0 && category == null && isFavorite == null) {
      await _localCache.cacheNotes(response.notes);
    }

    return response;
  }

  /// Get cached notes (for offline use)
  Future<List<NoteModel>> getCachedNotes() async {
    return await _localCache.getCachedNotes();
  }

  /// Check if cache is stale
  Future<bool> isCacheStale() async {
    return await _localCache.isCacheStale();
  }

  /// Get last sync time
  Future<DateTime?> getLastSyncTime() async {
    return await _localCache.getLastSyncTime();
  }

  /// Get note detail
  Future<NoteModel> getNoteDetail(String id) async {
    final note = await _notesApi.getNoteDetail(id);
    // Cache note detail
    await _localCache.cacheNote(note);
    return note;
  }

  /// Get cached note by ID
  Future<NoteModel?> getCachedNote(String id) async {
    return await _localCache.getCachedNote(id);
  }

  /// Update note
  Future<NoteModel> updateNote(String id, {
    String? title,
    String? category,
    List<String>? tags,
    bool? isFavorite,
    String? originalText,
    Map<String, dynamic>? structuredData,
  }) async {
    final request = NoteUpdateRequest(
      title: title,
      category: category,
      tags: tags,
      isFavorite: isFavorite,
      originalText: originalText,
      structuredData: structuredData,
    );
    final updatedNote = await _notesApi.updateNote(id, request);
    // Update cache
    await _localCache.updateCachedNote(updatedNote);
    return updatedNote;
  }

  /// Delete note
  Future<void> deleteNote(String id) async {
    await _notesApi.deleteNote(id);
    // Remove from cache
    await _localCache.removeCachedNote(id);
  }

  /// Toggle favorite
  Future<NoteModel> toggleFavorite(String id) async {
    final updatedNote = await _notesApi.toggleFavorite(id);
    // Update cache
    await _localCache.updateCachedNote(updatedNote);
    return updatedNote;
  }

  /// Add note to cache (after upload)
  Future<void> addNoteToCache(NoteModel note) async {
    await _localCache.addNoteToCache(note);
  }

  /// Search notes
  Future<NoteListResponse> searchNotes({
    required String query,
    String? category,
    int skip = 0,
    int limit = 20,
  }) async {
    // Save search to history
    await _localCache.addSearchHistory(query);

    return await _notesApi.searchNotes(
      query: query,
      category: category,
      skip: skip,
      limit: limit,
    );
  }

  /// Get search history
  Future<List<String>> getSearchHistory() async {
    return await _localCache.getSearchHistory();
  }

  /// Clear search history
  Future<void> clearSearchHistory() async {
    await _localCache.clearSearchHistory();
  }

  /// Remove search history item
  Future<void> removeSearchHistoryItem(String query) async {
    await _localCache.removeSearchHistoryItem(query);
  }

  /// Get categories
  Future<List<String>> getCategories() async {
    return await _notesApi.getCategories();
  }

  /// Clear all notes cache
  Future<void> clearNotesCache() async {
    await _localCache.clearNotesCache();
  }
}
