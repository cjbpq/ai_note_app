import asyncio
import mimetypes
import os
import uuid
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile, File, Form, Query, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.note import (
    NoteResponse,
    NoteListResponse,
    NoteUpdate,
    ExportFormat,
    NoteGenerationJobResponse,
)
from app.schemas.text import TextExtractionResponse
from app.services.export_service import ExportService
from app.core.dependencies import get_current_user, check_doubao_available
from app.models.user import User
from app.services.input_pipeline_service import InputPipelineService
from app.services.note_service import NoteService
from app.services.doubao_service import DoubaoServiceError, doubao_service
from app.services.pipeline_runner import process_note_job
from app.services.storage_backends import LocalStorageBackend
from app.services.input_pipeline_service import ALLOWED_EXTENSIONS, MAX_FILE_SIZE
from app.utils.text_cleaning import clean_ocr_text

NOTE_JOB_RESPONSE_EXAMPLE = {
    "job_id": "2c9f6bde-8c93-4b8f-8b62-cc62f0cac8ce",
    "status": "ENQUEUED",
    "detail": "笔记生成任务已进入后台队列",
    "file_url": "/static/2c9f6bde-8c93-4b8f-8b62-cc62f0cac8ce.png",
    "queued_at": "2024-05-01T11:20:30",
    "progress_url": "/api/v1/upload/jobs/2c9f6bde-8c93-4b8f-8b62-cc62f0cac8ce/stream",
}

router = APIRouter()


