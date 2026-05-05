import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { Surface, Text, useTheme } from "react-native-paper";
import { MathAwareText } from "../common/MathAwareText";

interface NoteSummaryCardProps {
  summary?: string;
}

export const NoteSummaryCard: React.FC<NoteSummaryCardProps> = ({
  summary,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const summaryColors = theme.dark
    ? {
        background: "rgba(208, 188, 255, 0.11)",
        border: "rgba(208, 188, 255, 0.38)",
        iconBackground: "rgba(208, 188, 255, 0.18)",
        foreground: theme.colors.primary,
      }
    : {
        background: "#F8F2FF",
        border: "#D8C8FF",
        iconBackground: theme.colors.primaryContainer,
        foreground: theme.colors.primary,
      };

  if (!summary) return null;

  return (
    <Surface
      style={[
        styles.container,
        {
          backgroundColor: summaryColors.background,
          borderColor: summaryColors.border,
        },
      ]}
      elevation={0}
    >
      <View style={styles.headerRow}>
        <View
          style={[
            styles.iconBox,
            { backgroundColor: summaryColors.iconBackground },
          ]}
        >
          <Ionicons
            name="sparkles-outline"
            size={18}
            color={summaryColors.foreground}
          />
        </View>
        <Text
          variant="titleSmall"
          style={[styles.title, { color: summaryColors.foreground }]}
        >
          {t("noteDetail.summary_title")}
        </Text>
      </View>

      <View style={styles.content}>
        <MathAwareText
          content={summary}
          variant="bodyMedium"
          textStyle={{ color: theme.colors.onSurface, lineHeight: 23 }}
          fontSize={15}
          selectable
        />
      </View>
    </Surface>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 18,
    padding: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  title: {
    fontWeight: "700",
  },
  iconBox: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    marginTop: 12,
  },
});

export default NoteSummaryCard;
