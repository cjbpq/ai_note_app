import React from "react";
import { StyleSheet, View } from "react-native";
import { Card, Chip, Text, useTheme } from "react-native-paper";

type NoteCardProps = {
  title: string;
  content: string;
  date?: string;
  tags?: string[];
  onPress?: () => void;
};

export default function NoteCard({
  title,
  content,
  date,
  tags = [],
  onPress,
}: NoteCardProps) {
  // 1. 获取当前主题颜色
  const theme = useTheme();

  return (
    <Card
      // 2. 将样式分为两部分：布局用 styles，颜色/外观用 Paper 属性或 theme
      style={[styles.card, { backgroundColor: theme.colors.elevation.level1 }]}
      onPress={onPress}
      mode="elevated"
    >
      <Card.Content>
        <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
          {title}
        </Text>

        {!!date && (
          <Text
            variant="bodySmall"
            style={[styles.date, { color: theme.colors.outline }]}
          >
            {date}
          </Text>
        )}

        <Text
          variant="bodyMedium"
          numberOfLines={3}
          style={[styles.content, { color: theme.colors.onSurfaceVariant }]}
        >
          {content}
        </Text>

        {tags.length > 0 && (
          <View style={styles.tagLabelContainer}>
            <Text
              variant="bodySmall"
              style={[styles.tagLabel, { color: theme.colors.secondary }]}
            >
              标签：
            </Text>
            <View style={styles.tagsWrap}>
              {tags.map((t) => (
                <Chip
                  key={t}
                  style={styles.tag}
                  textStyle={{ color: theme.colors.onSecondaryContainer }}
                  style={{ backgroundColor: theme.colors.secondaryContainer }}
                  compact
                >
                  {t}
                </Chip>
              ))}
            </View>
          </View>
        )}
      </Card.Content>
    </Card>
  );
}

//  StyleSheet 仅负责布局 (Layout): Margin, Padding, Flex, Size
const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12, // 这里的圆角其实 Card 默认也有，可以根据设计图调整
  },
  date: {
    marginTop: 4,
  },
  content: {
    marginTop: 8,
  },
  tagLabelContainer: {
    marginTop: 12,
  },
  tagLabel: {
    marginBottom: 4,
  },
  tagsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  tag: {
    marginRight: 4,
  },
});
