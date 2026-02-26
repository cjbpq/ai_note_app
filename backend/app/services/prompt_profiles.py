from __future__ import annotations

import copy
import json
import re
import threading
import unicodedata
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Tuple

from app.core.config import settings


def _normalize(value: str) -> str:
    normalized = unicodedata.normalize("NFKC", value or "")
    normalized = normalized.strip().lower()
    normalized = re.sub(r"[\s\-_/]+", "_", normalized)
    return normalized


def _base_schema() -> Dict[str, Any]:
    return {
        "format": {
            "type": "json_schema",
            "name": "structured_learning_note",
            "schema": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "summary": {"type": "string"},
                    "raw_text": {"type": "string"},
                    "sections": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "heading": {"type": "string"},
                                "content": {"type": "string"},
                            },
                            "required": ["heading", "content"],
                            "additionalProperties": False,
                        },
                    },
                    "key_points": {
                        "type": "array",
                        "items": {"type": "string"},
                    },
                    "study_advice": {"type": "string"},
                    "meta": {
                        "type": "object",
                        "additionalProperties": True,
                        "properties": {
                            "subject": {"type": "string"},
                            "prompt_profile": {"type": "string"},
                            "warnings": {
                                "type": "array",
                                "items": {"type": "string"},
                            },
                            "tags": {
                                "type": "array",
                                "items": {"type": "string"},
                            },
                        },
                    },
                },
                "required": [
                    "title",
                    "summary",
                    "raw_text",
                    "sections",
                    "key_points",
                    "study_advice",
                ],
                "additionalProperties": False,
            },
        }
    }


def _extend_schema(
    *, base: Dict[str, Any], extra_properties: Dict[str, Any] | None = None
) -> Dict[str, Any]:
    schema = copy.deepcopy(base)
    properties: Dict[str, Any] = schema["format"]["schema"]["properties"]  # type: ignore[index]
    if extra_properties:
        properties.update(extra_properties)
    return schema


@dataclass(frozen=True)
class PromptProfile:
    key: str
    aliases: Tuple[str, ...]
    display_name: str
    system_template: str
    user_template: str
    schema: Dict[str, Any]

    def render_prompts(self, *, note_type: str, tags: List[str]) -> Tuple[str, str]:
        tags_text = "、".join(tags) if tags else "无特定标签"
        context = {
            "note_type": note_type,
            "subject": self.display_name,
            "display_name": self.display_name,
            "tags_text": tags_text,
            "tags": tags,
        }
        return (
            self.system_template.format(**context),
            self.user_template.format(**context),
        )

    def schema_payload(self) -> Dict[str, Any]:
        return copy.deepcopy(self.schema)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "key": self.key,
            "aliases": list(self.aliases),
            "display_name": self.display_name,
            "system_template": self.system_template,
            "user_template": self.user_template,
            "schema": copy.deepcopy(self.schema),
        }


class PromptRegistry:
    def __init__(self, profiles: Iterable[PromptProfile]) -> None:
        self._profiles: Dict[str, PromptProfile] = {}
        self._alias_map: Dict[str, str] = {}
        for profile in profiles:
            self._profiles[profile.key] = profile
            alias_keys = {profile.key, *profile.aliases}
            for alias in alias_keys:
                self._alias_map[_normalize(alias)] = profile.key
        if "general" not in self._profiles:
            raise ValueError("Prompt registry requires a 'general' profile")

    @property
    def profiles(self) -> Dict[str, PromptProfile]:
        return self._profiles

    def resolve(self, note_type: str) -> PromptProfile:
        key = self._alias_map.get(_normalize(note_type))
        if key is None:
            return self._profiles["general"]
        return self._profiles[key]


