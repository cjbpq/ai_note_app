import React from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { Surface, Text, useTheme } from "react-native-paper";
import { toSafeStringArray } from "../../utils/safeData";
import { StructuredRichText } from "../common/StructuredRichText";

interface NoteKeyPointsProps {
  keyPoints?: string[];
}

export const NoteKeyPoints: React.FC<NoteKeyPointsProps> = ({ keyPoints }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const safeKeyPoints = toSafeStringArray(keyPoints);

  if (safeKeyPoints.length === 0) return null;

  return (
    <Surface style={styles.container} elevation={0}>
      <Text
        variant="titleSmall"
        style={[styles.title, { color: theme.colors.primary }]}
      >
        {t("noteDetail.key_points_title")}
      </Text>

      <View style={styles.points}>
        {safeKeyPoints.map((point, index) => (
          <View key={`kp-${index}`} style={styles.pointRow}>
            <View
              style={[
                styles.accentLine,
                { backgroundColor: theme.colors.primary },
              ]}
            />
            <View style={styles.pointTextContainer}>
              <StructuredRichText
                content={point}
                variant="bodyMedium"
                textStyle={[styles.pointText, { color: theme.colors.onSurface }]}
                fontSize={15}
                minHeight={28}
                selectable
              />
            </View>
          </View>
        ))}
      </View>
    </Surface>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 22,
  },
  title: {
    marginBottom: 12,
    fontWeight: "700",
  },
  points: {
    gap: 14,
  },
  pointRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 12,
  },
  accentLine: {
    width: 3,
    borderRadius: 2,
    opacity: 0.75,
  },
  pointTextContainer: {
    flex: 1,
    paddingVertical: 1,
  },
  pointText: {
    lineHeight: 24,
  },
});

export default NoteKeyPoints;
