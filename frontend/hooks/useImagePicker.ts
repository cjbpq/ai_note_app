import * as ImagePicker from "expo-image-picker";
import { useTranslation } from "react-i18next";

import { APP_CONFIG } from "../constants/config";
import { useScanStore } from "../store/useScanStore";
import { useToastStore } from "../store/useToastStore";

export type ImagePickMode = "crop" | "original";

/**
 * 封装设备相册/相机交互逻辑（多图版）
 *
 * 职责：
 * 1. 处理权限（相机 & 相册分别请求）
 * 2. 相册：支持多选 → 批量追加到 Store（多选时跳过裁剪）
 * 3. 拍照：单张追加到 Store（支持裁剪模式）
 * 4. 移除单张 / 清空全部
 *
 * 注意：
 * - expo-image-picker 的 allowsMultipleSelection 与 allowsEditing 互斥
 *   多选时自动使用原图，不进裁剪
 * - 追加时自动校验数量上限 MAX_UPLOAD_COUNT
 */
export const useImagePicker = () => {
  const { t } = useTranslation();
  const {
    pickedImageUris,
    addPickedImageUris,
    removePickedImageAt,
    clearPickedImages,
  } = useScanStore();
  const { showToast } = useToastStore();

  /** 当前已选数量 */
  const currentCount = pickedImageUris.length;
  /** 最大可选数量 */
  const maxCount = APP_CONFIG.IMAGE.MAX_UPLOAD_COUNT;
  /** 剩余可选数量 */
  const remaining = Math.max(0, maxCount - currentCount);

  /**
   * 根据用户选择构建单张 picker 参数（拍照用）
   */
  const getSinglePickerOptions = (
    mode: ImagePickMode,
  ): ImagePicker.ImagePickerOptions => {
    const shouldEnableEditing =
      mode === "crop" && APP_CONFIG.IMAGE.PICKER_ALLOWS_EDITING;

    const shouldUseFixedAspect =
      shouldEnableEditing && APP_CONFIG.IMAGE.PICKER_CROP_USE_FIXED_ASPECT;

    return {
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: shouldEnableEditing,
      aspect: shouldUseFixedAspect ? APP_CONFIG.IMAGE.PICKER_ASPECT : undefined,
      quality: APP_CONFIG.IMAGE.PICKER_QUALITY,
    };
  };

  /**
   * 构建多选 picker 参数（相册多选用）
   * 注意：allowsMultipleSelection=true 时不能同时 allowsEditing
   */
  const getMultiPickerOptions = (): ImagePicker.ImagePickerOptions => ({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsMultipleSelection: true,
    selectionLimit: remaining, // 0 = 不限制（但 remaining 由前端控制）
    quality: APP_CONFIG.IMAGE.PICKER_QUALITY,
    orderedSelection: true, // iOS 16+ 显示选择顺序
  });

  /**
   * 安全追加 URI —— 检查上限并提示用户
   */
  const safeAppend = (uris: string[]) => {
    if (uris.length === 0) return;

    if (currentCount >= maxCount) {
      showToast(t("home.max_images_reached", { count: maxCount }), "warning");
      return;
    }

    // 截断超出部分
    const allowed = uris.slice(0, remaining);
    addPickedImageUris(allowed);

    if (allowed.length < uris.length) {
      showToast(t("home.max_images_reached", { count: maxCount }), "warning");
    }
  };

  // ═══════════════════════════════════════════════════════════
  // 拍照 —— 单张追加（支持裁剪）
  // ═══════════════════════════════════════════════════════════
  const takePhoto = async (mode: ImagePickMode = "crop") => {
    if (remaining <= 0) {
      showToast(t("home.max_images_reached", { count: maxCount }), "warning");
      return;
    }

    // 1. 请求相机权限
    const { granted } = await ImagePicker.requestCameraPermissionsAsync();
    if (!granted) {
      showToast(t("toast.camera_permission_required"), "warning");
      return;
    }

    // 2. 调起系统相机（单张 + 可裁剪）
    const result = await ImagePicker.launchCameraAsync(
      getSinglePickerOptions(mode),
    );

    // 3. 追加结果
    if (!result.canceled && result.assets?.[0]?.uri) {
      safeAppend([result.assets[0].uri]);
    }
  };

  // ═══════════════════════════════════════════════════════════
  // 相册多选 —— 批量追加（不裁剪）
  // ═══════════════════════════════════════════════════════════
  const pickImages = async () => {
    if (remaining <= 0) {
      showToast(t("home.max_images_reached", { count: maxCount }), "warning");
      return;
    }

    // 1. 请求相册权限
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) {
      showToast(t("toast.gallery_permission_required"), "warning");
      return;
    }

    // 2. 调起系统相册（多选模式）
    const result = await ImagePicker.launchImageLibraryAsync(
      getMultiPickerOptions(),
    );

    // 3. 批量追加
    if (!result.canceled && result.assets?.length) {
      const uris = result.assets.map((a) => a.uri);
      safeAppend(uris);
    }
  };

  // ═══════════════════════════════════════════════════════════
  // 相册单选 —— 保留裁剪能力（向后兼容 / 用户选择单张裁剪场景）
  // ═══════════════════════════════════════════════════════════
  const pickImage = async (mode: ImagePickMode = "crop") => {
    if (remaining <= 0) {
      showToast(t("home.max_images_reached", { count: maxCount }), "warning");
      return;
    }

    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) {
      showToast(t("toast.gallery_permission_required"), "warning");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync(
      getSinglePickerOptions(mode),
    );

    if (!result.canceled && result.assets?.[0]?.uri) {
      safeAppend([result.assets[0].uri]);
    }
  };

  // ═══════════════════════════════════════════════════════════
  // 移除 / 清空
  // ═══════════════════════════════════════════════════════════
  const removeImage = (index: number) => {
    removePickedImageAt(index);
  };

  const clearImage = () => {
    clearPickedImages();
  };

  return {
    takePhoto,
    pickImage,
    pickImages, // 新增：相册多选
    removeImage, // 新增：移除指定图片
    clearImage,
    /** 当前已选数量 */
    currentCount,
    /** 最大可选数量 */
    maxCount,
    /** 是否已达上限 */
    isAtLimit: remaining <= 0,
  };
};
