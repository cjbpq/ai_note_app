import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { Surface, Text, useTheme } from "react-native-paper";
import { toSafeStringArray } from "../../utils/safeData";
import { MathAwareText } from "../common/MathAwareText";

interface NoteWarningsProps {
  warnings?: string[];
}

export const NoteWarnings: React.FC<NoteWarningsProps> = ({ warnings }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const safeWarnings = toSafeStringArray(warnings);
  const warningColors = theme.dark
    ? {
        background: "rgba(251, 191, 36, 0.12)",
        border: "rgba(251, 191, 36, 0.35)",
        foreground: "#FBBF24",
        text: theme.colors.onSurface,
      }
    : {
        background: "#FFF8E1",
        border: "#F3C969",
        foreground: "#8A5A00",
        text: theme.colors.onSurface,
      };

  if (safeWarnings.length === 0) return null;

  return (
    <Surface
      style={[
        styles.container,
        {
          backgroundColor: warningColors.background,
          borderColor: warningColors.border,
        },
      ]}
      elevation={0}
    >
      <View style={styles.titleRow}>
        <Ionicons
          name="alert-circle-outline"
          size={18}
          color={warningColors.foreground}
        />
        <Text
          variant="titleSmall"
          style={[styles.titleText, { color: warningColors.foreground }]}
        >
          {t("noteDetail.warnings_title")}
        </Text>
      </View>

      <View style={styles.warningList}>
        {safeWarnings.map((warning, index) => (
          <MathAwareText
            key={`warn-${index}`}
            content={warning}
            variant="bodySmall"
            textStyle={[styles.warningText, { color: warningColors.text }]}
            fontSize={13}
            minHeight={28}
            selectable
          />
        ))}
      </View>
    </Surface>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 18,
    padding: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  titleText: {
    fontWeight: "600",
  },
  warningList: {
    marginTop: 8,
    gap: 6,
  },
  warningText: {
    lineHeight: 20,
  },
});

export default NoteWarnings;
