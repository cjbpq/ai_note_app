import asyncio
import mimetypes
import os
import uuid
from datetime import datetime, timezone
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
    NoteSyncResponse,
    NoteBatchRequest,
    NoteBatchResponse,
    NoteMutationBatchRequest,
    NoteMutationBatchResponse,
    NoteMutationResult,
)
from app.schemas.text import TextExtractionResponse
from app.services.export_service import ExportService
from app.core.dependencies import get_current_user, check_doubao_available
from app.models.user import User
from app.services.note_service import NoteService
from app.services.doubao_service import DoubaoServiceError, doubao_service
from app.services.pipeline_runner import process_note_job
from app.services.storage_backends import LocalStorageBackend
from app.services.input_pipeline_service import (
    InputPipelineService,
    ALLOWED_EXTENSIONS,
    MAX_FILE_SIZE,
    MAX_IMAGE_COUNT,
    MAX_CONCURRENT_NOTE_JOBS_PER_USER,
)
from app.utils.text_cleaning import clean_ocr_text

NOTE_JOB_RESPONSE_EXAMPLE = {
    "job_id": "2c9f6bde-8c93-4b8f-8b62-cc62f0cac8ce",
    "status": "ENQUEUED",
    "detail": "笔记生成任务已进入后台队列",
    "file_urls": ["/static/2c9f6bde-8c93-4b8f-8b62-cc62f0cac8ce_0.png"],
    "queued_at": "2024-05-01T11:20:30",
    "progress_url": "/api/v1/upload/jobs/2c9f6bde-8c93-4b8f-8b62-cc62f0cac8ce/stream",
}

router = APIRouter()
NOTE_JOB_SOURCE = "library_from_image"


