import json
from datetime import datetime
from app.models.note import Note

class ExportService:
    @staticmethod
    def export_to_markdown(note: Note) -> str:
        """导出为Markdown格式"""
        structured_data = note.structured_data
        
        content = f"# {note.title}\n\n"
        content += f"**创建时间**: {note.created_at.strftime('%Y-%m-%d %H:%M')}\n\n"
        
        if 'summary' in structured_data:
            content += f"## 摘要\n{structured_data['summary']}\n\n"
        
        if 'key_points' in structured_data and structured_data['key_points']:
            content += "## 关键要点\n"
            for point in structured_data['key_points']:
                content += f"- {point}\n"
            content += "\n"
        
        if 'sections' in structured_data and structured_data['sections']:
            for section in structured_data['sections']:
                content += f"## {section.get('heading', '内容')}\n"
                content += f"{section.get('content', '')}\n\n"
        
        if 'study_advice' in structured_data and structured_data['study_advice']:
            content += "## 学习建议\n"
            content += f"{structured_data['study_advice']}\n\n"
        
        # 添加原始文本作为参考
        content += "## 原始文本\n"
        content += f"{note.original_text}\n\n"
        
        # 标签
        if note.tags:
            content += "**标签**: " + ", ".join(note.tags) + "\n"
        
        return content

    @staticmethod
    def export_to_txt(note: Note) -> str:
        """导出为纯文本格式"""
        structured_data = note.structured_data
        
        content = f"标题: {note.title}\n"
        content += f"创建时间: {note.created_at.strftime('%Y-%m-%d %H:%M')}\n"
        content += "=" * 50 + "\n\n"
        
        if 'summary' in structured_data:
            content += f"摘要:\n{structured_data['summary']}\n\n"
        
        if 'key_points' in structured_data and structured_data['key_points']:
            content += "关键要点:\n"
            for i, point in enumerate(structured_data['key_points'], 1):
                content += f"{i}. {point}\n"
            content += "\n"
        
        if 'sections' in structured_data and structured_data['sections']:
            for section in structured_data['sections']:
                content += f"{section.get('heading', '内容')}:\n"
                content += f"{section.get('content', '')}\n\n"
        
        # 添加原始文本
        content += "原始文本:\n"
        content += f"{note.original_text}\n"
        
        return content

    @staticmethod
    def export_to_json(note: Note) -> str:
        """导出为JSON格式"""
        export_data = {
            "title": note.title,
            "created_at": note.created_at.isoformat(),
            "updated_at": note.updated_at.isoformat() if note.updated_at else None,
            "category": note.category,
            "tags": note.tags,
            "is_favorite": note.is_favorite,
            "structured_data": note.structured_data,
            "original_text": note.original_text,
            "image_info": {
                "filename": note.image_filename,
                "url": note.image_url,
                "size": note.image_size
            }
        }
        return json.dumps(export_data, ensure_ascii=False, indent=2)

    @staticmethod
    def export_note(note: Note, format_type: str) -> tuple[str, str]:
        """通用导出方法"""
        if format_type == "md":
            content = ExportService.export_to_markdown(note)
            filename = f"{note.title}_{note.created_at.strftime('%Y%m%d_%H%M')}.md"
        elif format_type == "txt":
            content = ExportService.export_to_txt(note)
            filename = f"{note.title}_{note.created_at.strftime('%Y%m%d_%H%M')}.txt"
        elif format_type == "json":
            content = ExportService.export_to_json(note)
            filename = f"{note.title}_{note.created_at.strftime('%Y%m%d_%H%M')}.json"
        else:
            raise ValueError(f"不支持的导出格式: {format_type}")
        
        return content, filename