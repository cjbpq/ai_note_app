import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';
import '../../data/models/note_model.dart';

/// Provider for LocalCache
final localCacheProvider = Provider<LocalCache>((ref) {
  return LocalCache();
});

/// Local cache service using Hive
class LocalCache {
  static const String _notesBoxName = 'notes_cache';
  static const String _searchHistoryBoxName = 'search_history';
  static const String _notesListKey = 'notes_list';
  static const String _lastSyncKey = 'last_sync';

  Box? _notesBox;
  Box? _searchHistoryBox;

  /// Initialize cache boxes
  Future<void> init() async {
    _notesBox = await Hive.openBox(_notesBoxName);
    _searchHistoryBox = await Hive.openBox(_searchHistoryBoxName);
  }

  /// Get notes box (lazy init)
  Future<Box> get notesBox async {
    _notesBox ??= await Hive.openBox(_notesBoxName);
    return _notesBox!;
  }

  /// Get search history box (lazy init)
  Future<Box> get searchHistoryBox async {
    _searchHistoryBox ??= await Hive.openBox(_searchHistoryBoxName);
    return _searchHistoryBox!;
  }

  // ============ Notes Cache ============

  /// Cache notes list
  Future<void> cacheNotes(List<NoteModel> notes) async {
    final box = await notesBox;
    final jsonList = notes.map((n) => jsonEncode(n.toJson())).toList();
    await box.put(_notesListKey, jsonList);
    await box.put(_lastSyncKey, DateTime.now().toIso8601String());
  }

  /// Get cached notes list
  Future<List<NoteModel>> getCachedNotes() async {
    final box = await notesBox;
    final jsonList = box.get(_notesListKey) as List<dynamic>?;
    if (jsonList == null) return [];

    return jsonList.map((json) {
      final map = jsonDecode(json as String) as Map<String, dynamic>;
      return NoteModel.fromJson(map);
    }).toList();
  }

  /// Cache single note
  Future<void> cacheNote(NoteModel note) async {
    final box = await notesBox;
    await box.put('note_${note.id}', jsonEncode(note.toJson()));
  }

  /// Get cached note by ID
  Future<NoteModel?> getCachedNote(String id) async {
    final box = await notesBox;
    final json = box.get('note_$id') as String?;
    if (json == null) return null;

    final map = jsonDecode(json) as Map<String, dynamic>;
    return NoteModel.fromJson(map);
  }

  /// Remove cached note
  Future<void> removeCachedNote(String id) async {
    final box = await notesBox;
    await box.delete('note_$id');

    // Also update the list
    final notes = await getCachedNotes();
    final filtered = notes.where((n) => n.id != id).toList();
    await cacheNotes(filtered);
  }

  /// Update cached note
  Future<void> updateCachedNote(NoteModel note) async {
    await cacheNote(note);

    // Update in list
    final notes = await getCachedNotes();
    final index = notes.indexWhere((n) => n.id == note.id);
    if (index >= 0) {
      notes[index] = note;
      await cacheNotes(notes);
    }
  }

  /// Add note to cache
  Future<void> addNoteToCache(NoteModel note) async {
    await cacheNote(note);

    final notes = await getCachedNotes();
    notes.insert(0, note);
    await cacheNotes(notes);
  }

  /// Get last sync time
  Future<DateTime?> getLastSyncTime() async {
    final box = await notesBox;
    final timeStr = box.get(_lastSyncKey) as String?;
    if (timeStr == null) return null;
    return DateTime.parse(timeStr);
  }

  /// Check if cache is stale (older than 1 hour)
  Future<bool> isCacheStale() async {
    final lastSync = await getLastSyncTime();
    if (lastSync == null) return true;

    final diff = DateTime.now().difference(lastSync);
    return diff.inHours >= 1;
  }

  /// Clear notes cache
  Future<void> clearNotesCache() async {
    final box = await notesBox;
    await box.clear();
  }

  // ============ Search History ============

  /// Add search query to history
  Future<void> addSearchHistory(String query) async {
    if (query.trim().isEmpty) return;

    final box = await searchHistoryBox;
    List<String> history = getSearchHistorySync(box);

    // Remove if exists and add to front
    history.remove(query);
    history.insert(0, query);

    // Keep only last 10
    if (history.length > 10) {
      history = history.sublist(0, 10);
    }

    await box.put('history', history);
  }

  /// Get search history
  Future<List<String>> getSearchHistory() async {
    final box = await searchHistoryBox;
    return getSearchHistorySync(box);
  }

  List<String> getSearchHistorySync(Box box) {
    final history = box.get('history');
    if (history == null) return [];
    return List<String>.from(history);
  }

  /// Clear search history
  Future<void> clearSearchHistory() async {
    final box = await searchHistoryBox;
    await box.delete('history');
  }

  /// Remove single search history item
  Future<void> removeSearchHistoryItem(String query) async {
    final box = await searchHistoryBox;
    final history = getSearchHistorySync(box);
    history.remove(query);
    await box.put('history', history);
  }
}
