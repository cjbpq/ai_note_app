import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/network/dio_client.dart';
import '../../core/network/api_endpoints.dart';
import '../models/note_model.dart';

/// Provider for NotesApi
final notesApiProvider = Provider<NotesApi>((ref) {
  return NotesApi(ref.watch(dioProvider));
});

/// Notes API data source
class NotesApi {
  final Dio _dio;

  NotesApi(this._dio);

  /// Get notes list with pagination
  Future<NoteListResponse> getNotes({
    int skip = 0,
    int limit = 20,
    String? category,
    bool? isFavorite,
  }) async {
    final queryParams = <String, dynamic>{
      'skip': skip,
      'limit': limit,
    };
    if (category != null) queryParams['category'] = category;
    if (isFavorite != null) queryParams['is_favorite'] = isFavorite;

    final response = await _dio.get(
      ApiEndpoints.notes,
      queryParameters: queryParams,
    );
    return NoteListResponse.fromJson(response.data);
  }

  /// Get note detail by ID
  Future<NoteModel> getNoteDetail(String id) async {
    final response = await _dio.get(ApiEndpoints.noteDetail(id));
    return NoteModel.fromJson(response.data);
  }

  /// Update note
  Future<NoteModel> updateNote(String id, NoteUpdateRequest request) async {
    final response = await _dio.put(
      ApiEndpoints.noteDetail(id),
      data: request.toJson(),
    );
    return NoteModel.fromJson(response.data);
  }

  /// Delete note
  Future<void> deleteNote(String id) async {
    await _dio.delete(ApiEndpoints.noteDetail(id));
  }

  /// Toggle favorite status
  Future<NoteModel> toggleFavorite(String id) async {
    final response = await _dio.post(ApiEndpoints.noteFavorite(id));
    return NoteModel.fromJson(response.data);
  }

  /// Search notes
  Future<NoteListResponse> searchNotes({
    required String query,
    String? category,
    int skip = 0,
    int limit = 20,
  }) async {
    final queryParams = <String, dynamic>{
      'q': query,
      'skip': skip,
      'limit': limit,
    };
    if (category != null) queryParams['category'] = category;

    final response = await _dio.get(
      ApiEndpoints.search,
      queryParameters: queryParams,
    );
    return NoteListResponse.fromJson(response.data);
  }

  /// Get categories
  Future<List<String>> getCategories() async {
    final response = await _dio.get(ApiEndpoints.categories);
    return List<String>.from(response.data);
  }
}
