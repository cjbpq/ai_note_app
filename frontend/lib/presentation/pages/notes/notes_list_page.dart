import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../l10n/app_localizations.dart';
import '../../../config/routes.dart';
import '../../../providers/notes_provider.dart';
import '../../../providers/upload_provider.dart';
import '../../widgets/common/empty_state_widget.dart';
import '../../widgets/common/loading_widget.dart';
import '../../widgets/common/error_widget.dart';
import '../../widgets/note_card.dart';

/// Notes list page with pull-to-refresh and pagination
class NotesListPage extends ConsumerStatefulWidget {
  const NotesListPage({super.key});

  @override
  ConsumerState<NotesListPage> createState() => _NotesListPageState();
}

class _NotesListPageState extends ConsumerState<NotesListPage> {
  final _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
    // Load notes on first build
    Future.microtask(() {
      ref.read(notesListProvider.notifier).loadNotes();
    });
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >=
        _scrollController.position.maxScrollExtent - 200) {
      ref.read(notesListProvider.notifier).loadMore();
    }
  }

  Future<void> _onRefresh() async {
    await ref.read(notesListProvider.notifier).refresh();
  }

  void _showDeleteDialog(String noteId, String title, bool isFavorite) {
    final l10n = AppLocalizations.of(context)!;

    // 如果笔记已收藏，显示提示不能删除
    if (isFavorite) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(l10n.cannotDeleteFavorite),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(l10n.deleteNote),
        content: Text(l10n.deleteNoteConfirm(title)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(l10n.cancel),
          ),
          TextButton(
            onPressed: () async {
              Navigator.pop(context);
              final success =
                  await ref.read(notesListProvider.notifier).deleteNote(noteId);
              if (success && mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text(l10n.noteDeleted)),
                );
              }
            },
            child: Text(
              l10n.delete,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final state = ref.watch(notesListProvider);
    final categories = ref.watch(categoriesProvider);
    final uploadState = ref.watch(uploadProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.myNotes),
        actions: [
          IconButton(
            icon: const Icon(Icons.search),
            onPressed: () => context.push(AppRoutes.search),
          ),
          PopupMenuButton<String?>(
            icon: const Icon(Icons.filter_list),
            tooltip: l10n.filterByCategory,
            onSelected: (category) {
              ref.read(notesListProvider.notifier).loadNotes(category: category);
            },
            itemBuilder: (context) {
              final items = <PopupMenuEntry<String?>>[];
              items.add(
                PopupMenuItem<String?>(
                  value: null,
                  child: Row(
                    children: [
                      Icon(
                        state.selectedCategory == null
                            ? Icons.check
                            : Icons.label_outline,
                        size: 20,
                      ),
                      const SizedBox(width: 8),
                      Text(l10n.all),
                    ],
                  ),
                ),
              );

              categories.whenData((cats) {
                for (final cat in cats) {
                  items.add(
                    PopupMenuItem<String?>(
                      value: cat,
                      child: Row(
                        children: [
                          Icon(
                            state.selectedCategory == cat
                                ? Icons.check
                                : Icons.label_outline,
                            size: 20,
                          ),
                          const SizedBox(width: 8),
                          Text(cat),
                        ],
                      ),
                    ),
                  );
                }
              });

              return items;
            },
          ),
        ],
      ),
      body: Column(
        children: [
          // Upload progress indicator
          if (uploadState.isUploading) _buildUploadIndicator(uploadState, l10n),
          // Offline indicator
          if (state.isOffline) _buildOfflineIndicator(l10n),
          // Notes list
          Expanded(child: _buildBody(state, l10n)),
        ],
      ),
    );
  }

  /// 构建上传状态横幅
  Widget _buildUploadIndicator(UploadState uploadState, AppLocalizations l10n) {
    final theme = Theme.of(context);
    final progress = uploadState.progress;
    final statusText = uploadState.statusText;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(
        color: theme.colorScheme.primaryContainer,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.1),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          // 进度圆圈
          SizedBox(
            width: 24,
            height: 24,
            child: CircularProgressIndicator(
              value: progress > 0 ? progress : null,
              strokeWidth: 3,
              valueColor: AlwaysStoppedAnimation<Color>(
                theme.colorScheme.primary,
              ),
            ),
          ),
          const SizedBox(width: 12),
          // 状态文本
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  l10n.uploadingNewNote,
                  style: TextStyle(
                    fontWeight: FontWeight.w500,
                    color: theme.colorScheme.onPrimaryContainer,
                  ),
                ),
                if (statusText.isNotEmpty)
                  Text(
                    statusText,
                    style: TextStyle(
                      fontSize: 12,
                      color: theme.colorScheme.onPrimaryContainer.withOpacity(0.7),
                    ),
                  ),
              ],
            ),
          ),
          // 进度百分比
          Text(
            '${(progress * 100).toInt()}%',
            style: TextStyle(
              fontWeight: FontWeight.bold,
              color: theme.colorScheme.primary,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildOfflineIndicator(AppLocalizations l10n) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      color: Theme.of(context).colorScheme.errorContainer,
      child: Row(
        children: [
          Icon(
            Icons.cloud_off,
            size: 16,
            color: Theme.of(context).colorScheme.onErrorContainer,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              l10n.networkError,
              style: TextStyle(
                fontSize: 12,
                color: Theme.of(context).colorScheme.onErrorContainer,
              ),
            ),
          ),
          TextButton(
            onPressed: _onRefresh,
            child: Text(l10n.retry),
          ),
        ],
      ),
    );
  }

  Widget _buildBody(NotesListState state, AppLocalizations l10n) {
    if (state.isLoading && state.notes.isEmpty) {
      return LoadingWidget(message: l10n.loading);
    }

    if (state.error != null && state.notes.isEmpty) {
      return ErrorDisplayWidget(
        message: state.error!,
        onRetry: () => ref.read(notesListProvider.notifier).refresh(),
      );
    }

    if (state.notes.isEmpty) {
      return EmptyStateWidget(
        icon: Icons.note_add_outlined,
        title: l10n.noNotes,
        subtitle: l10n.noNotesHint,
      );
    }

    return RefreshIndicator(
      onRefresh: _onRefresh,
      child: ListView.builder(
        controller: _scrollController,
        padding: const EdgeInsets.symmetric(vertical: 8),
        itemCount: state.notes.length + (state.hasMore ? 1 : 0),
        itemBuilder: (context, index) {
          if (index >= state.notes.length) {
            return const Padding(
              padding: EdgeInsets.all(16),
              child: Center(child: CircularProgressIndicator()),
            );
          }

          final note = state.notes[index];
          return Dismissible(
            key: Key(note.id),
            direction: DismissDirection.endToStart,
            background: Container(
              alignment: Alignment.centerRight,
              padding: const EdgeInsets.only(right: 20),
              color: Theme.of(context).colorScheme.error,
              child: const Icon(Icons.delete, color: Colors.white),
            ),
            confirmDismiss: (_) async {
              _showDeleteDialog(note.id, note.title, note.isFavorite);
              return false;
            },
            child: NoteCard(
              note: note,
              onTap: () => context.push(AppRoutes.noteDetailPath(note.id)),
              onFavorite: () {
                ref.read(notesListProvider.notifier).toggleFavorite(note.id);
              },
            ),
          );
        },
      ),
    );
  }
}
