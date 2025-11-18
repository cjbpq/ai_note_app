import uuid
import os
from datetime import datetime
from fastapi import UploadFile, HTTPException
import shutil

# 上传文件存储目录
UPLOAD_DIR = "uploaded_images"
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff'}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

def save_upload_file(file: UploadFile, user_id: str = "test_user") -> dict:
    """保存上传的文件"""
    
    # 验证文件类型
    file_extension = os.path.splitext(file.filename)[1].lower()
    if file_extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"不支持的文件类型: {file_extension}")
    
    # 生成唯一文件名
    file_id = str(uuid.uuid4())
    filename = f"{file_id}{file_extension}"
    file_path = os.path.join(UPLOAD_DIR, filename)
    
    # 保存文件
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(500, f"文件保存失败: {str(e)}")
    
    # 获取文件信息
    file_size = os.path.getsize(file_path)
    
    return {
        "id": file_id,
        "filename": filename,
        "original_filename": file.filename,
        "file_path": file_path,
        "file_url": f"/static/{filename}",
        "file_size": file_size,
        "content_type": file.content_type,
        "user_id": user_id,
        "upload_time": datetime.now().isoformat()
    }

def get_file_by_id(file_id: str):
    """根据ID获取文件信息"""
    # 这里可以扩展为从数据库查询
    # 暂时简单实现
    for filename in os.listdir(UPLOAD_DIR):
        if file_id in filename:
            file_path = os.path.join(UPLOAD_DIR, filename)
            return {
                "id": file_id,
                "filename": filename,
                "file_path": file_path,
                "file_url": f"/static/{filename}",
                "file_size": os.path.getsize(file_path)
            }
    return None