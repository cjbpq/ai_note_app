class AINoteService:
    """Legacy placeholder preserved for backwards compatibility."""

    def __init__(self, *_, **__):  # pragma: no cover - deprecated path
        raise RuntimeError(
            "旧版 AI 笔记服务已移除，请改用 Doubao 流程 (app.services.doubao_service)。"
        )


async def generate_structured_note(*_, **__):  # pragma: no cover - deprecated path
    raise RuntimeError(
        "generate_structured_note 已废弃，请使用 DoubaoVisionService.generate_structured_note。"
    )


ai_note_service = None