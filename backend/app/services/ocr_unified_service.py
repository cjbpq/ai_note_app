class OCRUnifiedServiceError(RuntimeError):
    """Raised when legacy OCR unified service access is attempted."""


class OCRUnifiedService:
    """Legacy placeholder preserved for backwards compatibility."""

    def __init__(self, *_, **__):  # pragma: no cover - deprecated path
        raise OCRUnifiedServiceError("OCR 统一服务已移除，当前仅支持 Doubao 流程。")


ocr_unified_service = None