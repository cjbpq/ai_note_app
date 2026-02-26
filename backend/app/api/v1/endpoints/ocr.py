from fastapi import APIRouter, HTTPException

router = APIRouter()


@router.get("/debug-config")
async def deprecated_debug_config() -> dict:
    return {
        "status": "removed",
        "message": "OCR 调试端点已移除，系统现仅依赖豆包视觉能力。",
    }


@router.post("/ocr/{file_id}")
async def deprecated_recognize_text(file_id: str) -> None:
    raise HTTPException(
        status_code=410,
        detail="OCR 模块已下线，请直接使用 /library/notes/from-image 接口。",
    )


@router.post("/upload-and-recognize")
async def deprecated_upload_and_recognize() -> None:
    raise HTTPException(
        status_code=410,
        detail="即时 OCR 接口已弃用，豆包流程会在后台自动处理图像。",
    )


@router.get("/test")
async def deprecated_test() -> None:
    raise HTTPException(status_code=410, detail="OCR 测试端点已移除。")


@router.post("/generate-note")
async def deprecated_generate_note() -> None:
    raise HTTPException(status_code=410, detail="请通过 Doubao 流程生成笔记。")


@router.get("/test-ai")
async def deprecated_test_ai() -> None:
    raise HTTPException(status_code=410, detail="AI 模块测试端点已移除。")