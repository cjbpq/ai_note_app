import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';

/// Theme mode enum
enum AppThemeMode {
  light,
  dark,
  system,
}

/// Theme provider - manages app theme state
class ThemeNotifier extends StateNotifier<AppThemeMode> {
  static const String _themeKey = 'theme_mode';
  final Box _box;

  ThemeNotifier(this._box) : super(AppThemeMode.system) {
    _loadTheme();
  }

  void _loadTheme() {
    final savedTheme = _box.get(_themeKey, defaultValue: 'system');
    state = AppThemeMode.values.firstWhere(
      (e) => e.name == savedTheme,
      orElse: () => AppThemeMode.system,
    );
  }

  Future<void> setTheme(AppThemeMode mode) async {
    state = mode;
    await _box.put(_themeKey, mode.name);
  }

  ThemeMode get themeMode {
    switch (state) {
      case AppThemeMode.light:
        return ThemeMode.light;
      case AppThemeMode.dark:
        return ThemeMode.dark;
      case AppThemeMode.system:
        return ThemeMode.system;
    }
  }
}

/// Theme box provider
final themeBoxProvider = FutureProvider<Box>((ref) async {
  return await Hive.openBox('settings');
});

/// Theme provider
final themeProvider = StateNotifierProvider<ThemeNotifier, AppThemeMode>((ref) {
  final boxAsync = ref.watch(themeBoxProvider);
  return boxAsync.when(
    data: (box) => ThemeNotifier(box),
    loading: () => ThemeNotifier(Hive.box('settings')),
    error: (_, __) => ThemeNotifier(Hive.box('settings')),
  );
});

/// Theme mode provider for MaterialApp
final themeModeProvider = Provider<ThemeMode>((ref) {
  // 监听状态变化，而不是 notifier 本身
  final themeState = ref.watch(themeProvider);
  switch (themeState) {
    case AppThemeMode.light:
      return ThemeMode.light;
    case AppThemeMode.dark:
      return ThemeMode.dark;
    case AppThemeMode.system:
      return ThemeMode.system;
  }
});
