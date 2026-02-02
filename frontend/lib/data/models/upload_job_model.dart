import 'package:json_annotation/json_annotation.dart';

part 'upload_job_model.g.dart';

// 辅助函数：支持读取 "id" 或 "job_id" 字段
Object? _readJobId(Map<dynamic, dynamic> json, String key) {
  return json['job_id'] ?? json['id'];
}

/// Upload job status enum
enum JobStatus {
  @JsonValue('RECEIVED')
  received,
  @JsonValue('STORED')
  stored,
  @JsonValue('QUEUED')
  queued,
  @JsonValue('OCR_PENDING')
  ocrPending,
  @JsonValue('OCR_DONE')
  ocrDone,
  @JsonValue('AI_PENDING')
  aiPending,
  @JsonValue('AI_DONE')
  aiDone,
  @JsonValue('PERSISTED')
  persisted,
  @JsonValue('FAILED')
  failed,
}

/// Extension for JobStatus display
extension JobStatusExtension on JobStatus {
  String get displayName {
    switch (this) {
      case JobStatus.received:
        return '图片已接收';
      case JobStatus.stored:
        return '图片已存储';
      case JobStatus.queued:
        return '排队处理中';
      case JobStatus.ocrPending:
        return '文字识别中...';
      case JobStatus.ocrDone:
        return '文字识别完成';
      case JobStatus.aiPending:
        return 'AI 整理笔记中...';
      case JobStatus.aiDone:
        return 'AI 处理完成';
      case JobStatus.persisted:
        return '笔记已生成';
      case JobStatus.failed:
        return '处理失败';
    }
  }
  
  double get progress {
    switch (this) {
      case JobStatus.received:
        return 0.1;
      case JobStatus.stored:
        return 0.2;
      case JobStatus.queued:
        return 0.3;
      case JobStatus.ocrPending:
        return 0.4;
      case JobStatus.ocrDone:
        return 0.6;
      case JobStatus.aiPending:
        return 0.7;
      case JobStatus.aiDone:
        return 0.9;
      case JobStatus.persisted:
        return 1.0;
      case JobStatus.failed:
        return 0.0;
    }
  }
  
  bool get isComplete => this == JobStatus.persisted;
  bool get isFailed => this == JobStatus.failed;
  bool get isProcessing => !isComplete && !isFailed;
}

@JsonSerializable()
class UploadJobModel {
  // 支持后端两种格式: SSE 返回 "id"，上传接口返回 "job_id"
  @JsonKey(readValue: _readJobId)
  final String jobId;
  final JobStatus status;
  @JsonKey(name: 'note_id')
  final String? noteId;
  @JsonKey(name: 'error_logs')
  final List<dynamic>? errorLogs;
  @JsonKey(name: 'created_at')
  final DateTime? createdAt;
  @JsonKey(name: 'updated_at')
  final DateTime? updatedAt;

  UploadJobModel({
    required this.jobId,
    required this.status,
    this.noteId,
    this.errorLogs,
    this.createdAt,
    this.updatedAt,
  });

  // 从 error_logs 中提取错误消息
  String? get message {
    if (errorLogs == null || errorLogs!.isEmpty) return null;
    final lastError = errorLogs!.last;
    if (lastError is Map) {
      return lastError['error']?.toString();
    }
    return lastError.toString();
  }

  factory UploadJobModel.fromJson(Map<String, dynamic> json) =>
      _$UploadJobModelFromJson(json);
  Map<String, dynamic> toJson() => _$UploadJobModelToJson(this);
  
  UploadJobModel copyWith({
    String? jobId,
    JobStatus? status,
    String? noteId,
    List<dynamic>? errorLogs,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return UploadJobModel(
      jobId: jobId ?? this.jobId,
      status: status ?? this.status,
      noteId: noteId ?? this.noteId,
      errorLogs: errorLogs ?? this.errorLogs,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}

@JsonSerializable()
class UploadResponse {
  @JsonKey(name: 'job_id')
  final String jobId;
  final String? status;
  final String? detail;
  @JsonKey(name: 'file_url')
  final String? fileUrl;
  @JsonKey(name: 'progress_url')
  final String? progressUrl;

  UploadResponse({
    required this.jobId,
    this.status,
    this.detail,
    this.fileUrl,
    this.progressUrl,
  });

  factory UploadResponse.fromJson(Map<String, dynamic> json) =>
      _$UploadResponseFromJson(json);
  Map<String, dynamic> toJson() => _$UploadResponseToJson(this);
}
