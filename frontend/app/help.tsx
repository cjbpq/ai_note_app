import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, View } from "react-native";
import { Appbar, Divider, List, Text, useTheme } from "react-native-paper";

/**
 * HelpScreen - 帮助与反馈页面（MVP）
 *
 * 职责：
 * 1) 展示常见问题（手风琴，单次仅展开一个）
 * 2) 展示只读联系方式与反馈说明
 */
export default function HelpScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();

  // FAQ 列表使用 key 管理，后续只需改 i18n 即可替换文案
  const faqItems = useMemo(
    () => [
      {
        id: "q1",
        questionKey: "help.faq.how_create.question",
        answerKey: "help.faq.how_create.answer",
      },
      {
        id: "q2",
        questionKey: "help.faq.how_favorite.question",
        answerKey: "help.faq.how_favorite.answer",
      },
      {
        id: "q3",
        questionKey: "help.faq.how_theme.question",
        answerKey: "help.faq.how_theme.answer",
      },
      {
        id: "q4",
        questionKey: "help.faq.forget_password.question",
        answerKey: "help.faq.forget_password.answer",
      },
      {
        id: "q5",
        questionKey: "help.faq.how_sync.question",
        answerKey: "help.faq.how_sync.answer",
      },
    ],
    [],
  );

  // 仅允许单个折叠项展开
  const [expandedId, setExpandedId] = useState<string | undefined>(undefined);

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <Appbar.Header
        mode="small"
        style={{ backgroundColor: theme.colors.surface }}
        elevated={false}
      >
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title={t("help.title")} />
      </Appbar.Header>

      <ScrollView contentContainerStyle={styles.contentContainer}>
        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <Text
            style={[
              styles.sectionTitle,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            {t("help.faq_section")}
          </Text>
          <Divider />

          <List.AccordionGroup
            expandedId={expandedId}
            onAccordionPress={(id) => {
              const nextId = String(id);
              setExpandedId((prev) => (prev === nextId ? undefined : nextId));
            }}
          >
            {faqItems.map((item, index) => (
              <View key={item.id}>
                <List.Accordion
                  id={item.id}
                  title={t(item.questionKey)}
                  titleStyle={[
                    styles.questionTitle,
                    { color: theme.colors.onSurface },
                  ]}
                  style={styles.accordionItem}
                >
                  <Text
                    style={[
                      styles.answerText,
                      { color: theme.colors.onSurfaceVariant },
                    ]}
                  >
                    {t(item.answerKey)}
                  </Text>
                </List.Accordion>
                {index !== faqItems.length - 1 && <Divider />}
              </View>
            ))}
          </List.AccordionGroup>
        </View>

        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <Text
            style={[
              styles.sectionTitle,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            {t("help.contact_section")}
          </Text>
          <Divider />

          <View style={styles.contactContainer}>
            <View
              style={[
                styles.contactItem,
                { backgroundColor: theme.colors.surfaceVariant },
              ]}
            >
              <View
                style={[
                  styles.contactIconWrap,
                  { backgroundColor: theme.colors.primaryContainer },
                ]}
              >
                <Ionicons
                  name="mail-outline"
                  size={20}
                  color={theme.colors.primary}
                />
              </View>
              <View style={styles.contactTextWrap}>
                <Text
                  style={[
                    styles.contactTitle,
                    { color: theme.colors.onSurface },
                  ]}
                >
                  {t("help.contact.email_title")}
                </Text>
                <Text
                  style={[
                    styles.contactDesc,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  {t("help.contact.email_value")}
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.contactItem,
                { backgroundColor: theme.colors.surfaceVariant },
              ]}
            >
              <View
                style={[
                  styles.contactIconWrap,
                  { backgroundColor: theme.colors.primaryContainer },
                ]}
              >
                <Ionicons
                  name="chatbubble-outline"
                  size={20}
                  color={theme.colors.primary}
                />
              </View>
              <View style={styles.contactTextWrap}>
                <Text
                  style={[
                    styles.contactTitle,
                    { color: theme.colors.onSurface },
                  ]}
                >
                  {t("help.contact.feedback_title")}
                </Text>
                <Text
                  style={[
                    styles.contactDesc,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  {t("help.contact.feedback_desc")}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    gap: 16,
  },
  card: {
    borderRadius: 18,
    overflow: "hidden",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "500",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  accordionItem: {
    paddingHorizontal: 4,
  },
  questionTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  answerText: {
    fontSize: 15,
    lineHeight: 22,
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  contactContainer: {
    padding: 12,
    gap: 12,
  },
  contactItem: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  contactIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  contactTextWrap: {
    marginLeft: 12,
    flex: 1,
  },
  contactTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 2,
  },
  contactDesc: {
    fontSize: 16,
    lineHeight: 22,
  },
});
