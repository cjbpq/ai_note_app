import { Stack } from "expo-router";
import { PaperProvider } from "react-native-paper";
import "../i18n"; // 初始化国际化配置

export default function RootLayout() {
  return (
    <PaperProvider>
      <Stack>
        {/* 指向 (tabs) 目录，并隐藏 Stack 的 header */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </PaperProvider>
  );
}
