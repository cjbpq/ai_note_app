import asyncio
import json

from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.database import get_db, SessionLocal
from app.models.upload import UploadResponse
from app.models.user import User
from app.schemas.upload_job import UploadJobResponse
from app.services.input_pipeline_service import InputPipelineService
from app.models.upload_job import UploadJob

router = APIRouter()

TERMINAL_JOB_STATUSES = {"FAILED", "PERSISTED"}

UPLOAD_SUCCESS_EXAMPLE = {
    "id": "9c6f5f45-0b7d-48f9-90a9-5f9a0bf6dba0",
    "filename": "lecture-notes.png",
    "file_url": "/static/9c6f5f45-0b7d-48f9-90a9-5f9a0bf6dba0.png",
    "file_size": 123456,
    "content_type": "image/png",
    "upload_time": "2024-05-01T10:15:30",
}


@router.post(
    "/upload",
    response_model=UploadResponse,
    summary="上传图片并创建处理任务",
    description=(
        "保存原始图片到存储后，创建一个 UploadJob 任务。返回的 job `id` 可用于查询"
        " OCR/AI 处理进度以及获取最终笔记。"
    ),
    response_description="上传成功后返回任务和文件相关信息",
    responses={
        200: {
            "description": "上传成功",
            "content": {
                "application/json": {
                    "example": UPLOAD_SUCCESS_EXAMPLE,
                }
            },
        },
        400: {"description": "上传文件缺失或格式错误"},
        401: {"description": "未授权，缺少或无效的 Bearer Token"},
    },
)
async def upload_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """上传图片文件"""
    
    if not file:
        raise HTTPException(400, "没有上传文件")
    
    pipeline = InputPipelineService(db)
    job, storage = pipeline.create_job(
        file,
        user_id=current_user.id,
        device_id=current_user.id,
        source="upload_api",
    )

    return UploadResponse(
        id=job.id,
        filename=job.file_meta["original_name"],
        file_url=storage.url,
        file_size=job.file_meta["size"],
        content_type=job.file_meta["content_type"],
        upload_time=job.created_at,
        progress_url=f"/api/v1/upload/jobs/{job.id}/stream",
    )

@router.get(
    "/jobs/{job_id}",
    response_model=UploadJobResponse,
    summary="查询上传任务详情",
    description="根据 job `id` 返回任务当前状态、OCR/AI 结果以及关联的笔记信息。",
    response_description="任务详情",
    responses={
        200: {"description": "查询成功"},
        403: {"description": "无访问权限"},
        404: {"description": "任务不存在"},
    },
)
async def get_job(job_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    pipeline = InputPipelineService(db)
    job = pipeline.get_job(job_id)
    if job.user_id and job.user_id != current_user.id:
        raise HTTPException(403, "无权访问该上传任务")
    return UploadJobResponse.model_validate(job)


def _serialize_job(job: UploadJob) -> dict:
    return {
        "id": job.id,
        "status": job.status,
        "updated_at": job.updated_at.isoformat() if job.updated_at else None,
        "note_id": job.note_id,
        "error_logs": job.error_logs,
    }


def _format_sse(data: dict, event: str = "message") -> str:
    payload = json.dumps(data, ensure_ascii=False)
    return f"event: {event}\ndata: {payload}\n\n"


@router.get(
    "/jobs/{job_id}/stream",
    summary="实时获取上传任务进度",
    description="通过 Server-Sent Events 推送 UploadJob 状态变化，直至任务完成或失败。",
    responses={
        200: {"description": "SSE 流已建立"},
        403: {"description": "无访问权限"},
        404: {"description": "任务不存在"},
    },
)
async def stream_job_progress(job_id: str, current_user: User = Depends(get_current_user)):
    with SessionLocal() as session:
        job = session.query(UploadJob).filter(UploadJob.id == job_id).first()
        if not job:
            raise HTTPException(status_code=404, detail="上传任务不存在")
        if job.user_id and job.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="无权访问该上传任务")

    async def event_generator():
        previous_snapshot: dict | None = None
        while True:
            with SessionLocal() as session:
                job = session.query(UploadJob).filter(UploadJob.id == job_id).first()

                if not job:
                    yield _format_sse({"error": "上传任务不存在"}, event="error")
                    break

                if job.user_id and job.user_id != current_user.id:
                    yield _format_sse({"error": "无权访问该上传任务"}, event="error")
                    break

                snapshot = _serialize_job(job)

            if snapshot != previous_snapshot:
                previous_snapshot = snapshot
                yield _format_sse(snapshot)

            if snapshot["status"] in TERMINAL_JOB_STATUSES:
                break

            await asyncio.sleep(1.5)

    return StreamingResponse(event_generator(), media_type="text/event-stream")