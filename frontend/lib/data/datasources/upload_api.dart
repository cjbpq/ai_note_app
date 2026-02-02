import 'dart:async';
import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:http/http.dart' as http;
import '../../config/app_config.dart';
import '../../core/network/dio_client.dart';
import '../../core/network/api_endpoints.dart';
import '../../core/storage/secure_storage.dart';
import '../models/upload_job_model.dart';
import '../models/note_model.dart';

/// Provider for UploadApi
final uploadApiProvider = Provider<UploadApi>((ref) {
  return UploadApi(
    ref.watch(dioProvider),
    ref.watch(tokenStorageProvider),
  );
});

/// Upload API data source with SSE support
class UploadApi {
  final Dio _dio;
  final TokenStorage _tokenStorage;

  UploadApi(this._dio, this._tokenStorage);

  /// Upload image and get job ID
  Future<UploadResponse> uploadImage(String filePath) async {
    final formData = FormData.fromMap({
      'file': await MultipartFile.fromFile(filePath),
    });

    final response = await _dio.post(
      ApiEndpoints.uploadImage,
      data: formData,
      options: Options(
        contentType: 'multipart/form-data',
      ),
    );

    return UploadResponse.fromJson(response.data);
  }

  /// Get job status once
  Future<UploadJobModel> getJobStatus(String jobId) async {
    final response = await _dio.get(ApiEndpoints.jobStatus(jobId));
    return UploadJobModel.fromJson(response.data);
  }

  /// Watch job progress via SSE stream
  Stream<UploadJobModel> watchJobProgress(String jobId) async* {
    final token = await _tokenStorage.getToken();
    final url = '${AppConfig.apiBaseUrl}${ApiEndpoints.jobStream(jobId)}';

    final client = http.Client();
    try {
      final request = http.Request('GET', Uri.parse(url));
      request.headers['Authorization'] = 'Bearer $token';
      request.headers['Accept'] = 'text/event-stream';
      request.headers['Cache-Control'] = 'no-cache';

      final response = await client.send(request);

      if (response.statusCode != 200) {
        throw Exception('SSE connection failed: ${response.statusCode}');
      }

      await for (final chunk in response.stream.transform(utf8.decoder)) {
        final lines = chunk.split('\n');
        for (final line in lines) {
          if (line.startsWith('data: ')) {
            try {
              final jsonStr = line.substring(6).trim();
              if (jsonStr.isNotEmpty && jsonStr != '[DONE]') {
                final json = jsonDecode(jsonStr);
                yield UploadJobModel.fromJson(json);
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    } finally {
      client.close();
    }
  }

  /// Get note detail after upload complete
  Future<NoteModel> getNoteDetail(String noteId) async {
    final response = await _dio.get(ApiEndpoints.noteDetail(noteId));
    return NoteModel.fromJson(response.data);
  }
}
