import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../datasources/upload_api.dart';
import '../models/upload_job_model.dart';
import '../models/note_model.dart';

/// Provider for UploadRepository
final uploadRepositoryProvider = Provider<UploadRepository>((ref) {
  return UploadRepository(ref.watch(uploadApiProvider));
});

/// Upload repository - handles upload business logic
class UploadRepository {
  final UploadApi _uploadApi;

  UploadRepository(this._uploadApi);

  /// Upload image and return job ID
  Future<String> uploadImage(String filePath) async {
    final response = await _uploadApi.uploadImage(filePath);
    return response.jobId;
  }

  /// Get current job status
  Future<UploadJobModel> getJobStatus(String jobId) async {
    return await _uploadApi.getJobStatus(jobId);
  }

  /// Watch job progress as stream
  Stream<UploadJobModel> watchJobProgress(String jobId) {
    return _uploadApi.watchJobProgress(jobId);
  }

  /// Get note after upload complete
  Future<NoteModel> getNoteDetail(String noteId) async {
    return await _uploadApi.getNoteDetail(noteId);
  }
}
