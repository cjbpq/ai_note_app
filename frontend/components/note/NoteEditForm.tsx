/**
 * NoteEditForm 组件（方案 B 重构版）
 *
 * 职责：笔记编辑表单，支持结构化字段编辑
 *
 * 可编辑字段：
 * - 标题（title）— TextInput
 * - 分类（category）— TextInput（自由文本）
 * - 标签（tags）— Chip 组 + TextInput 添加
 * - AI 摘要（summary）— 多行 TextInput
 * - 知识要点（keyPoints）— 逐条编辑/删除/添加
 *
 * 只读提示：
 * - 章节内容和学习建议为 AI 生成，暂不支持编辑
 *
 * 架构说明：
 * - UI 层只负责渲染，表单状态由 useNoteEditStore 管理
 * - 保存逻辑由父组件 [id].tsx 的 handleSave 处理
 */
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import {
  Card,
  Chip,
  Divider,
  IconButton,
  Surface,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
import { useNoteEditStore } from "../../store/useNoteEditStore";
import { toSafeStringArray } from "../../utils/safeData";

// ========== Props 类型定义 ==========
interface NoteEditFormProps {
  /** 保存回调 */
  onSave: () => void;
  /** 是否正在保存中 */
  isSaving: boolean;
}

/**
 * NoteEditForm 组件
 * 编辑模式下的结构化表单
 */
export const NoteEditForm: React.FC<NoteEditFormProps> = ({
  onSave,
  isSaving,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();

  // Store 状态和操作
  const {
    formData,
    updateField,
    addTag,
    removeTag,
    addKeyPoint,
    removeKeyPoint,
    updateKeyPoint,
  } = useNoteEditStore();

  // 本地状态：标签输入框和要点输入框
  const [tagInput, setTagInput] = useState("");
  const [keyPointInput, setKeyPointInput] = useState("");

  const safeTags = toSafeStringArray(formData.tags);
  const safeKeyPoints = toSafeStringArray(formData.keyPoints);

  // ===== 标签操作 =====
  const handleAddTag = useCallback(() => {
    const trimmed = tagInput.trim();
    if (trimmed) {
      addTag(trimmed);
      setTagInput("");
    }
  }, [tagInput, addTag]);

  // ===== 要点操作 =====
  const handleAddKeyPoint = useCallback(() => {
    const trimmed = keyPointInput.trim();
    if (trimmed) {
      addKeyPoint(trimmed);
      setKeyPointInput("");
    }
  }, [keyPointInput, addKeyPoint]);

  return (
    <View style={styles.container}>
      {/* ====== 基本信息区域 ====== */}
      <Text
        variant="labelLarge"
        style={[styles.sectionHeader, { color: theme.colors.primary }]}
      >
        {t("noteEdit.section_basic")}
      </Text>

      {/* 标题输入 */}
      <TextInput
        label={t("noteDetail.edit_title_placeholder")}
        value={formData.title}
        onChangeText={(value) => updateField("title", value)}
        mode="outlined"
        style={styles.input}
      />

      {/* 分类输入 */}
      <TextInput
        label={t("noteEdit.category_placeholder")}
        value={formData.category}
        onChangeText={(value) => updateField("category", value)}
        mode="outlined"
        style={styles.input}
        left={<TextInput.Icon icon="folder-outline" />}
      />

      {/* 标签区域 */}
      <View style={styles.tagSection}>
        <Text
          variant="labelMedium"
          style={[styles.fieldLabel, { color: theme.colors.secondary }]}
        >
          {t("noteDetail.tags_label")}
        </Text>

        {/* 已有标签 Chip 列表 */}
        <View style={styles.chipWrap}>
          {safeTags.map((tag) => (
            <Chip
              key={tag}
              style={[
                styles.chip,
                { backgroundColor: theme.colors.secondaryContainer },
              ]}
              textStyle={{ color: theme.colors.onSecondaryContainer }}
              onClose={() => removeTag(tag)}
              compact
            >
              {tag}
            </Chip>
          ))}
        </View>

        {/* 添加标签输入 */}
        <View style={styles.addRow}>
          <TextInput
            placeholder={t("noteEdit.add_tag_placeholder")}
            value={tagInput}
            onChangeText={setTagInput}
            onSubmitEditing={handleAddTag}
            mode="outlined"
            dense
            style={styles.addInput}
            right={
              tagInput.trim() ? (
                <TextInput.Icon icon="plus" onPress={handleAddTag} />
              ) : undefined
            }
          />
        </View>
      </View>

      <Divider style={styles.sectionDivider} />

      {/* ====== AI 内容编辑区域 ====== */}
      <Text
        variant="labelLarge"
        style={[styles.sectionHeader, { color: theme.colors.primary }]}
      >
        {t("noteEdit.section_ai_content")}
      </Text>

      {/* 摘要编辑 */}
      <Card style={styles.aiCard} mode="outlined">
        <Card.Title
          title={t("noteDetail.summary_title")}
          titleVariant="titleSmall"
          titleStyle={{ color: theme.colors.primary }}
          left={(props) => (
            <Ionicons
              {...props}
              name="document-text-outline"
              size={20}
              color={theme.colors.primary}
            />
          )}
        />
        <Card.Content>
          <TextInput
            value={formData.summary}
            onChangeText={(value) => updateField("summary", value)}
            mode="flat"
            multiline
            numberOfLines={4}
            style={[
              styles.aiTextInput,
              { backgroundColor: theme.colors.surfaceVariant },
            ]}
            placeholder={t("noteEdit.summary_placeholder")}
          />
        </Card.Content>
      </Card>

      {/* 知识要点编辑 */}
      <Surface style={styles.keyPointsContainer} elevation={0}>
        <Text
          variant="titleSmall"
          style={[styles.keyPointsTitle, { color: theme.colors.primary }]}
        >
          {t("noteDetail.key_points_title")}
        </Text>

        {/* 要点列表（可逐条编辑、删除） */}
        {safeKeyPoints.map((point, index) => (
          <View key={`kp-edit-${index}`} style={styles.keyPointRow}>
            {/* 序号 */}
            <View
              style={[
                styles.keyPointBadge,
                { backgroundColor: theme.colors.primaryContainer },
              ]}
            >
              <Text
                variant="labelSmall"
                style={{
                  color: theme.colors.onPrimaryContainer,
                  fontSize: 10,
                }}
              >
                {index + 1}
              </Text>
            </View>

            {/* 要点文本（内联编辑） */}
            <TextInput
              value={point}
              onChangeText={(text) => updateKeyPoint(index, text)}
              mode="flat"
              dense
              multiline
              style={[styles.keyPointInput, { backgroundColor: "transparent" }]}
            />

            {/* 删除按钮 */}
            <IconButton
              icon="close-circle-outline"
              size={18}
              iconColor={theme.colors.error}
              onPress={() => removeKeyPoint(index)}
              style={styles.keyPointDelete}
            />
          </View>
        ))}

        {/* 添加要点 */}
        <View style={styles.addRow}>
          <TextInput
            placeholder={t("noteEdit.add_keypoint_placeholder")}
            value={keyPointInput}
            onChangeText={setKeyPointInput}
            onSubmitEditing={handleAddKeyPoint}
            mode="outlined"
            dense
            style={styles.addInput}
            right={
              keyPointInput.trim() ? (
                <TextInput.Icon icon="plus" onPress={handleAddKeyPoint} />
              ) : undefined
            }
          />
        </View>
      </Surface>

      {/* ====== 只读提示 ====== */}
      <View
        style={[
          styles.readOnlyHint,
          { backgroundColor: theme.colors.surfaceVariant },
        ]}
      >
        <Ionicons
          name="information-circle-outline"
          size={16}
          color={theme.colors.onSurfaceVariant}
        />
        <Text
          variant="bodySmall"
          style={[styles.hintText, { color: theme.colors.onSurfaceVariant }]}
        >
          {t("noteEdit.readonly_hint")}
        </Text>
      </View>
    </View>
  );
};

// ========== 样式定义 ==========
const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionHeader: {
    marginBottom: 12,
    fontWeight: "600",
  },
  input: {
    marginBottom: 12,
  },
  fieldLabel: {
    marginBottom: 6,
  },
  tagSection: {
    marginBottom: 8,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 8,
  },
  chip: {
    marginRight: 4,
  },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  addInput: {
    flex: 1,
  },
  sectionDivider: {
    marginVertical: 16,
  },
  aiCard: {
    marginBottom: 12,
  },
  aiTextInput: {
    minHeight: 80,
    borderRadius: 8,
  },
  keyPointsContainer: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  keyPointsTitle: {
    marginBottom: 10,
  },
  keyPointRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  keyPointBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
    marginTop: 10,
  },
  keyPointInput: {
    flex: 1,
    fontSize: 13,
    minHeight: 36,
  },
  keyPointDelete: {
    marginTop: 4,
    marginLeft: 0,
  },
  readOnlyHint: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  hintText: {
    marginLeft: 8,
    flex: 1,
  },
});

export default NoteEditForm;
