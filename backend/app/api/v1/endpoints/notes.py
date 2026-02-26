from fastapi import APIRouter, HTTPException

router = APIRouter()


@router.get("/")
async def deprecated_notes_root() -> dict:
    """Legacy diagnostic endpoint retained for backwards compatibility."""
    return {
        "message": "原笔记生成接口已下线，请改用 /api/v1/library 路由。",
        "available": False,
    }


@router.post("/generate-note")
async def deprecated_generate_note() -> None:
    """Doubao-only backend no longer supports direct text generation via this route."""
    raise HTTPException(
        status_code=410,
        detail="该端点已弃用，请通过 /api/v1/library/notes/from-image 调用豆包生成笔记。",
    )


@router.get("/test")
async def deprecated_test_endpoint() -> None:
    """Signal that the legacy AI test route is no longer available."""
    raise HTTPException(
        status_code=410,
        detail="AI 服务测试端点已移除。",
    )
