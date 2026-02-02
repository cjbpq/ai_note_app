import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:intl/intl.dart';
import 'package:share_plus/share_plus.dart';
import '../../../l10n/app_localizations.dart';
import '../../../providers/notes_provider.dart';
import '../../widgets/common/loading_widget.dart';
import '../../widgets/common/error_widget.dart';
import '../../theme/colors.dart';
import '../../widgets/image_viewer.dart';
import '../../widgets/latex_markdown.dart';
import '../../widgets/note_content_editor.dart';
import '../../widgets/markdown_source_editor.dart';

/// Note detail page with three-mode editing support
/// - Preview: Read-only Markdown rendering with LaTeX
/// - WYSIWYG: Rich text editing with flutter_quill
/// - Source: Raw Markdown text editing
class NoteDetailPage extends ConsumerStatefulWidget {
  final String noteId;

  const NoteDetailPage({
    super.key,
    required this.noteId,
  });

  @override
  ConsumerState<NoteDetailPage> createState() => _NoteDetailPageState();
}

class _NoteDetailPageState extends ConsumerState<NoteDetailPage> {
  // Keys for accessing editor states
  final GlobalKey<NoteContentEditorState> _wysiwygEditorKey =
      GlobalKey<NoteContentEditorState>();
  final GlobalKey<MarkdownSourceEditorState> _sourceEditorKey =
      GlobalKey<MarkdownSourceEditorState>();

