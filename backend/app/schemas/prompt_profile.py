from __future__ import annotations

from datetime import datetime
import re
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


COMMENT_PATTERN = re.compile(r"^[A-Za-z0-9\u4e00-\u9fa5\s]+$")


class PromptProfileBase(BaseModel):
    model_config = ConfigDict(protected_namespaces=(), populate_by_name=True)

    key: str = Field(..., description="唯一标识")
    display_name: str = Field(..., description="展示名")
    system_template: str = Field(..., description="系统提示词")
    user_template: str = Field(..., description="用户提示词")
    aliases: List[str] = Field(default_factory=list, description="别名")
    schema_payload: Optional[Dict[str, Any]] = Field(
        default=None,
        alias="schema",
        serialization_alias="schema",
        description="JSON Schema 配置",
    )

    @property
    def schema(self) -> Optional[Dict[str, Any]]:
        return self.schema_payload


class PromptProfileUpsertRequest(PromptProfileBase):
    comment: Optional[str] = Field(default=None, description="本次修改说明")

    @field_validator("comment")
    @classmethod
    def _validate_comment(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        if not COMMENT_PATTERN.fullmatch(value):
            raise ValueError("comment 仅允许填写中文、英文、数字或空格")
        return value


class PromptProfileDeleteRequest(BaseModel):
    comment: Optional[str] = Field(default=None)

    @field_validator("comment")
    @classmethod
    def _validate_comment(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        if not COMMENT_PATTERN.fullmatch(value):
            raise ValueError("comment 仅允许填写中文、英文、数字或空格")
        return value


class PromptProfileResponse(PromptProfileBase):
    updated_at: datetime = Field(description="最后刷新时间")
    last_actor: Optional[str] = Field(default=None, description="最后一次操作的操作者")
    last_comment: Optional[str] = Field(default=None, description="最后一次操作的备注")
    last_version: Optional[int] = Field(default=None, description="最新版本号")


class PromptProfileListResponse(BaseModel):
    profiles: List[PromptProfileResponse]


class PromptProfileVersionResponse(BaseModel):
    id: str
    profile_key: str
    version: int
    payload: Dict[str, Any]
    actor: Optional[str]
    comment: Optional[str]
    created_at: datetime


class PromptProfileRollbackRequest(BaseModel):
    comment: Optional[str] = None

    @field_validator("comment")
    @classmethod
    def _validate_comment(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        if not COMMENT_PATTERN.fullmatch(value):
            raise ValueError("comment 仅允许填写中文、英文、数字或空格")
        return value


class AdminSessionResponse(BaseModel):
    actor: str
    message: str


class PromptProfileDefaultResponse(BaseModel):
    key: str
    payload: Dict[str, Any]


class PromptProfilePreviewRequest(BaseModel):
    note_type: Optional[str] = Field(default=None, description="用于渲染提示词的 note_type；留空则使用当前配置的显示名称")
    tags: List[str] = Field(default_factory=list, description="标签列表，将传入提示词模板")

    @field_validator("note_type")
    @classmethod
    def _normalize_note_type(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        trimmed = value.strip()
        return trimmed or None

    @field_validator("tags")
    @classmethod
    def _normalize_tags(cls, value: List[str]) -> List[str]:
        normalized: List[str] = []
        for item in value or []:
            tag = str(item).strip()
            if tag:
                normalized.append(tag)
        return normalized


class PromptProfilePreviewResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=(), populate_by_name=True)

    key: str
    display_name: str
    note_type: str
    tags: List[str]
    system_prompt: str
    user_prompt: str
    schema_payload: Optional[Dict[str, Any]] = Field(
        default=None,
        alias="schema",
        serialization_alias="schema",
        description="返回的 JSON Schema（若为空则使用默认结构）",
    )

    @property
    def schema(self) -> Optional[Dict[str, Any]]:
        return self.schema_payload
