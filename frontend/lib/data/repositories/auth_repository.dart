import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/storage/secure_storage.dart';
import '../datasources/auth_api.dart';
import '../models/user_model.dart';

/// Provider for AuthRepository
final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepository(
    ref.watch(authApiProvider),
    ref.watch(tokenStorageProvider),
  );
});

/// Authentication repository - handles auth logic and token management
class AuthRepository {
  final AuthApi _authApi;
  final TokenStorage _tokenStorage;
  
  AuthRepository(this._authApi, this._tokenStorage);
  
  /// Register a new user
  Future<UserModel> register({
    required String username,
    required String email,
    required String password,
  }) async {
    return await _authApi.register(
      username: username,
      email: email,
      password: password,
    );
  }
  
  /// Login and save token
  Future<UserModel> login({
    required String username,
    required String password,
  }) async {
    final tokenInfo = await _authApi.login(
      username: username,
      password: password,
    );
    
    // Save token to secure storage
    await _tokenStorage.saveToken(tokenInfo.accessToken);
    
    // Get and return user info
    return await _authApi.getCurrentUser();
  }
  
  /// Logout - clear all stored data
  Future<void> logout() async {
    await _tokenStorage.clearAll();
  }
  
  /// Check if user is logged in
  Future<bool> isLoggedIn() async {
    return await _tokenStorage.hasToken();
  }
  
  /// Get current user if logged in
  Future<UserModel?> getCurrentUser() async {
    final hasToken = await _tokenStorage.hasToken();
    if (!hasToken) return null;
    
    try {
      return await _authApi.getCurrentUser();
    } catch (e) {
      // Token might be invalid, clear it
      await _tokenStorage.clearAll();
      return null;
    }
  }
  
  /// Refresh token
  Future<void> refreshToken() async {
    final tokenInfo = await _authApi.refreshToken();
    await _tokenStorage.saveToken(tokenInfo.accessToken);
  }
  
  /// Delete account
  Future<void> deleteAccount() async {
    await _authApi.deleteAccount();
    await _tokenStorage.clearAll();
  }
}
