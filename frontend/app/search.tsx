/**
 * 搜索页面（本地搜索版）
 *
 * 全屏 push 页面（非 modal），无底部 Tab 栏
 * 入口：阅读页 Appbar 搜索图标
 * 退出：搜索栏右侧「取消」按钮 → router.back()
 *
 * 状态机（3 态）：
 * idle → results / empty
 *
 * 布局结构：
 * ┌─ SearchBar ───────────────────────────┐
 * ├─ FilterChips（分类+标签，始终可见）────┤
 * ├─ Content Area ─────────────────────────┤
 * │  idle: 搜索历史 + 引导提示             │
 * │  results: 结果计数 + FlatList           │
 * │  empty: 空状态插画                     │
 * │  noNotes: 暂无笔记提示                │
 * └────────────────────────────────────────┘
 *
 * 分层职责：
 * - UI 层：渲染状态 + 处理交互
 * - Hook 层（useSearch）：本地内存过滤 + 防抖 + 状态推导
 * - 数据源：useNotes 的 TanStack Query 缓存
 */
import { Href, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FlatList,
  Keyboard,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import {
  Badge,
  Chip,
  Icon,
  IconButton,
  ProgressBar,
  Searchbar,
  Text,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import NoteCard from "../components/note-card";
import {
  FilterSummaryBar,
  SearchEmpty,
  SearchIdleContent,
} from "../components/search";
import { useSearch } from "../hooks/useSearch";
import { useSearchHistory } from "../hooks/useSearchHistory";

export default function SearchScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();

  // ── 搜索 Hook（本地搜索 + 筛选状态一体化管理） ────
  const {
    query,
    searchState,
    results,
    resultCount,
    hasNoNotes,
    isLoadingNotes,
    categories,
    allTags,
    selectedCategory,
    selectedTags,
    handleInputChange,
    clearSearch,
    toggleCategory,
    toggleTag,
    clearFilters,
  } = useSearch();

  // ── 搜索历史 Hook ──────────────────────────────────
  const {
    history: searchHistory,
    addHistory,
    removeOne: removeHistory,
    clearAll: clearAllHistory,
  } = useSearchHistory();

  // ── 筛选区域展开/收起 ──
  const [isFilterExpanded, setIsFilterExpanded] = useState(true);

  // 活跃筛选计数（用于 Badge 展示）
  const activeFilterCount = (selectedCategory ? 1 : 0) + selectedTags.length;

  // ── 交互处理 ─────────────────────────────────────

  /** 返回上一页 */
  const handleCancel = useCallback(() => {
    router.back();
  }, [router]);

  /** 点击笔记卡片 → 记录历史 + 收起键盘 + 跳转详情页 */
  const handleNotePress = useCallback(
    (noteId: string, noteTitle: string) => {
      addHistory(noteTitle);
      Keyboard.dismiss();
      router.push(`/note/${noteId}` as Href);
    },
    [router, addHistory],
  );

  /** 点击搜索历史词条 → 填入搜索框触发搜索 */
  const handleHistoryPress = useCallback(
    (title: string) => {
      handleInputChange(title);
    },
    [handleInputChange],
  );

  // ── 筛选 Chips 区域（分类+标签，可收起） ────────
  const renderFilterChips = () => {
    // 笔记为空或加载中 → 不渲染筛选区
    if (hasNoNotes || isLoadingNotes) return null;
    // 分类和标签都为空 → 不渲染
    if (categories.length === 0 && allTags.length === 0) return null;

    return (
      <View style={styles.filterArea}>
        {/* 筛选区头部：标题 + 展开/收起切换 + 活跃计数 Badge */}
        <View style={styles.filterHeader}>
          <Text
            variant="labelMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {t("search.filter_header")}
          </Text>
          <View style={styles.filterToggle}>
            {/* 收起时显示活跃筛选计数 */}
            {!isFilterExpanded && activeFilterCount > 0 && (
              <Badge
                size={18}
                style={{
                  backgroundColor: theme.colors.primary,
                  color: theme.colors.onPrimary,
                }}
              >
                {activeFilterCount}
              </Badge>
            )}
            <IconButton
              icon={isFilterExpanded ? "chevron-up" : "chevron-down"}
              size={20}
              onPress={() => setIsFilterExpanded(!isFilterExpanded)}
            />
          </View>
        </View>

        {/* 展开时显示完整筛选 Chip 列表 */}
        {isFilterExpanded && (
          <>
            {/* 分类 Chip（单选，方角风格） */}
            {categories.length > 0 && (
              <View style={styles.filterSection}>
                <Text
                  variant="bodySmall"
                  style={[styles.filterLabel, { color: theme.colors.outline }]}
                >
                  {t("search.category_title")}
                </Text>
                <View style={styles.chipWrap}>
                  {categories.map((cat) => {
                    const isSelected = selectedCategory === cat.id;
                    return (
                      <Chip
                        key={cat.id}
                        mode={isSelected ? "flat" : "outlined"}
                        selected={isSelected}
                        onPress={() => toggleCategory(cat.id)}
                        style={[
                          styles.categoryChip,
                          isSelected
                            ? { backgroundColor: theme.colors.primary }
                            : { borderColor: theme.colors.outlineVariant },
                        ]}
                        textStyle={
                          isSelected
                            ? { color: theme.colors.onPrimary }
                            : { color: theme.colors.onSurface }
                        }
                        showSelectedCheck={false}
                      >
                        {cat.label}
                      </Chip>
                    );
                  })}
                </View>
              </View>
            )}

            {/* 标签 Chip（多选，圆角风格） */}
            {allTags.length > 0 && (
              <View style={styles.filterSection}>
                <Text
                  variant="bodySmall"
                  style={[styles.filterLabel, { color: theme.colors.outline }]}
                >
                  {t("search.tags_title")}
                </Text>
                <View style={styles.chipWrap}>
                  {allTags.map((tag) => {
                    const isSelected = selectedTags.includes(tag);
                    return (
                      <Chip
                        key={tag}
                        mode="flat"
                        selected={isSelected}
                        onPress={() => toggleTag(tag)}
                        style={[
                          styles.tagChip,
                          isSelected
                            ? {
                                backgroundColor:
                                  theme.colors.secondaryContainer,
                              }
                            : {
                                backgroundColor: theme.colors.surfaceVariant,
                              },
                        ]}
                        textStyle={
                          isSelected
                            ? { color: theme.colors.onSecondaryContainer }
                            : { color: theme.colors.onSurface }
                        }
                        showSelectedCheck={false}
                      >
                        {tag}
                      </Chip>
                    );
                  })}
                </View>
              </View>
            )}

            {/* 活跃筛选条件清除按钮 */}
            {activeFilterCount > 0 && (
              <TouchableOpacity
                onPress={clearFilters}
                style={styles.clearFiltersBtn}
                activeOpacity={0.7}
              >
                <Text
                  variant="labelSmall"
                  style={{ color: theme.colors.primary }}
                >
                  {t("search.clear_filters")}
                </Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    );
  };

  // ── 根据状态渲染内容区域 ─────────────────────────
  const renderContent = () => {
    // 笔记缓存加载中 → 显示简单进度条
    if (isLoadingNotes) {
      return (
        <View style={styles.loadingContainer}>
          <ProgressBar indeterminate color={theme.colors.primary} />
        </View>
      );
    }

    // 笔记缓存为空 → 友好提示
    if (hasNoNotes) {
      return (
        <View style={styles.noNotesContainer}>
          <Icon
            source="notebook-outline"
            size={48}
            color={theme.colors.outline}
          />
          <Text
            variant="bodyLarge"
            style={[styles.noNotesText, { color: theme.colors.onBackground }]}
          >
            {t("search.no_notes")}
          </Text>
          <Text
            variant="bodySmall"
            style={[
              styles.noNotesHint,
              { color: theme.colors.outline, opacity: 0.6 },
            ]}
          >
            {t("search.no_notes_hint")}
          </Text>
        </View>
      );
    }

    switch (searchState) {
      case "idle":
        return (
          <SearchIdleContent
            searchHistory={searchHistory}
            onHistoryPress={handleHistoryPress}
            onHistoryRemove={removeHistory}
            onHistoryClearAll={clearAllHistory}
          />
        );

      case "results":
        return (
          <View style={styles.resultsContainer}>
            {/* 结果计数 */}
            <Text
              variant="bodySmall"
              style={[styles.resultCount, { color: theme.colors.outline }]}
            >
              {t("search.result_count", { count: resultCount })}
            </Text>

            {/* 笔记卡片列表 */}
            <FlatList
              data={results}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => (
                <NoteCard
                  title={item.title}
                  date={item.date}
                  tags={item.tags}
                  imageUrl={item.imageUrls?.[0]}
                  isFavorite={item.isFavorite}
                  highlightQuery={query}
                  onPress={() => handleNotePress(item.id, item.title)}
                />
              )}
            />
          </View>
        );

      case "empty":
        return (
          <SearchEmpty
            query={query}
            hasActiveFilters={!!(selectedCategory || selectedTags.length > 0)}
          />
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
      edges={["top", "bottom"]}
    >
      {/* ── 搜索栏区域 ──────────────────────── */}
      <View style={styles.searchBarRow}>
        <Searchbar
          placeholder={t("search.placeholder")}
          onChangeText={handleInputChange}
          value={query}
          style={[
            styles.searchBar,
            { backgroundColor: theme.colors.surfaceVariant },
          ]}
          inputStyle={styles.searchInput}
          icon="magnify"
          clearIcon="close"
          autoFocus
          onClearIconPress={clearSearch}
        />
        <TouchableOpacity
          onPress={handleCancel}
          style={styles.cancelButton}
          activeOpacity={0.7}
        >
          <Text style={[styles.cancelText, { color: theme.colors.primary }]}>
            {t("search.cancel")}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── 筛选 Chips 区域（分类+标签，可收起） ── */}
      {renderFilterChips()}

      {/* ── 已选筛选汇总栏（收起时或始终显示） ── */}
      {!isFilterExpanded && (
        <FilterSummaryBar
          selectedCategory={selectedCategory}
          selectedTags={selectedTags}
          onClearCategory={() => toggleCategory(selectedCategory!)}
          onRemoveTag={(tag) => toggleTag(tag)}
          onClearAll={clearFilters}
        />
      )}

      {/* ── 内容区域 ────────────────────────── */}
      <View style={styles.contentContainer}>{renderContent()}</View>
    </SafeAreaView>
  );
}

// ========== 样式定义 ==========
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  // ── 搜索栏 ────────────────────────────
  searchBarRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  searchBar: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    elevation: 0,
  },
  searchInput: {
    fontSize: 14,
  },
  cancelButton: {
    paddingLeft: 4,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: "500",
  },
  // ── 筛选区域 ──────────────────────────
  filterArea: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  filterHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  filterToggle: {
    flexDirection: "row",
    alignItems: "center",
  },
  filterSection: {
    marginBottom: 8,
  },
  filterLabel: {
    marginBottom: 6,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    borderRadius: 8,
  },
  /** 分类 Chip：方角风格，视觉区分于标签 */
  categoryChip: {
    borderRadius: 4,
  },
  /** 标签 Chip：圆角风格 */
  tagChip: {
    borderRadius: 16,
  },
  clearFiltersBtn: {
    alignSelf: "flex-start",
    paddingVertical: 4,
    marginTop: 2,
  },
  // ── 内容区 ────────────────────────────
  contentContainer: {
    flex: 1,
  },
  // ── 加载中 ────────────────────────────
  loadingContainer: {
    paddingTop: 8,
  },
  // ── 暂无笔记 ─────────────────────────
  noNotesContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  noNotesText: {
    marginTop: 16,
  },
  noNotesHint: {
    marginTop: 4,
  },
  // ── 搜索结果 ──────────────────────────
  resultsContainer: {
    flex: 1,
  },
  resultCount: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  listContent: {
    paddingBottom: 16,
  },
});
