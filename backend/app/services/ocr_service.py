class OCRService:
    """Legacy placeholder preserved for backwards compatibility."""

    def __init__(self, *_, **__):  # pragma: no cover - deprecated path
        raise RuntimeError("旧版 OCR 管线已移除，请改用 Doubao 流程。")


def get_ocr_service():  # pragma: no cover - deprecated path
    raise RuntimeError("OCR 服务已废弃，当前系统仅支持 Doubao 视觉能力。")


ocr_service = None