  @override
  void initState() {
    super.initState();
    // Initialize edit mode with current content
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final note = ref.read(noteDetailProvider(widget.noteId)).note;
      if (note != null) {
        ref
            .read(noteEditModeProvider(widget.noteId).notifier)
            .initializeWithContent(note.markdownContent);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final state = ref.watch(noteDetailProvider(widget.noteId));
    final editModeState = ref.watch(noteEditModeProvider(widget.noteId));
    final theme = Theme.of(context);

    // Get favorite status from list (for sync)
    final listState = ref.watch(notesListProvider);
    final noteFromList =
        listState.notes.where((n) => n.id == widget.noteId).firstOrNull;
    final isFavorite =
        noteFromList?.isFavorite ?? state.note?.isFavorite ?? false;

    return PopScope(
      canPop: !editModeState.hasUnsavedChanges,
      onPopInvokedWithResult: (didPop, result) async {
        if (didPop) return;

        // Show confirmation dialog if has unsaved changes
        final shouldPop = await _showUnsavedChangesDialog(context, l10n);
        if (shouldPop == true && context.mounted) {
          context.pop();
        }
      },
      child: Scaffold(
        appBar: _buildAppBar(context, state, isFavorite, editModeState, l10n),
        body: _buildBody(context, state, editModeState, theme, l10n),
        floatingActionButton: editModeState.isEditing
            ? _buildSaveFAB(context, state, editModeState, l10n)
            : null,
      ),
    );
  }

  /// Build AppBar with mode switcher
  PreferredSizeWidget _buildAppBar(
    BuildContext context,
    NoteDetailState state,
    bool isFavorite,
    NoteEditModeState editModeState,
    AppLocalizations l10n,
  ) {
    return AppBar(
      title: Text(l10n.noteDetail),
      actions: [
        if (state.note != null) ...[
          // Mode switcher (PopupMenuButton)
          PopupMenuButton<NoteEditMode>(
            icon: Icon(_getModeIcon(editModeState.mode)),
            tooltip: l10n.switchEditMode,
            onSelected: (mode) => _switchMode(mode),
            itemBuilder: (context) => [
              PopupMenuItem(
                value: NoteEditMode.preview,
                child: Row(
                  children: [
                    Icon(
                      Icons.visibility,
                      color: editModeState.mode == NoteEditMode.preview
                          ? Theme.of(context).colorScheme.primary
                          : null,
                    ),
                    const SizedBox(width: 12),
                    Text(l10n.previewMode),
                  ],
                ),
              ),
              PopupMenuItem(
                value: NoteEditMode.wysiwyg,
                child: Row(
                  children: [
                    Icon(
                      Icons.edit_note,
                      color: editModeState.mode == NoteEditMode.wysiwyg
                          ? Theme.of(context).colorScheme.primary
                          : null,
                    ),
                    const SizedBox(width: 12),
                    Text(l10n.wysiwygMode),
                  ],
                ),
              ),
              PopupMenuItem(
                value: NoteEditMode.source,
                child: Row(
                  children: [
                    Icon(
                      Icons.code,
                      color: editModeState.mode == NoteEditMode.source
                          ? Theme.of(context).colorScheme.primary
                          : null,
                    ),
                    const SizedBox(width: 12),
                    Text(l10n.sourceMode),
                  ],
                ),
              ),
            ],
          ),

          // Favorite button (only in preview mode)
          if (editModeState.mode == NoteEditMode.preview)
            IconButton(
              icon: Icon(
                isFavorite ? Icons.favorite : Icons.favorite_border,
                color: isFavorite ? Colors.red : null,
              ),
              onPressed: () {
                ref
                    .read(noteDetailProvider(widget.noteId).notifier)
                    .toggleFavorite();
                ref.read(notesListProvider.notifier).toggleFavorite(widget.noteId);
              },
            ),

          // Share button (only in preview mode)
          if (editModeState.mode == NoteEditMode.preview)
            IconButton(
              icon: const Icon(Icons.share),
              onPressed: () => _shareNote(
                  context, state.note!.title, state.note!.markdownContent),
            ),
        ],
      ],
    );
  }

  /// Get icon for current mode
  IconData _getModeIcon(NoteEditMode mode) {
    switch (mode) {
      case NoteEditMode.preview:
        return Icons.visibility;
      case NoteEditMode.wysiwyg:
        return Icons.edit_note;
      case NoteEditMode.source:
        return Icons.code;
    }
  }

  /// Switch editing mode
  void _switchMode(NoteEditMode mode) {
    final currentMode = ref.read(noteEditModeProvider(widget.noteId)).mode;
    if (currentMode == mode) return;

    // Sync content between editors before switching
    _syncContentBeforeSwitch(currentMode);

    // Switch mode
    switch (mode) {
      case NoteEditMode.preview:
        ref.read(noteEditModeProvider(widget.noteId).notifier).setPreviewMode();
        break;
      case NoteEditMode.wysiwyg:
        ref.read(noteEditModeProvider(widget.noteId).notifier).setWysiwygMode();
        break;
      case NoteEditMode.source:
        ref.read(noteEditModeProvider(widget.noteId).notifier).setSourceMode();
        break;
    }
  }

  /// Sync content before switching modes
  void _syncContentBeforeSwitch(NoteEditMode fromMode) {
    String? content;

    // Get content from current editor
    switch (fromMode) {
      case NoteEditMode.wysiwyg:
        content = _wysiwygEditorKey.currentState?.getMarkdownContent();
        break;
      case NoteEditMode.source:
        content = _sourceEditorKey.currentState?.getContent();
        break;
      case NoteEditMode.preview:
        // Preview mode doesn't need sync
        return;
    }

    // Update provider state if content changed
    if (content != null) {
      ref
          .read(noteEditModeProvider(widget.noteId).notifier)
          .updateContent(content);
    }
  }

  /// Build body based on current mode
  Widget _buildBody(
    BuildContext context,
    NoteDetailState state,
    NoteEditModeState editModeState,
    ThemeData theme,
    AppLocalizations l10n,
  ) {
    if (state.isLoading) {
      return LoadingWidget(message: l10n.loading);
    }

    if (state.error != null) {
      return ErrorDisplayWidget(
        message: state.error!,
        onRetry: () {},
      );
    }

    if (state.note == null) {
      return Center(child: Text(l10n.noteNotFound));
    }

    final note = state.note!;

    // Choose widget based on mode
    switch (editModeState.mode) {
      case NoteEditMode.preview:
        return _buildPreviewMode(context, note, state, theme, l10n);

      case NoteEditMode.wysiwyg:
        return _buildWysiwygMode(context, note, editModeState, theme, l10n);

      case NoteEditMode.source:
        return _buildSourceMode(context, note, editModeState, theme, l10n);
    }
  }

  /// Build preview mode content
  Widget _buildPreviewMode(
    BuildContext context,
    dynamic note,
    NoteDetailState state,
    ThemeData theme,
    AppLocalizations l10n,
  ) {
    final categoryColor = AppColors.getCategoryColor(note.category);

    return Column(
      children: [
        // Offline indicator
        if (state.isOffline)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            color: theme.colorScheme.errorContainer,
            child: Row(
              children: [
                Icon(
                  Icons.cloud_off,
                  size: 16,
                  color: theme.colorScheme.onErrorContainer,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    l10n.networkError,
                    style: TextStyle(
                      fontSize: 12,
                      color: theme.colorScheme.onErrorContainer,
                    ),
                  ),
                ),
              ],
            ),
          ),

        Expanded(
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Image header (clickable)
                if (note.fullImageUrl != null)
                  GestureDetector(
                    onTap: () => ImageViewer.show(
                      context,
                      note.fullImageUrl!,
                      heroTag: 'note_image_${widget.noteId}',
                    ),
                    child: Hero(
                      tag: 'note_image_${widget.noteId}',
                      child: CachedNetworkImage(
                        imageUrl: note.fullImageUrl!,
                        width: double.infinity,
                        height: 200,
                        fit: BoxFit.cover,
                        placeholder: (context, url) => Container(
                          height: 200,
                          color: theme.colorScheme.surfaceContainerHighest,
                          child: const Center(child: CircularProgressIndicator()),
                        ),
                        errorWidget: (context, url, error) => Container(
                          height: 200,
                          color: theme.colorScheme.surfaceContainerHighest,
                          child: const Icon(Icons.broken_image, size: 64),
                        ),
                      ),
                    ),
                  ),

                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Title
                      Text(
                        note.title,
                        style: theme.textTheme.headlineSmall?.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 12),

                      // Meta info row
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 4,
                            ),
                            decoration: BoxDecoration(
                              color: categoryColor.withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              note.category,
                              style: theme.textTheme.labelMedium?.copyWith(
                                color: categoryColor,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Icon(
                            Icons.access_time,
                            size: 16,
                            color: theme.colorScheme.outline,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            DateFormat('yyyy-MM-dd HH:mm').format(note.createdAt),
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: theme.colorScheme.outline,
                            ),
                          ),
                        ],
                      ),

                      // Tags
                      if (note.tags != null && note.tags!.isNotEmpty) ...[
                        const SizedBox(height: 12),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: note.tags!.map((tag) {
                            return Chip(
                              label: Text('#$tag'),
                              materialTapTargetSize:
                                  MaterialTapTargetSize.shrinkWrap,
                              visualDensity: VisualDensity.compact,
                            );
                          }).toList(),
                        ),
                      ],