@router.post(
    "/notes/from-image",
    response_model=NoteGenerationJobResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="上传图片并异步生成 AI 笔记",
    description=(
        "上传一张或多张图片（最多10张）后立即返回 UploadJob 信息，后台异步调用 Doubao 视觉模型生成结构化笔记并持久化。"
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
        429: {"description": "用户并发任务数超过上限"},
        500: {"description": "Doubao 服务未配置或调用失败"},
    },
    dependencies=[Depends(check_doubao_available)],
)
async def create_note_from_image(
    background_tasks: BackgroundTasks,
    files: Optional[List[UploadFile]] = File(None, description="待识别的图片（最多10张）"),
    file: Optional[UploadFile] = File(None, description="兼容旧参数：单张图片 file"),
    note_type: str = Form("学习笔记", description="笔记分类"),
    tags: Optional[str] = Form(None, description="以逗号分隔的标签"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """上传图片并异步触发笔记生成任务（支持多图，最多10张）"""

    incoming_files: List[UploadFile] = list(files or [])
    if file is not None:
        incoming_files.append(file)

    if not incoming_files:
        raise HTTPException(status_code=400, detail="至少上传一张图片")

    if len(incoming_files) > MAX_IMAGE_COUNT:
        raise HTTPException(status_code=400, detail="传入图片请小于或等于10张")

    pipeline = InputPipelineService(db)
    active_jobs = pipeline.count_active_jobs(user_id=current_user.id, source=NOTE_JOB_SOURCE)
    if active_jobs >= MAX_CONCURRENT_NOTE_JOBS_PER_USER:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"当前并发任务已达上限（{MAX_CONCURRENT_NOTE_JOBS_PER_USER}），请等待部分任务完成后再试",
        )

    job, storage_results = pipeline.create_job(
        incoming_files,
        user_id=current_user.id,
        device_id=current_user.id,
        source=NOTE_JOB_SOURCE,
    )
    normalized_storage_results = storage_results if isinstance(storage_results, list) else [storage_results]

    tags_list = [tag.strip() for tag in tags.split(",") if tag.strip()] if tags else []

    job.status = "QUEUED"
    db.commit()
    db.refresh(job)

    asyncio.create_task(
        process_note_job(
            job.id,
            user_id=current_user.id,
            device_id=current_user.id,
            note_type=note_type,
            tags=tags_list,
        )
    )

    return NoteGenerationJobResponse(
        job_id=job.id,
        status="ENQUEUED",
        detail="笔记生成任务已进入后台队列",
        file_urls=[sr.url for sr in normalized_storage_results],
        queued_at=job.updated_at,
        progress_url=f"/api/v1/upload/jobs/{job.id}/stream",
    )


@router.post(
    "/text/from-image",
    response_model=TextExtractionResponse,
    summary="上传图片并整理文字",
    description=(
        "上传一张或多张包含文字的图片（最多10张），同步调用 Doubao 视觉模型，按照原排版输出 Markdown 或纯文本。"
        "该接口不会创建笔记，仅返回整理后的文本内容。"
    ),
    response_description="整理后的文本内容",
    dependencies=[Depends(check_doubao_available)],
)
async def extract_text_from_image(
    files: Optional[List[UploadFile]] = File(None, description="待识别的图片（最多10张）"),
    file: Optional[UploadFile] = File(None, description="兼容旧参数：单张图片 file"),
    output_format: str = Form("markdown", description="输出格式：markdown 或 plain_text"),
    detail: Optional[str] = Form(None, description="图像解析细节层级，可选 high/low/auto"),
    current_user: User = Depends(get_current_user),
):
    incoming_files: List[UploadFile] = list(files or [])
    if file is not None:
        incoming_files.append(file)

    if not incoming_files:
        raise HTTPException(status_code=400, detail="至少上传一张图片")

    if len(incoming_files) > MAX_IMAGE_COUNT:
        raise HTTPException(status_code=400, detail="传入图片请小于或等于10张")

    normalized_format = output_format.strip().lower()
    if normalized_format not in {"markdown", "plain_text"}:
        raise HTTPException(status_code=400, detail="output_format 仅支持 markdown 或 plain_text")

    detail_value: Optional[str] = None
    if detail:
        normalized_detail = detail.strip().lower()
        if normalized_detail not in {"high", "low", "auto"}:
            raise HTTPException(status_code=400, detail="detail 仅支持 high、low 或 auto")
        detail_value = normalized_detail

    storage = LocalStorageBackend()
    stored_paths = []
    stored_urls = []

    for upload in incoming_files:
        filename = upload.filename or "uploaded.png"
        extension = os.path.splitext(filename)[1].lower()
        if extension not in ALLOWED_EXTENSIONS:
            guessed_ext = mimetypes.guess_extension(upload.content_type or "")
            if guessed_ext and guessed_ext.lower() in ALLOWED_EXTENSIONS:
                extension = guessed_ext.lower()
            else:
                raise HTTPException(status_code=400, detail=f"不支持的文件类型: {extension or '未知'}")

        file_bytes = await upload.read()
        if not file_bytes:
            raise HTTPException(status_code=400, detail=f"上传文件为空: {filename}")

        if len(file_bytes) > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail=f"文件大小超出限制 (10MB): {filename}")

        stored = storage.store_bytes(
            file_bytes,
            filename=f"{uuid.uuid4()}{extension}",
            content_type=upload.content_type,
        )
        stored_paths.append(stored.path)
        stored_urls.append(stored.url)

    try:
        result = await asyncio.to_thread(
            doubao_service.generate_plain_text,
            stored_paths,
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
        file_urls=stored_urls,
        file_url=stored_urls[0] if stored_urls else None,
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
    is_favorite: Optional[bool] = Query(
        None,
        description="是否只返回收藏笔记（兼容参数：is_favorite=true）",
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取用户笔记列表"""
    note_service = NoteService(db)

    if category:
        notes = note_service.get_notes_by_category(current_user.id, category)
    else:
        notes = note_service.get_user_notes(current_user.id, skip, limit)

    favorite_filter = is_favorite if is_favorite is not None else favorite_only
    if favorite_filter:
        notes = [note for note in notes if note.is_favorite]

    return NoteListResponse(notes=notes, total=len(notes))


@router.get(
    "/notes/sync",
    response_model=NoteSyncResponse,
    summary="增量同步笔记",
    description=(
        "客户端传入上次同步的时间戳 `since`，服务端返回此后新增/更新的笔记摘要"
        "（轻量级，不含 original_text 和 structured_data）以及已删除的笔记 ID。"
        "首次同步传入 `since=2000-01-01T00:00:00Z` 或不传即可获取全部。"
        "响应中的 `server_time` 应作为下次同步的 `since` 参数。"
    ),
    response_description="增量同步结果",
)
async def sync_notes(
    since: Optional[datetime] = Query(
        None,
        description="上次同步的 ISO 8601 时间戳，如 2024-01-01T00:00:00Z。不传则返回全量摘要。",
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """增量同步笔记 — 刷新页面时调用

    客户端只需记住上一次返回的 server_time，下次刷新时传入即可拿到增量数据。
    """
    note_service = NoteService(db)
    sync_watermark = datetime.now(timezone.utc)

    # 未传 since 视为首次全量同步
    if since is None:
        since = datetime(2000, 1, 1, tzinfo=timezone.utc)
    elif since.tzinfo is None:
        # naive datetime 视为 UTC
        since = since.replace(tzinfo=timezone.utc)

    updated = note_service.get_notes_updated_since(
        current_user.id,
        since,
        until=sync_watermark,
    )
    deleted_ids = note_service.get_deleted_note_ids_since(
        current_user.id,
        since,
        until=sync_watermark,
    )

    return NoteSyncResponse(
        updated=updated,
        deleted_ids=deleted_ids,
        server_time=sync_watermark,
    )


@router.post(
    "/notes/batch",
    response_model=NoteBatchResponse,
    summary="批量获取笔记详情",
    description=(
        "客户端传入未缓存的笔记 ID 列表（上限 50 条），一次性返回完整笔记内容"
        "（含 original_text 和 structured_data），用于后台静默缓存。"
    ),
    response_description="批量笔记详情",
)
async def batch_get_notes(
    body: NoteBatchRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """批量获取笔记详情 — 后台静默缓存时调用

    客户端可将增量同步获得的新笔记 ID 做分批（每批 ≤ 50），
    逐批调用此接口下载完整内容到本地数据库。
    每条笔记独立可查，中途断网或清后台不影响已缓存的数据。
    """
    note_service = NoteService(db)
    notes = note_service.get_notes_by_ids(current_user.id, body.note_ids)
    return NoteBatchResponse(notes=notes, total=len(notes))


@router.post(
    "/notes/mutations",
    response_model=NoteMutationBatchResponse,
    summary="批量回放离线变更",
    description=(
        "客户端在离线期间记录的变更任务（编辑、收藏、删除）可在恢复网络后批量上传。"
        "服务端按顺序逐条执行，并返回每条任务的处理结果，方便客户端精确重试失败项。"
    ),
    response_description="离线变更处理结果",
)
async def apply_note_mutations(
    body: NoteMutationBatchRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """批量处理客户端离线变更任务。"""
    note_service = NoteService(db)
    results: List[NoteMutationResult] = []

    for mutation in body.mutations:
        note_id = mutation.note_id
        mutation_type = mutation.type

        try:
            if mutation_type == "update_note":
                if mutation.patch is None:
                    results.append(
                        NoteMutationResult(
                            op_id=mutation.op_id,
                            type=mutation_type,
                            note_id=note_id,
                            status="invalid",
                            code=422,
                            message="update_note requires patch",
                        )
                    )
                    continue

                update_data = {
                    key: value
                    for key, value in mutation.patch.model_dump().items()
                    if value is not None
                }
                if not update_data:
                    results.append(
                        NoteMutationResult(
                            op_id=mutation.op_id,
                            type=mutation_type,
                            note_id=note_id,
                            status="invalid",
                            code=422,
                            message="update_note patch cannot be empty",
                        )
                    )
                    continue

                note = note_service.update_note(note_id, current_user.id, update_data)
                if note is None:
                    results.append(
                        NoteMutationResult(
                            op_id=mutation.op_id,
                            type=mutation_type,
                            note_id=note_id,
                            status="not_found",
                            code=404,
                            message="note not found",
                        )
                    )
                    continue

                results.append(
                    NoteMutationResult(
                        op_id=mutation.op_id,
                        type=mutation_type,
                        note_id=note_id,
                        status="applied",
                        code=200,
                        updated_at=note.updated_at,
                    )
                )
                continue

            if mutation_type == "set_favorite":
                if mutation.is_favorite is None:
                    results.append(
                        NoteMutationResult(
                            op_id=mutation.op_id,
                            type=mutation_type,
                            note_id=note_id,
                            status="invalid",
                            code=422,
                            message="set_favorite requires is_favorite",
                        )
                    )
                    continue

                note = note_service.set_favorite(note_id, current_user.id, mutation.is_favorite)
                if note is None:
                    results.append(
                        NoteMutationResult(
                            op_id=mutation.op_id,
                            type=mutation_type,
                            note_id=note_id,
                            status="not_found",
                            code=404,
                            message="note not found",
                        )
                    )
                    continue

                results.append(
                    NoteMutationResult(
                        op_id=mutation.op_id,
                        type=mutation_type,
                        note_id=note_id,
                        status="applied",
                        code=200,
                        updated_at=note.updated_at,
                    )
                )
                continue

            if mutation_type == "delete_note":
                deleted = note_service.delete_note(note_id, current_user.id)
                if not deleted:
                    results.append(
                        NoteMutationResult(
                            op_id=mutation.op_id,
                            type=mutation_type,
                            note_id=note_id,
                            status="not_found",
                            code=404,
                            message="note not found",
                        )
                    )
                    continue

                results.append(
                    NoteMutationResult(
                        op_id=mutation.op_id,
                        type=mutation_type,
                        note_id=note_id,
                        status="applied",
                        code=200,
                    )
                )
                continue
        except Exception as exc:  # noqa: BLE001
            results.append(
                NoteMutationResult(
                    op_id=mutation.op_id,
                    type=mutation_type,
                    note_id=note_id,
                    status="failed",
                    code=500,
                    message=str(exc),
                )
            )

    applied_count = sum(1 for item in results if item.status == "applied")
    return NoteMutationBatchResponse(
        results=results,
        applied_count=applied_count,
        failed_count=len(results) - applied_count,
        server_time=datetime.now(timezone.utc),
    )


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
        # 按 ID 查询也使用轻量级数据，如需完整数据请使用 GET /notes/{id}
        note = note_service.get_note_summary_by_id(note_id, current_user.id)
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
