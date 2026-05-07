from __future__ import annotations

import html
import re
from dataclasses import dataclass
from typing import Dict, List
from urllib.parse import parse_qs, quote_plus, unquote, urlparse

import httpx

from app.core.config import settings


class WebSearchError(RuntimeError):
    """Raised when web search cannot complete a request."""


@dataclass(frozen=True)
class WebSearchResult:
    title: str
    url: str
    snippet: str

    def as_dict(self) -> Dict[str, str]:
        return {"title": self.title, "url": self.url, "snippet": self.snippet}


class WebSearchService:
    def __init__(self, *, timeout: float | None = None) -> None:
        self.timeout = float(timeout if timeout is not None else settings.WEB_SEARCH_TIMEOUT_SECONDS)

    def search(self, *, query: str, max_results: int | None = None) -> List[Dict[str, str]]:
        if not settings.WEB_SEARCH_ENABLED:
            raise WebSearchError("Web search is disabled")

        clean_query = " ".join(str(query or "").strip().split())
        if not clean_query:
            raise WebSearchError("Search query is empty")

        limit = max(1, min(int(max_results or settings.WEB_SEARCH_MAX_RESULTS or 5), 8))
        provider = str(settings.WEB_SEARCH_PROVIDER or "duckduckgo").strip().lower()
        if provider != "duckduckgo":
            raise WebSearchError(f"Unsupported web search provider: {provider}")

        return [result.as_dict() for result in self._search_duckduckgo(clean_query, limit)]

    def _search_duckduckgo(self, query: str, max_results: int) -> List[WebSearchResult]:
        url = f"https://duckduckgo.com/html/?q={quote_plus(query)}"
        headers = {
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "User-Agent": "AI-Note-WebSearch/1.0",
        }
        try:
            with httpx.Client(timeout=self.timeout, follow_redirects=True) as client:
                response = client.get(url, headers=headers)
                response.raise_for_status()
        except httpx.HTTPError as exc:
            raise WebSearchError(str(exc)) from exc

        results = self._parse_duckduckgo_html(response.text)
        return results[:max_results]

    @classmethod
    def _parse_duckduckgo_html(cls, payload: str) -> List[WebSearchResult]:
        items: List[WebSearchResult] = []
        blocks = re.split(r'<div[^>]+class="[^"]*\bresult\b[^"]*"[^>]*>', payload)
        for block in blocks[1:]:
            title_match = re.search(
                r'<a[^>]+class="[^"]*\bresult__a\b[^"]*"[^>]+href="([^"]+)"[^>]*>(.*?)</a>',
                block,
                re.IGNORECASE | re.DOTALL,
            )
            if not title_match:
                continue

            raw_url, raw_title = title_match.groups()
            title = cls._clean_html(raw_title)
            result_url = cls._normalize_result_url(raw_url)
            if not title or not result_url:
                continue

            snippet = ""
            snippet_match = re.search(
                r'class="[^"]*\bresult__snippet\b[^"]*"[^>]*>(.*?)</(?:a|div)>',
                block,
                re.IGNORECASE | re.DOTALL,
            )
            if snippet_match:
                snippet = cls._clean_html(snippet_match.group(1))

            if not any(item.url == result_url for item in items):
                items.append(WebSearchResult(title=title, url=result_url, snippet=snippet))
        return items

    @staticmethod
    def _clean_html(value: str) -> str:
        without_tags = re.sub(r"<[^>]+>", " ", value or "")
        return " ".join(html.unescape(without_tags).split())

    @staticmethod
    def _normalize_result_url(value: str) -> str:
        decoded = html.unescape(str(value or "").strip())
        if decoded.startswith("//"):
            decoded = "https:" + decoded
        parsed = urlparse(decoded)
        if parsed.netloc.endswith("duckduckgo.com") and parsed.path.startswith("/l/"):
            uddg = parse_qs(parsed.query).get("uddg")
            if uddg:
                decoded = unquote(uddg[0])
        return decoded


web_search_service = WebSearchService()
