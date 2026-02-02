import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/models/user_model.dart';
import '../data/repositories/auth_repository.dart';

/// Auth state
class AuthState {
  final UserModel? user;
  final bool isLoading;
  final bool isInitialized;
  final String? error;

  const AuthState({
    this.user,
    this.isLoading = false,
    this.isInitialized = false,
    this.error,
  });

  bool get isAuthenticated => user != null;

  AuthState copyWith({
    UserModel? user,
    bool? isLoading,
    bool? isInitialized,
    String? error,
    bool clearUser = false,
    bool clearError = false,
  }) {
    return AuthState(
      user: clearUser ? null : (user ?? this.user),
      isLoading: isLoading ?? this.isLoading,
      isInitialized: isInitialized ?? this.isInitialized,
      error: clearError ? null : (error ?? this.error),
    );
  }
}

/// Auth provider - manages authentication state
class AuthNotifier extends StateNotifier<AuthState> {
  final AuthRepository _repository;

  AuthNotifier(this._repository) : super(const AuthState());

  /// Initialize auth state - check if user is logged in
  Future<void> initialize() async {
    if (state.isInitialized) return;
    
    state = state.copyWith(isLoading: true);
    
    try {
      final user = await _repository.getCurrentUser();
      state = AuthState(
        user: user,
        isInitialized: true,
        isLoading: false,
      );
    } catch (e) {
      state = AuthState(
        isInitialized: true,
        isLoading: false,
      );
    }
  }

  /// Register a new user
  Future<bool> register({
    required String username,
    required String email,
    required String password,
  }) async {
    state = state.copyWith(isLoading: true, clearError: true);
    
    try {
      await _repository.register(
        username: username,
        email: email,
        password: password,
      );
      state = state.copyWith(isLoading: false);
      return true;
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: e.toString(),
      );
      return false;
    }
  }

  /// Login with username and password
  Future<bool> login({
    required String username,
    required String password,
  }) async {
    state = state.copyWith(isLoading: true, clearError: true);
    
    try {
      final user = await _repository.login(
        username: username,
        password: password,
      );
      state = state.copyWith(
        user: user,
        isLoading: false,
      );
      return true;
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: e.toString(),
      );
      return false;
    }
  }

  /// Logout
  Future<void> logout() async {
    state = state.copyWith(isLoading: true);
    
    try {
      await _repository.logout();
    } finally {
      state = state.copyWith(
        clearUser: true,
        isLoading: false,
      );
    }
  }

  /// Delete account
  Future<bool> deleteAccount() async {
    state = state.copyWith(isLoading: true, clearError: true);
    
    try {
      await _repository.deleteAccount();
      state = state.copyWith(
        clearUser: true,
        isLoading: false,
      );
      return true;
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: e.toString(),
      );
      return false;
    }
  }

  /// Clear error
  void clearError() {
    state = state.copyWith(clearError: true);
  }
}

/// Auth state provider
final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  return AuthNotifier(ref.watch(authRepositoryProvider));
});