DEFAULT_PROFILES: Dict[str, Dict[str, Any]] = {
    "general": {
        "display_name": "学习笔记",
        "aliases": ["default", "学习笔记", "lecture", "note", "general_note", "study_note"],
        "system_template": "你是一名专业的学习笔记整理助手。需要阅读用户提供的图片内容，提取关键信息并产出结构化 JSON。请保持内容准确、逻辑清晰，并且始终使用简体中文。",
        "user_template": "请解析上面的所有图片，提取原始文本并在 JSON 的 raw_text 字段输出完整内容。title 需简洁概括主题；summary 总结重点；sections 按时间或逻辑拆分，每个元素包含 heading 与 content。key_points 提炼 3-7 个要点；study_advice 给出可执行的复习建议。当前主题分类为：{note_type}；标签：{tags_text}。如果存在模糊或无法识别的区域，请在 meta.warnings 中说明。",
        "schema": _base_schema(),
    },
    "classical_chinese": {
        "display_name": "文言文精读",
        "aliases": ["文言文", "古文", "国学", "classical_chinese", "wenyan"],
        "system_template": "你是一位资深的古汉语教师，擅长讲解文言文并翻译成现代汉语。请根据图片中的内容生成结构化笔记，保留原文风貌并提供准确的译注。",
        "user_template": "请完整抄录原文到 raw_text，随后给出现代汉语翻译（translation）以及逐条注释（annotations）。annotations 应为数组，每项包含 original 与 explanation 字段。sections 用于整理段落或语义层次；key_points 聚焦文学特色、历史背景或修辞手法。study_advice 提供背诵及理解建议。若遇到难以辨认的字词，请在 meta.warnings 标注。当前主题：{note_type}；标签：{tags_text}。",
        "schema": _extend_schema(
            base=_base_schema(),
            extra_properties={
                "translation": {"type": "string", "description": "现代汉语翻译"},
                "annotations": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "original": {"type": "string"},
                            "explanation": {"type": "string"},
                        },
                        "required": ["original", "explanation"],
                        "additionalProperties": False,
                    },
                },
            },
        ),
    },
    "math": {
        "display_name": "数学解析",
        "aliases": ["数学", "数理化", "math", "mathematics"],
        "system_template": "你是一名数学竞赛教练，擅长解析题干、公式与解题步骤。务必确保符号与公式正确，逻辑推导严谨。所有数学公式请务必使用 LaTeX 格式（行内公式用 $...$ 包裹，独立公式用 $$...$$ 包裹）。注意：在 JSON 字符串中，LaTeX 的反斜杠必须双重转义（例如 \\\\frac 而非 \\frac）。",
        "user_template": "请提取题干与结论，raw_text 保留完整原文（公式用 LaTeX）。formulas 字段需列出关键公式，包含 formula（LaTeX 格式）与 explanation。worked_examples 为数组，记录每道例题的 problem 与 solution_steps（使用有序列表描述步骤，公式用 LaTeX）。sections 按知识点或题目分组；key_points 总结核心思想；study_advice 给出练习与巩固建议。当前主题：{note_type}；标签：{tags_text}。",
        "schema": _extend_schema(
            base=_base_schema(),
            extra_properties={
                "formulas": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "formula": {"type": "string"},
                            "explanation": {"type": "string"},
                        },
                        "required": ["formula", "explanation"],
                        "additionalProperties": False,
                    },
                },
                "worked_examples": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "problem": {"type": "string"},
                            "solution_steps": {"type": "string", "description": "使用有序列表格式概述步骤"},
                        },
                        "required": ["problem", "solution_steps"],
                        "additionalProperties": False,
                    },
                },
            },
        ),
    },
    "english": {
        "display_name": "英语精读",
        "aliases": ["英语", "english", "language", "esl"],
        "system_template": "你是一位英语教师，专注于词汇、语法和句型讲解。请保持中英文解释准确，并提供必要的例句。",
        "user_template": "raw_text 字段保留原文。vocabulary 为数组，每项包含 term、meaning 与 example。grammar_points 需列出语法点，含 topic、explanation、examples。important_sentences 保存需要背诵的关键句。sections 可按段落或主题拆分。key_points 与 study_advice 聚焦学习策略与巩固方法。当前主题：{note_type}；标签：{tags_text}。",
        "schema": _extend_schema(
            base=_base_schema(),
            extra_properties={
                "vocabulary": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "term": {"type": "string"},
                            "meaning": {"type": "string"},
                            "example": {"type": "string"},
                        },
                        "required": ["term", "meaning"],
                        "additionalProperties": False,
                    },
                },
                "grammar_points": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "topic": {"type": "string"},
                            "explanation": {"type": "string"},
                            "examples": {"type": "string", "description": "可使用项目符号列出例句"},
                        },
                        "required": ["topic", "explanation"],
                        "additionalProperties": False,
                    },
                },
                "important_sentences": {
                    "type": "array",
                    "items": {"type": "string"},
                },
            },
        ),
    },
    "physics": {
        "display_name": "物理要点",
        "aliases": ["物理", "physics", "science_physics"],
        "system_template": "你是一位物理竞赛教练。请解析图片中的知识点、定律与实验步骤，确保公式与单位准确。所有数学公式请务必使用 LaTeX 格式（行内公式用 $...$ 包裹，独立公式用 $$...$$ 包裹）。注意：在 JSON 字符串中，LaTeX 的反斜杠必须双重转义（例如 \\\\frac 而非 \\frac）。",
        "user_template": "raw_text 保存原文（公式用 LaTeX）。principles 列出核心定律（name 与 explanation）。equations 数组包含 symbol、formula（LaTeX 格式）、usage。applications 记录实际应用场景，包含 scenario 与 explanation。sections 用于组织知识结构；key_points 与 study_advice 聚焦理解与实践。当前主题：{note_type}；标签：{tags_text}。",
        "schema": _extend_schema(
            base=_base_schema(),
            extra_properties={
                "principles": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "name": {"type": "string"},
                            "explanation": {"type": "string"},
                        },
                        "required": ["name", "explanation"],
                        "additionalProperties": False,
                    },
                },
                "equations": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "symbol": {"type": "string"},
                            "formula": {"type": "string"},
                            "usage": {"type": "string"},
                        },
                        "required": ["formula"],
                        "additionalProperties": False,
                    },
                },
                "applications": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "scenario": {"type": "string"},
                            "explanation": {"type": "string"},
                        },
                        "required": ["scenario", "explanation"],
                        "additionalProperties": False,
                    },
                },
            },
        ),
    },
}


