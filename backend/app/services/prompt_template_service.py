from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Dict, Optional

from pydantic import BaseModel, ValidationError

from app.core.config import settings

logger = logging.getLogger(__name__)


class PromptTemplate(BaseModel):
    system_prompt: str
    user_prompt: str
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None
    description: Optional[str] = None


class RenderedPrompt(BaseModel):
    system_prompt: str
    user_prompt: str
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None


class PromptTemplateService:
    def __init__(self, templates_path: str | Path | None = None) -> None:
        self.templates_path = Path(templates_path or settings.AI_PROMPT_TEMPLATES_PATH)
        self._templates: Dict[str, PromptTemplate] = {}
        self.reload()

    def reload(self) -> None:
        """Reload prompt templates from disk."""
        try:
            with self.templates_path.open("r", encoding="utf-8") as file:
                raw_data: Dict[str, Any] = json.load(file)
        except FileNotFoundError:
            logger.warning("Prompt template file not found: %s", self.templates_path)
            self._templates = {}
            return
        except json.JSONDecodeError as exc:
            logger.error("Failed to parse prompt template file %s: %s", self.templates_path, exc)
            self._templates = {}
            return

        templates: Dict[str, PromptTemplate] = {}
        for name, payload in raw_data.items():
            try:
                templates[name] = PromptTemplate(**payload)
            except ValidationError as exc:  # pragma: no cover - configuration issue
                logger.error("Invalid prompt template '%s': %s", name, exc)
        self._templates = templates

    def render(self, name: str, **context: Any) -> RenderedPrompt:
        """Render a prompt template with dynamic context."""
        template = self._templates.get(name)
        if not template:
            raise KeyError(f"Prompt template '{name}' not found")

        try:
            user_prompt = template.user_prompt.format(**context)
        except KeyError as exc:
            missing_key = exc.args[0]
            raise KeyError(
                f"Missing context key '{missing_key}' for template '{name}'"
            ) from exc

        return RenderedPrompt(
            system_prompt=template.system_prompt,
            user_prompt=user_prompt,
            temperature=template.temperature,
            max_tokens=template.max_tokens,
        )


prompt_template_service = PromptTemplateService()
