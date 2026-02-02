import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../l10n/app_localizations.dart';
import 'package:go_router/go_router.dart';
import '../../../providers/notes_provider.dart';
import '../../widgets/note_card.dart';

/// Search page with history and results
class SearchPage extends ConsumerStatefulWidget {
  const SearchPage({super.key});

  @override
  ConsumerState<SearchPage> createState() => _SearchPageState();
}

class _SearchPageState extends ConsumerState<SearchPage> {
  final _searchController = TextEditingController();
  final _focusNode = FocusNode();
  final _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    // Load search history
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(searchHistoryProvider.notifier).load();
    });

    // Listen for scroll to load more
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _searchController.dispose();
    _focusNode.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >=
        _scrollController.position.maxScrollExtent - 200) {
      ref.read(searchProvider.notifier).loadMore();
    }
  }

  void _onSearch(String query) {
    if (query.trim().isNotEmpty) {
      ref.read(searchProvider.notifier).search(query);
      ref.read(searchHistoryProvider.notifier).addItem(query);
    }
  }

  void _onHistoryTap(String query) {
    _searchController.text = query;
    _onSearch(query);
  }

  void _clearSearch() {
    _searchController.clear();
    ref.read(searchProvider.notifier).clear();
    _focusNode.requestFocus();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final searchState = ref.watch(searchProvider);
    final searchHistory = ref.watch(searchHistoryProvider);
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        title: _buildSearchField(l10n, theme),
        actions: [
          if (_searchController.text.isNotEmpty)
            IconButton(
              icon: const Icon(Icons.clear),
              onPressed: _clearSearch,
            ),
        ],
      ),
      body: _buildBody(l10n, searchState, searchHistory, theme),
    );
  }

  Widget _buildSearchField(AppLocalizations l10n, ThemeData theme) {
    return TextField(
      controller: _searchController,
      focusNode: _focusNode,
      autofocus: true,
      decoration: InputDecoration(
        hintText: l10n.searchHint,
        border: InputBorder.none,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      ),
      textInputAction: TextInputAction.search,
      onSubmitted: _onSearch,
      onChanged: (value) {
        setState(() {}); // Update clear button visibility
      },
    );
  }

  Widget _buildBody(
    AppLocalizations l10n,
    SearchState searchState,
    List<String> searchHistory,
    ThemeData theme,
  ) {
    // Show loading
    if (searchState.isLoading && searchState.results.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }

    // Show error
    if (searchState.error != null && searchState.results.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.error_outline, size: 48, color: theme.colorScheme.error),
            const SizedBox(height: 16),
            Text(l10n.error, style: theme.textTheme.titleMedium),
            const SizedBox(height: 8),
            TextButton(
              onPressed: () => _onSearch(_searchController.text),
              child: Text(l10n.retry),
            ),
          ],
        ),
      );
    }

    // Show search results
    if (searchState.query != null && searchState.query!.isNotEmpty) {
      return _buildSearchResults(l10n, searchState, theme);
    }

    // Show search history
    return _buildSearchHistory(l10n, searchHistory, theme);
  }

  Widget _buildSearchHistory(
    AppLocalizations l10n,
    List<String> history,
    ThemeData theme,
  ) {
    if (history.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.search,
              size: 64,
              color: theme.colorScheme.outline,
            ),
            const SizedBox(height: 16),
            Text(
              l10n.searchHint,
              style: theme.textTheme.bodyLarge?.copyWith(
                color: theme.colorScheme.outline,
              ),
            ),
          ],
        ),
      );
    }

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              l10n.recentSearches,
              style: theme.textTheme.titleSmall?.copyWith(
                color: theme.colorScheme.outline,
              ),
            ),
            TextButton(
              onPressed: () {
                ref.read(searchHistoryProvider.notifier).clearAll();
              },
              child: Text(l10n.clearHistory),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: history.map((query) {
            return InputChip(
              label: Text(query),
              onPressed: () => _onHistoryTap(query),
              onDeleted: () {
                ref.read(searchHistoryProvider.notifier).remove(query);
              },
              deleteIcon: const Icon(Icons.close, size: 18),
            );
          }).toList(),
        ),
      ],
    );
  }

  Widget _buildSearchResults(
    AppLocalizations l10n,
    SearchState searchState,
    ThemeData theme,
  ) {
    if (searchState.results.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.search_off,
              size: 64,
              color: theme.colorScheme.outline,
            ),
            const SizedBox(height: 16),
            Text(
              l10n.noSearchResults,
              style: theme.textTheme.bodyLarge?.copyWith(
                color: theme.colorScheme.outline,
              ),
            ),
          ],
        ),
      );
    }

    return ListView.builder(
      controller: _scrollController,
      padding: const EdgeInsets.all(16),
      itemCount: searchState.results.length + (searchState.hasMore ? 1 : 0),
      itemBuilder: (context, index) {
        if (index == searchState.results.length) {
          return const Padding(
            padding: EdgeInsets.all(16),
            child: Center(child: CircularProgressIndicator()),
          );
        }

        final note = searchState.results[index];
        return Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: NoteCard(
            note: note,
            onTap: () => context.push('/notes/${note.id}'),
            onFavorite: () {
              ref.read(notesListProvider.notifier).toggleFavorite(note.id);
            },
          ),
        );
      },
    );
  }
}
