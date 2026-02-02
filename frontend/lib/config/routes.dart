import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../providers/auth_provider.dart';
import '../presentation/pages/splash_page.dart';
import '../presentation/pages/auth/login_page.dart';
import '../presentation/pages/auth/register_page.dart';
import '../presentation/pages/home/home_page.dart';
import '../presentation/pages/notes/note_detail_page.dart';
import '../presentation/pages/notes/note_edit_page.dart';
import '../presentation/pages/search/search_page.dart';

/// Route names
class AppRoutes {
  static const String splash = '/';
  static const String login = '/login';
  static const String register = '/register';
  static const String home = '/home';
  static const String noteDetail = '/notes/:id';
  static const String noteEdit = '/notes/:id/edit';
  static const String search = '/search';

  static String noteDetailPath(String id) => '/notes/$id';
  static String noteEditPath(String id) => '/notes/$id/edit';
}

/// Router provider
final routerProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authProvider);

  return GoRouter(
    initialLocation: AppRoutes.splash,
    debugLogDiagnostics: true,
    redirect: (context, state) {
      final isLoggedIn = authState.isAuthenticated;
      final isInitialized = authState.isInitialized;
      final isAuthRoute = state.matchedLocation == AppRoutes.login ||
          state.matchedLocation == AppRoutes.register;
      final isSplash = state.matchedLocation == AppRoutes.splash;

      // Show splash while initializing
      if (!isInitialized) {
        return isSplash ? null : AppRoutes.splash;
      }

      // Redirect to login if not authenticated
      if (!isLoggedIn && !isAuthRoute) {
        return AppRoutes.login;
      }

      // Redirect to home if already authenticated
      if (isLoggedIn && (isAuthRoute || isSplash)) {
        return AppRoutes.home;
      }

      return null;
    },
    routes: [
      GoRoute(
        path: AppRoutes.splash,
        builder: (context, state) => const SplashPage(),
      ),
      GoRoute(
        path: AppRoutes.login,
        builder: (context, state) => const LoginPage(),
      ),
      GoRoute(
        path: AppRoutes.register,
        builder: (context, state) => const RegisterPage(),
      ),
      GoRoute(
        path: AppRoutes.home,
        builder: (context, state) => const HomePage(),
      ),
      GoRoute(
        path: AppRoutes.noteDetail,
        builder: (context, state) {
          final id = state.pathParameters['id']!;
          return NoteDetailPage(noteId: id);
        },
      ),
      GoRoute(
        path: AppRoutes.noteEdit,
        builder: (context, state) {
          final id = state.pathParameters['id']!;
          return NoteEditPage(noteId: id);
        },
      ),
      GoRoute(
        path: AppRoutes.search,
        builder: (context, state) => const SearchPage(),
      ),
    ],
    errorBuilder: (context, state) => Scaffold(
      body: Center(
        child: Text('Page not found: ${state.error}'),
      ),
    ),
  );
});
