import React from "react";
import { useTranslation } from "react-i18next";
import { FlatList, View } from "react-native";
import { Button, Modal, Portal, Text } from "react-native-paper";
import NoteCard from "../../components/note-card";
import { Note, useNoteStore } from "../../store/useNoteStore";

export default function Index() {
  const { t } = useTranslation();
  const notes = useNoteStore((state) => state.notes);
  const [visible, setVisible] = React.useState(false);
  const [selectedNote, setSelectedNote] = React.useState<Note | null>(null);

  const showModal = (note: Note) => {
    setSelectedNote(note);
    setVisible(true);
  };
  const hideModal = () => setVisible(false);
  const containerStyle = {
    backgroundColor: "white",
    padding: 20,
    margin: 20,
    borderRadius: 8,
  };

  return (
    <View style={{ flex: 1 }}>
      <Portal>
        <Modal
          visible={visible}
          onDismiss={hideModal}
          contentContainerStyle={containerStyle}
        >
          <Text variant="headlineSmall">{selectedNote?.title}</Text>
          <Text variant="bodySmall" style={{ opacity: 0.5, marginBottom: 10 }}>
            {selectedNote?.date}
          </Text>
          <Text
            variant="bodyMedium"
            style={{ marginTop: 10, marginBottom: 20 }}
          >
            {selectedNote?.content}
          </Text>
          <Button mode="contained" onPress={hideModal}>
            {t("common.close")}
          </Button>
        </Modal>
      </Portal>

      <FlatList
        data={notes}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingVertical: 10 }}
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