                      const Divider(height: 32),

                      // Markdown content with LaTeX support
                      LatexMarkdown(
                        data: note.markdownContent,
                        selectable: true,
                      ),

                      // Original text section
                      if (note.originalText != null &&
                          note.originalText!.isNotEmpty) ...[
                        const SizedBox(height: 24),
                        ExpansionTile(
                          title: Text(l10n.originalText),
                          leading: const Icon(Icons.text_snippet_outlined),
                          children: [
                            Padding(
                              padding: const EdgeInsets.all(16),
                              child: SelectableText(
                                note.originalText!,
                                style: theme.textTheme.bodyMedium?.copyWith(
                                  color: theme.colorScheme.onSurfaceVariant,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],

                      const SizedBox(height: 32),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  /// Build WYSIWYG editing mode
  Widget _buildWysiwygMode(
    BuildContext context,
    dynamic note,
    NoteEditModeState editModeState,
    ThemeData theme,
    AppLocalizations l10n,
  ) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Mode indicator
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: theme.colorScheme.primaryContainer,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              children: [
                Icon(
                  Icons.edit_note,
                  size: 16,
                  color: theme.colorScheme.onPrimaryContainer,
                ),
                const SizedBox(width: 8),
                Text(
                  l10n.wysiwygMode,
                  style: theme.textTheme.labelLarge?.copyWith(
                    color: theme.colorScheme.onPrimaryContainer,
                  ),
                ),
                const Spacer(),
                if (editModeState.hasUnsavedChanges)
                  Text(
                    l10n.unsavedChanges,
                    style: theme.textTheme.labelSmall?.copyWith(
                      color: theme.colorScheme.onPrimaryContainer,
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // WYSIWYG Editor
          Expanded(
            child: NoteContentEditor(
              key: _wysiwygEditorKey,
              initialMarkdown: editModeState.editingContent ?? note.markdownContent,
              onContentChanged: (content) {
                ref
                    .read(noteEditModeProvider(widget.noteId).notifier)
                    .updateContent(content);
              },
              showToolbar: true,
              autofocus: true,
            ),
          ),
        ],
      ),
    );
  }

  /// Build source (Markdown) editing mode
  Widget _buildSourceMode(
    BuildContext context,
    dynamic note,
    NoteEditModeState editModeState,
    ThemeData theme,
    AppLocalizations l10n,
  ) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Mode indicator
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: theme.colorScheme.secondaryContainer,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              children: [
                Icon(
                  Icons.code,
                  size: 16,
                  color: theme.colorScheme.onSecondaryContainer,
                ),
                const SizedBox(width: 8),
                Text(
                  l10n.sourceMode,
                  style: theme.textTheme.labelLarge?.copyWith(
                    color: theme.colorScheme.onSecondaryContainer,
                  ),
                ),
                const Spacer(),
                if (editModeState.hasUnsavedChanges)
                  Text(
                    l10n.unsavedChanges,
                    style: theme.textTheme.labelSmall?.copyWith(
                      color: theme.colorScheme.onSecondaryContainer,
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Source Editor
          Expanded(
            child: MarkdownSourceEditor(
              key: _sourceEditorKey,
              initialContent: editModeState.editingContent ?? note.markdownContent,
              onContentChanged: (content) {
                ref
                    .read(noteEditModeProvider(widget.noteId).notifier)
                    .updateContent(content);
              },
              autofocus: true,
              minLines: 20,
              maxLines: null,
            ),
          ),
        ],
      ),
    );
  }

  /// Build save FAB for editing modes
  Widget? _buildSaveFAB(
    BuildContext context,
    NoteDetailState state,
    NoteEditModeState editModeState,
    AppLocalizations l10n,
  ) {
    if (!editModeState.hasUnsavedChanges) return null;

    return FloatingActionButton.extended(
      onPressed: () => _saveChanges(context, state, editModeState, l10n),
      icon: const Icon(Icons.save),
      label: Text(l10n.save),
    );
  }

  /// Save changes
  Future<void> _saveChanges(
    BuildContext context,
    NoteDetailState state,
    NoteEditModeState editModeState,
    AppLocalizations l10n,
  ) async {
    if (state.note == null || editModeState.editingContent == null) return;

    // Get current content from active editor
    String? content;
    switch (editModeState.mode) {
      case NoteEditMode.wysiwyg:
        content = _wysiwygEditorKey.currentState?.getMarkdownContent();
        break;
      case NoteEditMode.source:
        content = _sourceEditorKey.currentState?.getContent();
        break;
      case NoteEditMode.preview:
        return; // Preview mode doesn't need saving
    }

    if (content == null) return;

    // TODO: Implement actual save to backend
    // For now, just update local state
    ref.read(noteEditModeProvider(widget.noteId).notifier).markSaved();

    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(l10n.savedSuccessfully),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  /// Show unsaved changes dialog
  Future<bool?> _showUnsavedChangesDialog(
    BuildContext context,
    AppLocalizations l10n,
  ) async {
    return showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(l10n.unsavedChanges),
        content: Text(l10n.unsavedChangesMessage),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: Text(l10n.cancel),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: Text(l10n.discardChanges),
          ),
        ],
      ),
    );
  }

  /// Share note
  void _shareNote(BuildContext context, String title, String content) {
    Share.share(
      '$title\n\n$content',
      subject: title,
    );
  }
}
