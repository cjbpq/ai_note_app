/**
 * NoteEditForm 组件
 *
 * 职责：笔记编辑表单，提供标题、标签、内容的输入
 *
 * 特性：
 * 1. 使用 Zustand Store 管理表单状态
 * 2. 提供保存回调，由父组件处理具体保存逻辑
 * 3. 遵循 UI 层只负责渲染的原则
 */
import React from "react";
import { useTranslation } from "react-i18next";
import { Keyboard, StyleSheet, View } from "react-native";
import { Button, TextInput } from "react-native-paper";
import { useNoteEditStore } from "../../store/useNoteEditStore";

// ========== Props 类型定义 ==========
interface NoteEditFormProps {
  /** 保存回调 */
  onSave: () => void;
  /** 是否正在保存中 */
  isSaving: boolean;
}

/**
 * NoteEditForm 组件
 * 编辑模式下的表单，使用 Store 管理状态
 */
export const NoteEditForm: React.FC<NoteEditFormProps> = ({
  onSave,
  isSaving,
}) => {
  const { t } = useTranslation();

  // 从 Store 获取表单数据和更新方法
  const { formData, updateField } = useNoteEditStore();

  /**
   * 处理保存按钮点击
   * 收起键盘后调用父组件的保存回调
   */
  const handleSavePress = () => {
    Keyboard.dismiss();
    onSave();
  };

  return (
    <View style={styles.container}>
      {/* 标题输入 */}
      <TextInput
        label={t("noteDetail.edit_title_placeholder")}
        value={formData.title}
        onChangeText={(value) => updateField("title", value)}
        mode="outlined"
        style={styles.input}
      />

      {/* 标签输入 */}
      <TextInput
        label={t("noteDetail.edit_tags_placeholder")}
        value={formData.tags}
        onChangeText={(value) => updateField("tags", value)}
        mode="outlined"
        style={styles.input}
      />

      {/* 内容输入 */}
      <TextInput
        label={t("noteDetail.edit_content_placeholder")}
        value={formData.content}
        onChangeText={(value) => updateField("content", value)}
        mode="outlined"
        multiline
        numberOfLines={15}
        style={[styles.input, styles.contentInput]}
      />

      {/* 保存按钮 */}
      <Button
        mode="contained"
        onPress={handleSavePress}
        loading={isSaving}
        disabled={isSaving}
        style={styles.saveButton}
      >
        {t("noteDetail.save_button")}
      </Button>
    </View>
  );
};

// ========== 样式定义 ==========
const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  input: {
    marginBottom: 16,
  },
  contentInput: {
    minHeight: 200,
  },
  saveButton: {
    marginTop: 8,
  },
});

export default NoteEditForm;
