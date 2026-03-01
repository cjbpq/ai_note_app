import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, View } from "react-native";
import { Appbar, Divider, Text, useTheme } from "react-native-paper";

/**
 * AboutScreen - 关于页面（MVP）
 *
 * 职责：
 * 1) 展示产品基础信息（名称、版本徽标、简介）
 * 2) 展示团队信息与版本信息（只读）
 */
export default function AboutScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();

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
        <Appbar.Content title={t("about.title")} />
      </Appbar.Header>

      <ScrollView contentContainerStyle={styles.contentContainer}>
        <View
          style={[
            styles.productCard,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.outlineVariant,
            },
          ]}
        >
          <View
            style={[
              styles.logoWrap,
              { backgroundColor: theme.colors.primaryContainer },
            ]}
          >
            <Ionicons
              name="sparkles-outline"
              size={40}
              color={theme.colors.primary}
            />
          </View>
          <Text
            style={[styles.productNameCn, { color: theme.colors.onSurface }]}
          >
            {t("about.product.name_cn")}
          </Text>
          <Text
            style={[
              styles.productNameEn,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            {t("about.product.name_en")}
          </Text>
          <View
            style={[
              styles.versionBadge,
              { backgroundColor: theme.colors.secondaryContainer },
            ]}
          >
            <Text
              style={[
                styles.versionBadgeText,
                { color: theme.colors.onSecondaryContainer },
              ]}
            >
              {t("about.product.badge_version")}
            </Text>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <Text
            style={[
              styles.sectionTitle,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            {t("about.app_intro_section")}
          </Text>
          <Divider />
          <Text style={[styles.introText, { color: theme.colors.onSurface }]}>
            {t("about.app_intro_text")}
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <Text
            style={[
              styles.sectionTitle,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            {t("about.team_section")}
          </Text>
          <Divider />
          <View style={styles.kvBlock}>
            <View style={styles.kvRow}>
              <Text
                style={[
                  styles.kvLabel,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                {t("about.team.name_label")}
              </Text>
              <Text style={[styles.kvValue, { color: theme.colors.onSurface }]}>
                {t("about.team.name_value")}
              </Text>
            </View>
            <View style={styles.kvRow}>
              <Text
                style={[
                  styles.kvLabel,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                {t("about.team.school_label")}
              </Text>
              <Text style={[styles.kvValue, { color: theme.colors.onSurface }]}>
                {t("about.team.school_value")}
              </Text>
            </View>
            <View style={styles.kvRow}>
              <Text
                style={[
                  styles.kvLabel,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                {t("about.team.email_label")}
              </Text>
              <Text style={[styles.kvValue, { color: theme.colors.onSurface }]}>
                {t("about.team.email_value")}
              </Text>
            </View>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <Text
            style={[
              styles.sectionTitle,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            {t("about.version_section")}
          </Text>
          <Divider />
          <View style={styles.kvBlock}>
            <View style={styles.kvRow}>
              <Text
                style={[
                  styles.kvLabel,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                {t("about.version.current_label")}
              </Text>
              <Text style={[styles.kvValue, { color: theme.colors.onSurface }]}>
                {t("about.version.current_value")}
              </Text>
            </View>
            <View style={styles.kvRow}>
              <Text
                style={[
                  styles.kvLabel,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                {t("about.version.build_label")}
              </Text>
              <Text style={[styles.kvValue, { color: theme.colors.onSurface }]}>
                {t("about.version.build_value")}
              </Text>
            </View>
            <View style={styles.kvRow}>
              <Text
                style={[
                  styles.kvLabel,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                {t("about.version.runtime_label")}
              </Text>
              <Text style={[styles.kvValue, { color: theme.colors.onSurface }]}>
                {t("about.version.runtime_value")}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.copyrightWrap}>
          <Text
            style={[
              styles.copyrightText,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            {t("about.copyright_line1")}
          </Text>
          <Text
            style={[
              styles.copyrightText,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            {t("about.copyright_line2")}
          </Text>
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
  productCard: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  logoWrap: {
    width: 92,
    height: 92,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  productNameCn: {
    fontSize: 40,
    fontWeight: "700",
    marginBottom: 4,
  },
  productNameEn: {
    fontSize: 36,
    marginBottom: 14,
  },
  versionBadge: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  versionBadgeText: {
    fontSize: 15,
    fontWeight: "600",
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
  introText: {
    fontSize: 20,
    lineHeight: 32,
    fontWeight: "600",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  kvBlock: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  kvRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  kvLabel: {
    fontSize: 16,
    flexShrink: 0,
  },
  kvValue: {
    fontSize: 16,
    fontWeight: "600",
    textAlign: "right",
    flex: 1,
  },
  copyrightWrap: {
    alignItems: "center",
    paddingTop: 4,
    paddingBottom: 8,
    gap: 4,
  },
  copyrightText: {
    fontSize: 14,
  },
});
