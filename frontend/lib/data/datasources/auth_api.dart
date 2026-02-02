import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/network/dio_client.dart';
import '../../core/network/api_endpoints.dart';
import '../models/user_model.dart';

/// Provider for AuthApi
final authApiProvider = Provider<AuthApi>((ref) {
  return AuthApi(ref.watch(dioProvider));
});

/// Authentication API data source
class AuthApi {
  final Dio _dio;
  
  AuthApi(this._dio);
  
  /// Register a new user
  Future<UserModel> register({
    required String username,
    required String email,
    required String password,
  }) async {
    final response = await _dio.post(
      ApiEndpoints.register,
      data: {
        'username': username,
        'email': email,
        'password': password,
      },
    );
    return UserModel.fromJson(response.data);
  }
  
  /// Login with username and password
  Future<TokenInfoModel> login({
    required String username,
    required String password,
  }) async {
    final response = await _dio.post(
      ApiEndpoints.login,
      data: {
        'username': username,
        'password': password,
      },
      // 使用默认的 JSON 格式（不再使用 formUrlEncodedContentType）
    );
    return TokenInfoModel.fromJson(response.data);
  }
  
  /// Refresh access token
  Future<TokenInfoModel> refreshToken() async {
    final response = await _dio.post(ApiEndpoints.refreshToken);
    return TokenInfoModel.fromJson(response.data);
  }
  
  /// Get current user info
  Future<UserModel> getCurrentUser() async {
    final response = await _dio.get(ApiEndpoints.me);
    return UserModel.fromJson(response.data);
  }
  
  /// Delete user account
  Future<void> deleteAccount() async {
    await _dio.delete(ApiEndpoints.deleteAccount);
  }
}
