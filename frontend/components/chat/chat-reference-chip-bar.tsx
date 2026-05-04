import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { IconButton, Surface, Text, useTheme } from "react-native-paper";

import { ChatReferenceNote } from "../../types";

interface ChatReferenceChipBarProps {
  references: ChatReferenceNote[];
  disabled?: boolean;
  onRemove?: (id: string) => void;
}

export const ChatReferenceChipBar = ({
  references,
  disabled = false,
  onRemove,
}: ChatReferenceChipBarProps) => {
  const theme = useTheme();

  if (references.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.content}
    >
      {references.map((reference) => (
        <Surface
          key={reference.id}
          elevation={0}
          style={[
            styles.chip,
            {
              backgroundColor: theme.colors.surfaceVariant,
              borderColor: theme.colors.outlineVariant,
            },
          ]}
        >
          {reference.imageUrl ? (
            <Image
              source={{ uri: reference.imageUrl }}
              style={styles.thumbnail}
              contentFit="cover"
            />
          ) : (
            <View
              style={[
                styles.thumbnailFallback,
                { backgroundColor: theme.colors.primaryContainer },
              ]}
            >
              <MaterialCommunityIcons
                name="note-text-outline"
                size={16}
                color={theme.colors.onPrimaryContainer}
              />
            </View>
          )}
          <Text
            variant="labelMedium"
            numberOfLines={1}
            style={[styles.title, { color: theme.colors.onSurfaceVariant }]}
          >
            {reference.title}
          </Text>
          {onRemove ? (
            <IconButton
              icon="close"
              size={14}
              disabled={disabled}
              onPress={() => onRemove(reference.id)}
              iconColor={theme.colors.onSurfaceVariant}
              style={styles.removeButton}
            />
          ) : null}
        </Surface>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: {
    gap: 8,
    paddingRight: 4,
  },
  chip: {
    height: 42,
    maxWidth: 230,
    minWidth: 120,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingLeft: 5,
    paddingRight: 2,
  },
  thumbnail: {
    width: 32,
    height: 32,
    borderRadius: 6,
  },
  thumbnailFallback: {
    width: 32,
    height: 32,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    flexShrink: 1,
    marginLeft: 8,
  },
  removeButton: {
    width: 28,
    height: 28,
    margin: 0,
  },
});