class PromptProfileManager:
    def __init__(self, path: str | Path, defaults: Dict[str, Dict[str, Any]]) -> None:
        self.path = Path(path)
        self.defaults = copy.deepcopy(defaults)
        self._lock = threading.RLock()
        self._registry: PromptRegistry | None = None
        self._raw_profiles: Dict[str, Dict[str, Any]] = {}
        self._last_mtime: float | None = None
        self.reload(force=True)

    def _get_mtime(self) -> float | None:
        try:
            return self.path.stat().st_mtime
        except FileNotFoundError:
            return None

    def _load_raw_profiles(self) -> Dict[str, Dict[str, Any]]:
        if not self.path.exists():
            self.path.parent.mkdir(parents=True, exist_ok=True)
            self._write_raw_profiles(copy.deepcopy(self.defaults))
            return copy.deepcopy(self.defaults)

        with self.path.open("r", encoding="utf-8") as file:
            data = json.load(file)

        profiles = data.get("profiles")
        if not isinstance(profiles, dict):
            raise ValueError("profiles.json 结构不正确，应包含 profiles 字段")
        return {key: value for key, value in profiles.items() if isinstance(value, dict)}

    def _write_raw_profiles(self, profiles: Dict[str, Dict[str, Any]]) -> None:
        payload = {"profiles": profiles}
        with self.path.open("w", encoding="utf-8") as file:
            json.dump(payload, file, ensure_ascii=False, indent=2)

    def _build_registry(self, profiles: Dict[str, Dict[str, Any]]) -> PromptRegistry:
        prompt_profiles: List[PromptProfile] = []
        for key, payload in profiles.items():
            prompt_profiles.append(self._build_profile(key, payload))
        return PromptRegistry(prompt_profiles)

    def _build_profile(self, key: str, payload: Dict[str, Any]) -> PromptProfile:
        schema_payload = self._ensure_schema(payload.get("schema"))
        aliases = tuple(str(alias).strip() for alias in payload.get("aliases", []) if str(alias).strip())
        return PromptProfile(
            key=key,
            aliases=aliases,
            display_name=str(payload.get("display_name") or key),
            system_template=str(payload.get("system_template") or ""),
            user_template=str(payload.get("user_template") or ""),
            schema=schema_payload,
        )

    def _ensure_schema(self, schema: Any) -> Dict[str, Any]:
        base = _base_schema()
        if not isinstance(schema, dict):
            return base
        try:
            schema_properties = schema["format"]["schema"]["properties"]
            required = schema["format"]["schema"]["required"]
        except KeyError:
            return base

        if not isinstance(schema_properties, dict) or not isinstance(required, list):
            return base

        for field, definition in base["format"]["schema"]["properties"].items():
            schema_properties.setdefault(field, copy.deepcopy(definition))
        for item in base["format"]["schema"]["required"]:
            if item not in required:
                required.append(item)
        return schema

    def _reload_if_needed(self) -> None:
        current_mtime = self._get_mtime()
        if current_mtime and self._last_mtime and current_mtime <= self._last_mtime:
            return
        self.reload(force=True)

    def reload(self, *, force: bool = False) -> None:
        with self._lock:
            if not force:
                current_mtime = self._get_mtime()
                if current_mtime and self._last_mtime and current_mtime <= self._last_mtime:
                    return
            raw_profiles = self._load_raw_profiles()
            registry = self._build_registry(raw_profiles)
            self._registry = registry
            self._raw_profiles = raw_profiles
            self._last_mtime = self._get_mtime()

    def resolve(self, note_type: str) -> PromptProfile:
        with self._lock:
            self._reload_if_needed()
            assert self._registry is not None
            return self._registry.resolve(note_type)

    def list_profiles(self) -> Dict[str, Dict[str, Any]]:
        with self._lock:
            self._reload_if_needed()
            return copy.deepcopy(self._raw_profiles)

    def get_profile(self, key: str) -> Dict[str, Any] | None:
        with self._lock:
            self._reload_if_needed()
            payload = self._raw_profiles.get(key)
            return copy.deepcopy(payload) if payload else None

    def get_default(self, key: str) -> Dict[str, Any] | None:
        with self._lock:
            default = self.defaults.get(key)
            return copy.deepcopy(default) if default else None

    def save_profile(self, payload: Dict[str, Any]) -> PromptProfile:
        key = str(payload.get("key") or payload.get("id") or "").strip()
        if not key:
            raise ValueError("缺少 key 字段")

        sanitized = self._sanitize_payload(key, payload)

        with self._lock:
            raw = self._load_raw_profiles()
            raw[key] = sanitized
            self._write_raw_profiles(raw)
            self.reload(force=True)
            assert self._registry is not None
            return self._registry.profiles[key]

    def delete_profile(self, key: str) -> None:
        if key == "general":
            raise ValueError("general 配置不可删除")

        with self._lock:
            raw = self._load_raw_profiles()
            if key not in raw:
                raise KeyError(f"未找到配置 {key}")
            raw.pop(key)
            self._write_raw_profiles(raw)
            self.reload(force=True)

    def reset_defaults(self) -> None:
        with self._lock:
            self._write_raw_profiles(copy.deepcopy(self.defaults))
            self.reload(force=True)

    def _sanitize_payload(self, key: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        display_name = str(payload.get("display_name") or key).strip()
        system_template = str(payload.get("system_template") or "").strip()
        user_template = str(payload.get("user_template") or "").strip()
        if not system_template or not user_template:
            raise ValueError("system_template 与 user_template 不能为空")

        aliases_input = payload.get("aliases") or []
        if not isinstance(aliases_input, list):
            raise ValueError("aliases 必须是数组")
        aliases = []
        for alias in aliases_input:
            alias_str = str(alias).strip()
            if alias_str and alias_str != key:
                aliases.append(alias_str)

        schema_payload = self._ensure_schema(copy.deepcopy(payload.get("schema")))

        return {
            "display_name": display_name,
            "aliases": aliases,
            "system_template": system_template,
            "user_template": user_template,
            "schema": schema_payload,
        }


prompt_profile_manager = PromptProfileManager(settings.PROMPT_PROFILES_PATH, DEFAULT_PROFILES)


def resolve_prompt_profile(note_type: str) -> PromptProfile:
    return prompt_profile_manager.resolve(note_type)


def list_prompt_profiles() -> Dict[str, Dict[str, Any]]:
    return prompt_profile_manager.list_profiles()


def get_prompt_profile(key: str) -> Dict[str, Any] | None:
    return prompt_profile_manager.get_profile(key)


def get_default_prompt_profile(key: str) -> Dict[str, Any] | None:
    return prompt_profile_manager.get_default(key)


def save_prompt_profile(payload: Dict[str, Any]) -> PromptProfile:
    return prompt_profile_manager.save_profile(payload)


def delete_prompt_profile(key: str) -> None:
    prompt_profile_manager.delete_profile(key)


def reload_prompt_profiles() -> None:
    prompt_profile_manager.reload(force=True)


def reset_prompt_profiles() -> None:
    prompt_profile_manager.reset_defaults()


__all__ = [
    "PromptProfile",
    "PromptRegistry",
    "prompt_profile_manager",
    "resolve_prompt_profile",
    "list_prompt_profiles",
    "get_prompt_profile",
    "get_default_prompt_profile",
    "save_prompt_profile",
    "delete_prompt_profile",
    "reload_prompt_profiles",
    "reset_prompt_profiles",
]