@router.post(
    "/notes/from-image",
    response_model=NoteGenerationJobResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="上传图片并异步生成 AI 笔记",
    description=(
        "上传图片后立即返回 UploadJob 信息，后台异步调用 Doubao 视觉模型生成结构化笔记并持久化。"
        "前端可轮询任务接口以获取最新处理状态。"
    ),
    response_description="后台任务已入队",
    responses={
        202: {
            "description": "任务入队成功",
            "content": {
                "application/json": {
                    "example": NOTE_JOB_RESPONSE_EXAMPLE,
                }
            },
        },
        400: {"description": "请求参数错误"},
        401: {"description": "用户未授权"},
    500: {"description": "Doubao 服务未配置或调用失败"},
    },
    dependencies=[Depends(check_doubao_available)],  # 依赖注入: 自动检查 Doubao 服务可用性
)
async def create_note_from_image(
    background_tasks: BackgroundTasks,  # FastAPI BackgroundTasks 注入
    file: UploadFile = File(..., description="待识别的图片"),
    note_type: str = Form("学习笔记", description="笔记分类"),
    tags: Optional[str] = Form(None, description="以逗号分隔的标签"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """上传图片并异步触发笔记生成任务

    改前问题:
    - 重复的 doubao_service.availability_status() 检查代码 (76-81 行)
    - 使用 asyncio.create_task() 启动后台任务, 异常会被吞没

    为什么改:
    1. 依赖注入消除重复: 使用 dependencies=[Depends(check_doubao_available)] 自动检查
    2. BackgroundTasks 安全: 自动捕获异常并记录日志, 应用关闭时等待任务完成

    学习要点:
    - dependencies 参数: FastAPI 在请求进入端点前自动执行依赖函数
    - BackgroundTasks.add_task: 比 asyncio.create_task 更安全, 异常不会丢失
    - 适用场景: BackgroundTasks 适合请求关联的短期任务 (如发送邮件, 生成报告)
    """
    # Doubao 可用性已在依赖注入中检查, 此处无需重复代码

    pipeline = InputPipelineService(db)
    job, storage = pipeline.create_job(
        file,
        user_id=current_user.id,
        device_id=current_user.id,
        source="library_from_image",
    )

    tags_list = [tag.strip() for tag in tags.split(",") if tag.strip()] if tags else []

    job.status = "QUEUED"
    db.commit()
    db.refresh(job)

    # 改前: asyncio.create_task(...) - 异常被吞没
    # 改后: background_tasks.add_task(...) - 自动异常处理
    background_tasks.add_task(
        process_note_job,
        job.id,
        user_id=current_user.id,
        device_id=current_user.id,
        note_type=note_type,
        tags=tags_list,
    )

    return NoteGenerationJobResponse(
        job_id=job.id,
        status="ENQUEUED",
        detail="笔记生成任务已进入后台队列",
        file_url=storage.url,
        queued_at=job.updated_at,
        progress_url=f"/api/v1/upload/jobs/{job.id}/stream",
    )


@router.post(
    "/text/from-image",
    response_model=TextExtractionResponse,
    summary="上传图片并整理文字",
    description=(
        "上传包含文字的图片，同步调用 Doubao 视觉模型，按照原排版输出 Markdown 或纯文本。"
        "该接口不会创建笔记，仅返回整理后的文本内容。"
    ),
    response_description="整理后的文本内容",
    dependencies=[Depends(check_doubao_available)],  # 依赖注入: 自动检查 Doubao 服务可用性
)
async def extract_text_from_image(
    file: UploadFile = File(..., description="待识别的图片"),
    output_format: str = Form("markdown", description="输出格式：markdown 或 plain_text"),
    detail: Optional[str] = Form(None, description="图像解析细节层级，可选 high/low/auto"),
    current_user: User = Depends(get_current_user),
):
    # Doubao 可用性已在依赖注入中检查, 删除重复的 133-138 行代码

    normalized_format = output_format.strip().lower()
    if normalized_format not in {"markdown", "plain_text"}:
        raise HTTPException(status_code=400, detail="output_format 仅支持 markdown 或 plain_text")

    filename = file.filename or "uploaded.png"
    extension = os.path.splitext(filename)[1].lower()
    if extension not in ALLOWED_EXTENSIONS:
        # 尝试根据 content-type 补充扩展名
        guessed_ext = mimetypes.guess_extension(file.content_type or "")
        if guessed_ext and guessed_ext.lower() in ALLOWED_EXTENSIONS:
            extension = guessed_ext.lower()
        else:
            raise HTTPException(status_code=400, detail=f"不支持的文件类型: {extension or '未知'}")

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="上传文件为空")

    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="文件大小超出限制 (10MB)")

    detail_value: Optional[str] = None
    if detail:
        normalized_detail = detail.strip().lower()
        if normalized_detail not in {"high", "low", "auto"}:
            raise HTTPException(status_code=400, detail="detail 仅支持 high、low 或 auto")
        detail_value = normalized_detail

    storage = LocalStorageBackend()
    stored = storage.store_bytes(
        file_bytes,
        filename=f"{uuid.uuid4()}{extension}",
        content_type=file.content_type,
    )

    try:
        result = await asyncio.to_thread(
            doubao_service.generate_plain_text,
            [stored.path],
            detail=detail_value,
            output_format=normalized_format,
        )
    except DoubaoServiceError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail="Doubao 文本整理失败") from exc

    text_output = result.get("text", "")
    cleaned = clean_ocr_text(text_output) if text_output else ""

    return TextExtractionResponse(
        text=text_output,
        cleaned_text=cleaned or None,
        format=result.get("format", normalized_format),
        file_url=stored.url,
        response=result.get("response"),
    )


