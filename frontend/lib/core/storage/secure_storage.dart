import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../config/app_config.dart';

/// Provider for FlutterSecureStorage
final secureStorageProvider = Provider<FlutterSecureStorage>((ref) {
  return const FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
    iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
  );
});

/// Provider for TokenStorage service
final tokenStorageProvider = Provider<TokenStorage>((ref) {
  return TokenStorage(ref.watch(secureStorageProvider));
});

/// Token storage service
class TokenStorage {
  final FlutterSecureStorage _storage;
  
  TokenStorage(this._storage);
  
  /// Save access token
  Future<void> saveToken(String token) async {
    await _storage.write(key: AppConfig.accessTokenKey, value: token);
  }
  
  /// Get access token
  Future<String?> getToken() async {
    return await _storage.read(key: AppConfig.accessTokenKey);
  }
  
  /// Delete access token
  Future<void> deleteToken() async {
    await _storage.delete(key: AppConfig.accessTokenKey);
  }
  
  /// Check if token exists
  Future<bool> hasToken() async {
    final token = await getToken();
    return token != null && token.isNotEmpty;
  }
  
  /// Clear all stored data
  Future<void> clearAll() async {
    await _storage.deleteAll();
  }
}
