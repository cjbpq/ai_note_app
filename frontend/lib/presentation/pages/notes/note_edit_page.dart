import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../l10n/app_localizations.dart';
import '../../../providers/notes_provider.dart';
import '../../widgets/common/loading_widget.dart';
import '../../theme/colors.dart';

/// Note edit page for editing title, category and tags
class NoteEditPage extends ConsumerStatefulWidget {
  final String noteId;

  const NoteEditPage({
    super.key,
    required this.noteId,
  });

  @override
  ConsumerState<NoteEditPage> createState() => _NoteEditPageState();
}

class _NoteEditPageState extends ConsumerState<NoteEditPage> {
  final _formKey = GlobalKey<FormState>();
  final _titleController = TextEditingController();
  final _tagController = TextEditingController();
  String? _selectedCategory;
  List<String> _tags = [];
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _loadNoteData();
  }

  void _loadNoteData() {
    final state = ref.read(noteDetailProvider(widget.noteId));
    if (state.note != null) {
      _titleController.text = state.note!.title;
      _selectedCategory = state.note!.category;
      _tags = List.from(state.note!.tags ?? []);
    }
  }

  @override
  void dispose() {
    _titleController.dispose();
    _tagController.dispose();
    super.dispose();
  }

  void _addTag() {
    final tag = _tagController.text.trim();
    if (tag.isNotEmpty && !_tags.contains(tag)) {
      setState(() {
        _tags.add(tag);
        _tagController.clear();
      });
    }
  }

  void _removeTag(String tag) {
    setState(() {
      _tags.remove(tag);
    });
  }

  Future<void> _save() async {
    final l10n = AppLocalizations.of(context)!;
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isLoading = true);

    final success = await ref.read(noteDetailProvider(widget.noteId).notifier).updateNote(
      title: _titleController.text.trim(),
      category: _selectedCategory,
      tags: _tags,
    );

    setState(() => _isLoading = false);

    if (success && mounted) {
      // Update the note in the list
      final note = ref.read(noteDetailProvider(widget.noteId)).note;
      if (note != null) {
        ref.read(notesListProvider.notifier).updateNoteInList(note);
      }

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(l10n.saveSuccess)),
      );
      context.pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final state = ref.watch(noteDetailProvider(widget.noteId));
    final categories = ref.watch(categoriesProvider);
    final theme = Theme.of(context);

    if (state.isLoading) {
      return Scaffold(
        appBar: AppBar(title: Text(l10n.editNote)),
        body: const LoadingWidget(),
      );
    }

    if (state.note == null) {
      return Scaffold(
        appBar: AppBar(title: Text(l10n.editNote)),
        body: Center(child: Text(l10n.noteNotFound)),
      );
    }

    // Initialize fields if not done yet
    if (_titleController.text.isEmpty && state.note!.title.isNotEmpty) {
      _titleController.text = state.note!.title;
      _selectedCategory = state.note!.category;
      _tags = List.from(state.note!.tags ?? []);
    }

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.editNote),
        actions: [
          TextButton(
            onPressed: _isLoading ? null : _save,
            child: _isLoading
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : Text(l10n.save),
          ),
        ],
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Title field
            TextFormField(
              controller: _titleController,
              decoration: InputDecoration(
                labelText: l10n.title,
                hintText: l10n.titleHint,
              ),
              maxLines: 1,
              validator: (value) {
                if (value == null || value.trim().isEmpty) {
                  return l10n.pleaseEnterTitle;
                }
                return null;
              },
            ),
            const SizedBox(height: 24),

            // Category dropdown
            Text(
              l10n.category,
              style: theme.textTheme.labelLarge,
            ),
            const SizedBox(height: 8),
            categories.when(
              data: (cats) {
                return Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: cats.map((cat) {
                    final isSelected = _selectedCategory == cat;
                    final color = AppColors.getCategoryColor(cat);
                    return ChoiceChip(
                      label: Text(cat),
                      selected: isSelected,
                      selectedColor: color.withValues(alpha: 0.2),
                      onSelected: (_) {
                        setState(() => _selectedCategory = cat);
                      },
                    );
                  }).toList(),
                );
              },
              loading: () => const CircularProgressIndicator(),
              error: (_, __) => Text(l10n.loadCategoryFailed),
            ),
            const SizedBox(height: 24),

            // Tags section
            Text(
              l10n.tags,
              style: theme.textTheme.labelLarge,
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _tagController,
                    decoration: InputDecoration(
                      hintText: l10n.tagsHint,
                      isDense: true,
                    ),
                    onSubmitted: (_) => _addTag(),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton(
                  onPressed: _addTag,
                  icon: const Icon(Icons.add),
                ),
              ],
            ),
            const SizedBox(height: 8),
            if (_tags.isNotEmpty)
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: _tags.map((tag) {
                  return Chip(
                    label: Text('#$tag'),
                    deleteIcon: const Icon(Icons.close, size: 18),
                    onDeleted: () => _removeTag(tag),
                  );
                }).toList(),
              ),
            const SizedBox(height: 32),

            // Error message
            if (state.error != null)
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: theme.colorScheme.error.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  state.error!,
                  style: TextStyle(color: theme.colorScheme.error),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
