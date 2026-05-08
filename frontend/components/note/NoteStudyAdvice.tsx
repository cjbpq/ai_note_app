import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { Surface, Text, useTheme } from "react-native-paper";
import {
  getStructuredRichTextContent,
  StructuredRichText,
} from "../common/StructuredRichText";

interface NoteStudyAdviceProps {
  studyAdvice?: unknown;
}

export const NoteStudyAdvice: React.FC<NoteStudyAdviceProps> = ({
  studyAdvice,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const adviceColors = theme.dark
    ? {
        background: "rgba(52, 211, 153, 0.12)",
        border: "rgba(52, 211, 153, 0.34)",
        foreground: "#34D399",
        text: theme.colors.onSurface,
      }
    : {
        background: "#ECFDF5",
        border: "#A7F3D0",
        foreground: "#047857",
        text: theme.colors.onSurface,
      };

  const renderableAdvice = getStructuredRichTextContent(studyAdvice);

  if (!renderableAdvice.trim()) return null;

  return (
    <Surface
      style={[
        styles.container,
        {
          backgroundColor: adviceColors.background,
          borderColor: adviceColors.border,
        },
      ]}
      elevation={0}
    >
      <View style={styles.titleRow}>
        <View
          style={[
            styles.iconBox,
            { backgroundColor: adviceColors.border },
          ]}
        >
          <Ionicons
            name="bulb-outline"
            size={18}
            color={adviceColors.foreground}
          />
        </View>
        <Text
          variant="titleSmall"
          style={[styles.titleText, { color: adviceColors.foreground }]}
        >
          {t("noteDetail.study_advice_title")}
        </Text>
      </View>

      <View style={styles.content}>
        <StructuredRichText
          content={renderableAdvice}
          variant="bodyMedium"
          textStyle={{
            color: adviceColors.text,
            lineHeight: 23,
          }}
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
    marginTop: 22,
    padding: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconBox: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  titleText: {
    fontWeight: "700",
  },
  content: {
    marginTop: 12,
  },
});

export default NoteStudyAdvice;
