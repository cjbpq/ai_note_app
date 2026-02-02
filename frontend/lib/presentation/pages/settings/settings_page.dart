import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../l10n/app_localizations.dart';
import '../../../providers/auth_provider.dart';
import '../../../providers/theme_provider.dart';
import '../../../config/routes.dart';

/// Settings page
class SettingsPage extends ConsumerWidget {
  const SettingsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final authState = ref.watch(authProvider);
    final themeMode = ref.watch(themeProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.settings),
      ),
      body: ListView(
        children: [
          // User info section
          if (authState.user != null) ...[
            ListTile(
              leading: CircleAvatar(
                child: Text(
                  authState.user!.username[0].toUpperCase(),
                  style: const TextStyle(fontWeight: FontWeight.bold),
                ),
              ),
              title: Text(authState.user!.username),
              subtitle: Text(authState.user!.email ?? ''),
            ),
            const Divider(),
          ],

          // Theme section
          ListTile(
            leading: const Icon(Icons.palette_outlined),
            title: Text(l10n.theme),
            subtitle: Text(_getThemeName(themeMode, l10n)),
            onTap: () => _showThemeDialog(context, ref, l10n),
          ),

          // About section
          ListTile(
            leading: const Icon(Icons.info_outlined),
            title: Text(l10n.about),
            subtitle: Text('${l10n.appName} v1.0.0'),
            onTap: () {
              showAboutDialog(
                context: context,
                applicationName: l10n.appName,
                applicationVersion: '1.0.0',
                applicationLegalese: l10n.appName,
              );
            },
          ),

          const Divider(),

          // Logout button
          ListTile(
            leading: Icon(
              Icons.logout,
              color: Theme.of(context).colorScheme.error,
            ),
            title: Text(
              l10n.logout,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
            onTap: () => _showLogoutDialog(context, ref, l10n),
          ),
        ],
      ),
    );
  }

  String _getThemeName(AppThemeMode mode, AppLocalizations l10n) {
    switch (mode) {
      case AppThemeMode.light:
        return l10n.themeLight;
      case AppThemeMode.dark:
        return l10n.themeDark;
      case AppThemeMode.system:
        return l10n.themeSystem;
    }
  }

  void _showThemeDialog(BuildContext context, WidgetRef ref, AppLocalizations l10n) {
    final currentTheme = ref.read(themeProvider);

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(l10n.selectTheme),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: AppThemeMode.values.map((mode) {
            return RadioListTile<AppThemeMode>(
              title: Text(_getThemeName(mode, l10n)),
              value: mode,
              groupValue: currentTheme,
              onChanged: (value) {
                if (value != null) {
                  ref.read(themeProvider.notifier).setTheme(value);
                  Navigator.pop(context);
                }
              },
            );
          }).toList(),
        ),
      ),
    );
  }

  void _showLogoutDialog(BuildContext context, WidgetRef ref, AppLocalizations l10n) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(l10n.logout),
        content: Text(l10n.logoutConfirm),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(l10n.cancel),
          ),
          TextButton(
            onPressed: () async {
              Navigator.pop(context);
              await ref.read(authProvider.notifier).logout();
              if (context.mounted) {
                context.go(AppRoutes.login);
              }
            },
            child: Text(
              l10n.logout,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          ),
        ],
      ),
    );
  }
}