@router.get(
    "/notes",
    response_model=NoteListResponse,
    summary="获取笔记列表",
    description="根据分页参数和分类筛选，返回当前用户的笔记集合。",
    response_description="笔记列表和总数",
)
async def list_notes(
    skip: int = 0,
    limit: int = 100,
    category: Optional[str] = None,
    favorite_only: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取用户笔记列表"""
    note_service = NoteService(db)

    if category:
        notes = note_service.get_notes_by_category(current_user.id, category)
    else:
        notes = note_service.get_user_notes(current_user.id, skip, limit)

    if favorite_only:
        notes = [note for note in notes if note.is_favorite]

    return NoteListResponse(notes=notes, total=len(notes))


@router.get(
    "/notes/{note_id}",
    response_model=NoteResponse,
    summary="查询单条笔记",
    description="通过笔记 ID 获取详情，包含结构化数据与原始文本。",
)
async def get_note(
    note_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取特定笔记详情"""
    note_service = NoteService(db)
    note = note_service.get_note_by_id(note_id, current_user.id)

    if not note:
        raise HTTPException(status_code=404, detail="笔记不存在")

    return note


@router.put(
    "/notes/{note_id}",
    response_model=NoteResponse,
    summary="更新笔记内容",
    description="支持修改标题、分类、标签、收藏状态等字段。",
)
async def update_note(
    note_id: uuid.UUID,
    note_update: NoteUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """更新笔记信息"""
    note_service = NoteService(db)

    # 改前问题: Pydantic v1 .dict() 已弃用 (Pydantic v2.0+ 发出 DeprecationWarning)
    # 为什么改: Pydantic v2 使用 .model_dump(), 语义更清晰且性能更好 (Rust 实现)
    # 学习要点: model_dump 比 dict 更明确表达 '序列化模型为字典' 的语义
    update_data = {k: v for k, v in note_update.model_dump().items() if v is not None}

    note = note_service.update_note(note_id, current_user.id, update_data)
    if not note:
        raise HTTPException(status_code=404, detail="笔记不存在")

    return note


@router.post(
    "/notes/{note_id}/favorite",
    response_model=NoteResponse,
    summary="切换收藏状态",
    description="在收藏与未收藏之间切换，返回最新的笔记对象。",
)
async def toggle_favorite(
    note_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """切换笔记收藏状态"""
    note_service = NoteService(db)
    note = note_service.toggle_favorite(note_id, current_user.id)

    if not note:
        raise HTTPException(status_code=404, detail="笔记不存在")

    return note


@router.delete(
    "/notes/{note_id}",
    summary="删除笔记",
    description="按照笔记 ID 删除，执行软删除前的硬删除行为。",
    responses={204: {"description": "删除成功"}, 404: {"description": "笔记不存在"}},
)
async def delete_note(
    note_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """删除笔记"""
    note_service = NoteService(db)
    success = note_service.delete_note(note_id, current_user.id)

    if not success:
        raise HTTPException(status_code=404, detail="笔记不存在")

    return {"message": "笔记删除成功"}


@router.get(
    "/search",
    summary="搜索笔记",
    description="支持通过关键字或笔记 ID 查询结果。",
)
async def search_notes(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    q: Optional[str] = Query(None, description="搜索关键字"),
    note_id: Optional[uuid.UUID] = Query(None, description="按笔记 ID 精准搜索"),
):
    """搜索笔记（支持关键字或 note_id）"""
    note_service = NoteService(db)

    if note_id:
        note = note_service.get_note_by_id(note_id, current_user.id)
        if not note:
            raise HTTPException(status_code=404, detail="无法找到该笔记")
        return NoteListResponse(notes=[note], total=1)

    if not q:
        raise HTTPException(status_code=400, detail="请提供 note_id 或搜索关键字")

    notes = note_service.search_notes(current_user.id, q)
    if not notes:
        raise HTTPException(status_code=404, detail="无法找到该笔记")

    return NoteListResponse(notes=notes, total=len(notes))


@router.get(
    "/categories",
    summary="获取用户的分类列表",
    description="聚合当前用户笔记的分类字段，返回唯一集合。",
)
async def get_categories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取用户的所有分类"""
    note_service = NoteService(db)
    notes = note_service.get_user_notes(current_user.id)

    categories = list({note.category for note in notes if note.category})
    return {"categories": categories}


@router.post(
    "/notes/{note_id}/export",
    summary="导出笔记",
    description="将笔记导出为 Markdown/TXT/JSON 格式。",
    responses={
        200: {"description": "导出成功，返回二进制流"},
        400: {"description": "不支持的导出格式"},
        404: {"description": "笔记不存在"},
    },
)
async def export_note(
    note_id: uuid.UUID,
    export_format: ExportFormat,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """导出笔记为指定格式"""
    note_service = NoteService(db)
    note = note_service.get_note_by_id(note_id, current_user.id)

    if not note:
        raise HTTPException(status_code=404, detail="笔记不存在")

    try:
        content, filename = ExportService.export_note(note, export_format.format)

        content_types = {
            "md": "text/markdown",
            "txt": "text/plain",
            "json": "application/json",
        }

        return Response(
            content=content,
            media_type=content_types.get(export_format.format, "text/plain"),
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )

    except ValueError as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=str(exc)) from exc
