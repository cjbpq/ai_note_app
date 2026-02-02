import 'package:json_annotation/json_annotation.dart';
import '../../config/app_config.dart';

part 'note_model.g.dart';

@JsonSerializable()
class NoteModel {
  final String id;
  @JsonKey(name: 'user_id')
  final String? userId;
  @JsonKey(name: 'device_id')
  final String? deviceId;
  final String title;
  final String category;
  final List<String>? tags;
  @JsonKey(name: 'image_url')
  final String? imageUrl;
  @JsonKey(name: 'image_filename')
  final String? imageFilename;
  @JsonKey(name: 'image_size')
  final int? imageSize;
  @JsonKey(name: 'original_text')
  final String? originalText;
  @JsonKey(name: 'structured_data')
  final Map<String, dynamic>? structuredData;
  @JsonKey(name: 'is_favorite')
  final bool isFavorite;
  @JsonKey(name: 'is_archived')
  final bool isArchived;
  @JsonKey(name: 'created_at')
  final DateTime createdAt;
  @JsonKey(name: 'updated_at')
  final DateTime updatedAt;

  NoteModel({
    required this.id,
    this.userId,
    this.deviceId,
    required this.title,
    required this.category,
    this.tags,
    this.imageUrl,
    this.imageFilename,
    this.imageSize,
    this.originalText,
    this.structuredData,
    this.isFavorite = false,
    this.isArchived = false,
    required this.createdAt,
    required this.updatedAt,
  });

  factory NoteModel.fromJson(Map<String, dynamic> json) => _$NoteModelFromJson(json);
  Map<String, dynamic> toJson() => _$NoteModelToJson(this);
  
  /// Get preview text from structured data or original text
  String get preview {
    if (structuredData != null) {
      final summary = structuredData!['summary'];
      if (summary is String && summary.isNotEmpty) {
        return summary.length > 100 ? '${summary.substring(0, 100)}...' : summary;
      }
    }
    if (originalText != null && originalText!.isNotEmpty) {
      return originalText!.length > 100
          ? '${originalText!.substring(0, 100)}...'
          : originalText!;
    }
    return '';
  }

  /// Get full image URL (拼接基础URL)
  String? get fullImageUrl {
    if (imageUrl == null || imageUrl!.isEmpty) return null;
    // 如果已经是完整URL，直接返回
    if (imageUrl!.startsWith('http://') || imageUrl!.startsWith('https://')) {
      return imageUrl;
    }
    // 否则拼接基础URL（去掉 /api/v1 部分）
    final baseUrl = AppConfig.apiBaseUrl.replaceAll('/api/v1', '');
    return '$baseUrl$imageUrl';
  }

  /// Get markdown content for display (从 structured_data 构建)
  String get markdownContent {
    if (structuredData == null) {
      return originalText ?? '';
    }

    final buffer = StringBuffer();

    // 摘要
    final summary = structuredData!['summary'];
    if (summary is String && summary.isNotEmpty) {
      buffer.writeln('## 摘要\n');
      buffer.writeln(summary);
      buffer.writeln();
    }

    // 关键要点
    final keyPoints = structuredData!['key_points'];
    if (keyPoints is List && keyPoints.isNotEmpty) {
      buffer.writeln('## 关键要点\n');
      for (final point in keyPoints) {
        buffer.writeln('- $point');
      }
      buffer.writeln();
    }

    // 章节内容
    final sections = structuredData!['sections'];
    if (sections is List && sections.isNotEmpty) {
      for (final section in sections) {
        if (section is Map) {
          final heading = section['heading'] ?? '内容';
          final content = section['content'] ?? '';
          buffer.writeln('## $heading\n');
          buffer.writeln(content);
          buffer.writeln();
        }
      }
    }

    // 学习建议
    final studyAdvice = structuredData!['study_advice'];
    if (studyAdvice is String && studyAdvice.isNotEmpty) {
      buffer.writeln('## 学习建议\n');
      buffer.writeln(studyAdvice);
      buffer.writeln();
    }

    // 如果 structured_data 没有有效内容，回退到 original_text
    final result = buffer.toString().trim();
    if (result.isEmpty) {
      return originalText ?? '';
    }

    return result;
  }

  NoteModel copyWith({
    String? id,
    String? userId,
    String? deviceId,
    String? title,
    String? category,
    List<String>? tags,
    String? imageUrl,
    String? imageFilename,
    int? imageSize,
    String? originalText,
    Map<String, dynamic>? structuredData,
    bool? isFavorite,
    bool? isArchived,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return NoteModel(
      id: id ?? this.id,
      userId: userId ?? this.userId,
      deviceId: deviceId ?? this.deviceId,
      title: title ?? this.title,
      category: category ?? this.category,
      tags: tags ?? this.tags,
      imageUrl: imageUrl ?? this.imageUrl,
      imageFilename: imageFilename ?? this.imageFilename,
      imageSize: imageSize ?? this.imageSize,
      originalText: originalText ?? this.originalText,
      structuredData: structuredData ?? this.structuredData,
      isFavorite: isFavorite ?? this.isFavorite,
      isArchived: isArchived ?? this.isArchived,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}

@JsonSerializable()
class NoteListResponse {
  final List<NoteModel> notes;
  final int total;

  NoteListResponse({required this.notes, required this.total});

  factory NoteListResponse.fromJson(Map<String, dynamic> json) => 
      _$NoteListResponseFromJson(json);
  Map<String, dynamic> toJson() => _$NoteListResponseToJson(this);
}

@JsonSerializable()
class NoteUpdateRequest {
  final String? title;
  final String? category;
  final List<String>? tags;
  @JsonKey(name: 'is_favorite')
  final bool? isFavorite;
  @JsonKey(name: 'original_text')
  final String? originalText;
  @JsonKey(name: 'structured_data')
  final Map<String, dynamic>? structuredData;

  NoteUpdateRequest({
    this.title, 
    this.category, 
    this.tags, 
    this.isFavorite,
    this.originalText,
    this.structuredData,
  });

  factory NoteUpdateRequest.fromJson(Map<String, dynamic> json) => 
      _$NoteUpdateRequestFromJson(json);
  Map<String, dynamic> toJson() => _$NoteUpdateRequestToJson(this);
}
