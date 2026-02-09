import * as ImagePicker from "expo-image-picker";
import { useTranslation } from "react-i18next";

import { APP_CONFIG } from "../constants/config";
import { useScanStore } from "../store/useScanStore";
import { useToastStore } from "../store/useToastStore";

/**
 * 封装设备相册/相机交互逻辑
 * 职责：
 * 1. 处理权限（相机 & 相册分别请求）
 * 2. 调用系统拍照 或 选图
 * 3. 将结果存入 Store (pickedImageUri)
 *
 * 使用方式：
 *   const { takePhoto, pickImage, clearImage } = useImagePicker();
 *   - takePhoto()  → 唤起系统相机 → 拍照 → (可选裁剪) → 存入 Store
 *   - pickImage()  → 唤起系统相册 → 选图 → (可选裁剪) → 存入 Store
 *   - clearImage() → 清除已选图片
 */
export const useImagePicker = () => {
  const { t } = useTranslation();
  const setPickedImageUri = useScanStore((state) => state.setPickedImageUri);
  const { showToast } = useToastStore();

  // ── 公共配置（从 APP_CONFIG 统一读取，避免散落魔术值） ──
  const pickerOptions: ImagePicker.ImagePickerOptions = {
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: APP_CONFIG.IMAGE.PICKER_ALLOWS_EDITING,
    aspect: APP_CONFIG.IMAGE.PICKER_ASPECT,
    quality: APP_CONFIG.IMAGE.PICKER_QUALITY,
  };

  /**
   * 从 picker 结果中安全提取 uri 并存入 Store
   * 防御：result / assets 可能为空
   */
  const handleResult = (result: ImagePicker.ImagePickerResult) => {
    if (!result.canceled && result.assets?.[0]?.uri) {
      setPickedImageUri(result.assets[0].uri);
    }
  };

  // ═══════════════════════════════════════════════════════════
  // 拍照（主入口）—— 唤起系统相机
  // ═══════════════════════════════════════════════════════════
  const takePhoto = async () => {
    // 1. 请求相机权限（首次弹窗，后续读缓存）
    const { granted } = await ImagePicker.requestCameraPermissionsAsync();
    if (!granted) {
      showToast(t("toast.camera_permission_required"), "warning");
      return;
    }

    // 2. 调起系统相机
    const result = await ImagePicker.launchCameraAsync(pickerOptions);

    // 3. 结果处理
    handleResult(result);
  };

  // ═══════════════════════════════════════════════════════════
  // 从相册选取（次级入口）
  // ═══════════════════════════════════════════════════════════
  const pickImage = async () => {
    // 1. 请求相册权限
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) {
      showToast(t("toast.gallery_permission_required"), "warning");
      return;
    }

    // 2. 调起系统相册
    const result = await ImagePicker.launchImageLibraryAsync(pickerOptions);

    // 3. 结果处理
    handleResult(result);
  };

  const clearImage = () => {
    setPickedImageUri(null);
  };

  return {
    takePhoto,
    pickImage,
    clearImage,
  };
};
