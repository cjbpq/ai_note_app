import * as Localization from "expo-localization";
import i18next from "i18next";
import "intl-pluralrules";
import { initReactI18next } from "react-i18next";

import en from "./en";
import zh from "./zh";

// 定义资源
const resources = {
  en: { translation: en },
  zh: { translation: zh },
};

// 获取设备语言
const getDeviceLanguage = () => {
  const locales = Localization.getLocales();
  if (locales && locales.length > 0) {
    return locales[0].languageCode;
  }
  return "zh";
};

i18next
  .use(initReactI18next) // 传递 i18next 给 react-i18next
  .init({
    resources,
    lng: getDeviceLanguage() || "zh", // 默认语言
    fallbackLng: "en", // 备用语言

    interpolation: {
      escapeValue: false, // React 已经处理了 XSS
    },
  });

export default i18next;
