import { Note } from "@/types";
import React from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, FlatList, StyleSheet, View } from "react-native";
import { Button, Modal, Portal, Text, useTheme } from "react-native-paper";
import NoteCard from "../../components/note-card";
import { useNotes } from "../../hooks/useNotes";

export default function ReadScreen() {
  const { t } = useTranslation();
  const theme = useTheme();

  const { notes, isLoading } = useNotes();
  const [visible, setVisible] = React.useState(false);
  const [selectedNote, setSelectedNote] = React.useState<Note | null>(null);

  const showModal = (note: Note) => {
    setSelectedNote(note);
    setVisible(true);
  };
  const hideModal = () => setVisible(false);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <Portal>
        <Modal
          visible={visible}
          onDismiss={hideModal}
          contentContainerStyle={[
            styles.modalContainer,
            { backgroundColor: theme.colors.surface },
          ]}
        >
          <Text
            variant="headlineSmall"
            style={{ color: theme.colors.onSurface }}
          >
            {selectedNote?.title}
          </Text>
          <Text
            variant="bodySmall"
            style={[styles.modalDate, { color: theme.colors.outline }]}
          >
            {selectedNote?.date}
          </Text>
          <Text
            variant="bodyMedium"
            style={[
              styles.modalContent,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            {selectedNote?.content}
          </Text>
          <Button
            mode="contained"
            onPress={hideModal}
            style={styles.modalButton}
          >
            {t("common.close")}
          </Button>
        </Modal>
      </Portal>

      <FlatList
        data={notes}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <NoteCard
            title={item.title}
            content={item.content}
            date={item.date}
            tags={item.tags}
            onPress={() => showModal(item)}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    paddingVertical: 10,
  },
  modalContainer: {
    padding: 20,
    margin: 20,
    borderRadius: 8,
  },
  modalDate: {
    marginTop: 4,
    marginBottom: 10,
  },
  modalContent: {
    marginTop: 10,
    marginBottom: 20,
  },
  modalButton: {
    marginTop: 10,
  },
});
