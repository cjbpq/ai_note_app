import 'package:json_annotation/json_annotation.dart';

part 'user_model.g.dart';

@JsonSerializable()
class UserModel {
  final String id;
  final String username;
  final String? email;
  @JsonKey(name: 'created_at')
  final DateTime createdAt;

  UserModel({
    required this.id,
    required this.username,
    this.email,
    required this.createdAt,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) => _$UserModelFromJson(json);
  Map<String, dynamic> toJson() => _$UserModelToJson(this);
}

@JsonSerializable()
class TokenModel {
  @JsonKey(name: 'access_token')
  final String accessToken;
  @JsonKey(name: 'token_type')
  final String tokenType;

  TokenModel({
    required this.accessToken,
    required this.tokenType,
  });

  factory TokenModel.fromJson(Map<String, dynamic> json) => _$TokenModelFromJson(json);
  Map<String, dynamic> toJson() => _$TokenModelToJson(this);
}

@JsonSerializable()
class TokenInfoModel {
  @JsonKey(name: 'access_token')
  final String accessToken;
  @JsonKey(name: 'token_type')
  final String tokenType;
  @JsonKey(name: 'expires_in')
  final int? expiresIn;  // 可选，登录接口不返回此字段
  @JsonKey(name: 'expires_at')
  final String? expiresAt;  // 可选，登录接口不返回此字段

  TokenInfoModel({
    required this.accessToken,
    required this.tokenType,
    this.expiresIn,
    this.expiresAt,
  });

  factory TokenInfoModel.fromJson(Map<String, dynamic> json) => _$TokenInfoModelFromJson(json);
  Map<String, dynamic> toJson() => _$TokenInfoModelToJson(this);
}
