import { Link } from "expo-router";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Button, Text } from "react-native-paper";

export default function SettingsScreen() {
  const { t } = useTranslation();
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text variant="headlineMedium">{t("screen.settings_title")}</Text>
      <Link href="/test-api" asChild>
        <Button mode="contained">去测试 API</Button>
      </Link>
    </View>
  );
}
