import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/models/upload_job_model.dart';
import '../data/models/note_model.dart';
import '../data/repositories/upload_repository.dart';

/// Upload state
class UploadState {
  final UploadJobModel? currentJob;
  final NoteModel? completedNote;
  final bool isUploading;
  final String? error;

  const UploadState({
    this.currentJob,
    this.completedNote,
    this.isUploading = false,
    this.error,
  });

  double get progress => currentJob?.status.progress ?? 0.0;
  String get statusText => currentJob?.status.displayName ?? '';
  bool get isComplete => currentJob?.status.isComplete ?? false;
  bool get isFailed => currentJob?.status.isFailed ?? false;

  UploadState copyWith({
    UploadJobModel? currentJob,
    NoteModel? completedNote,
    bool? isUploading,
    String? error,
    bool clearJob = false,
    bool clearNote = false,
    bool clearError = false,
  }) {
    return UploadState(
      currentJob: clearJob ? null : (currentJob ?? this.currentJob),
      completedNote: clearNote ? null : (completedNote ?? this.completedNote),
      isUploading: isUploading ?? this.isUploading,
      error: clearError ? null : (error ?? this.error),
    );
  }
}

/// Upload notifier - manages upload state and SSE progress
class UploadNotifier extends StateNotifier<UploadState> {
  final UploadRepository _repository;
  StreamSubscription? _progressSubscription;

  UploadNotifier(this._repository) : super(const UploadState());

  /// Upload image and start watching progress
  Future<void> uploadImage(String filePath) async {
    // Cancel any existing subscription
    await _progressSubscription?.cancel();

    state = state.copyWith(
      isUploading: true,
      clearJob: true,
      clearNote: true,
      clearError: true,
    );

    try {
      // Start upload
      final jobId = await _repository.uploadImage(filePath);

      // Initial status
      state = state.copyWith(
        currentJob: UploadJobModel(
          jobId: jobId,
          status: JobStatus.received,
        ),
      );

      // Watch progress via SSE
      _progressSubscription = _repository.watchJobProgress(jobId).listen(
        (job) async {
          state = state.copyWith(currentJob: job);

          // If completed, fetch the note
          if (job.status.isComplete && job.noteId != null) {
            try {
              final note = await _repository.getNoteDetail(job.noteId!);
              state = state.copyWith(
                completedNote: note,
                isUploading: false,
              );
            } catch (e) {
              state = state.copyWith(
                isUploading: false,
                error: 'Failed to load note: $e',
              );
            }
          } else if (job.status.isFailed) {
            state = state.copyWith(
              isUploading: false,
              error: job.message ?? 'Upload failed',
            );
          }
        },
        onError: (error) {
          state = state.copyWith(
            isUploading: false,
            error: error.toString(),
          );
        },
        onDone: () {
          // If stream ends without completion, try polling
          if (!state.isComplete && !state.isFailed) {
            _pollJobStatus(jobId);
          }
        },
      );
    } catch (e) {
      state = state.copyWith(
        isUploading: false,
        error: e.toString(),
      );
    }
  }

  /// Poll job status as fallback
  Future<void> _pollJobStatus(String jobId) async {
    try {
      while (!state.isComplete && !state.isFailed && state.isUploading) {
        await Future.delayed(const Duration(seconds: 2));

        final job = await _repository.getJobStatus(jobId);
        state = state.copyWith(currentJob: job);

        if (job.status.isComplete && job.noteId != null) {
          final note = await _repository.getNoteDetail(job.noteId!);
          state = state.copyWith(
            completedNote: note,
            isUploading: false,
          );
          break;
        } else if (job.status.isFailed) {
          state = state.copyWith(
            isUploading: false,
            error: job.message ?? 'Upload failed',
          );
          break;
        }
      }
    } catch (e) {
      state = state.copyWith(
        isUploading: false,
        error: e.toString(),
      );
    }
  }

  /// Reset upload state
  void reset() {
    _progressSubscription?.cancel();
    state = const UploadState();
  }

  /// Clear error
  void clearError() {
    state = state.copyWith(clearError: true);
  }

  @override
  void dispose() {
    _progressSubscription?.cancel();
    super.dispose();
  }
}

/// Upload provider
final uploadProvider =
    StateNotifierProvider<UploadNotifier, UploadState>((ref) {
  return UploadNotifier(ref.watch(uploadRepositoryProvider));
});
