import * as ImagePicker from "expo-image-picker";
import { useTranslation } from "react-i18next";
import { Alert } from "react-native";
import { useScanStore } from "../store/useScanStore";

/**
 * 封装设备相册/相机交互逻辑
 * 职责：
 * 1. 处理权限
 * 2. 调用系统选图
 * 3. 将结果存入 Store (pickedImageUri)
 */
export const useImagePicker = () => {
  const { t } = useTranslation();
  const setPickedImageUri = useScanStore((state) => state.setPickedImageUri);

  const pickImage = async () => {
    // 1. 请求权限
    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permissionResult.granted === false) {
      Alert.alert(t("home.permission_alert"), t("home.permission_msg"));
      return;
    }

    // 2. 调起选择器
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, // 允许简单裁剪
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const uri = result.assets[0].uri;
      // 3. 存入 Store
      setPickedImageUri(uri);
    }
  };

  const clearImage = () => {
    setPickedImageUri(null);
  };

  return {
    pickImage,
    clearImage,
  };
};
