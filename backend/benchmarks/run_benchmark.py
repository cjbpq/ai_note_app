from __future__ import annotations

import argparse
import asyncio
import json
import logging
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Iterable

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.core.config import settings
from app.services.doubao_service import DoubaoServiceError, doubao_service
from app.utils.text_cleaning import clean_ocr_text

try:
    from .metrics import (
        character_error_rate,
        compare_structured_notes,
        word_error_rate,
    )
except ImportError:  # pragma: no cover - fallback when executed as script
    from benchmarks.metrics import (  # type: ignore
        character_error_rate,
        compare_structured_notes,
        word_error_rate,
    )


logger = logging.getLogger("benchmarks.run")
logging.basicConfig(level=logging.INFO, format="[%(levelname)s] %(message)s")

MANIFEST_PATH = Path(__file__).parent / "fixtures" / "manifest.json"
RESULTS_DIR = Path(__file__).parent / "results"


class BenchmarkError(RuntimeError):
    """Raised when benchmark preconditions are not met."""


def load_manifest(manifest_path: Path) -> Iterable[Dict[str, Any]]:
    if not manifest_path.exists():
        raise BenchmarkError(
            f"Manifest file not found: {manifest_path}. Create it with sample definitions first."
        )
    with manifest_path.open("r", encoding="utf-8") as fp:
        data = json.load(fp)
    if not isinstance(data, list):
        raise BenchmarkError("Manifest file must contain a list of sample definitions.")
    for entry in data:
        entry.setdefault("id", entry.get("image"))
        yield entry


def ensure_paths(entries: Iterable[Dict[str, Any]]) -> None:
    base_dir = Path(__file__).parent
    missing: list[str] = []
    for entry in entries:
        image_path = base_dir / entry["image"]
        if not image_path.exists():
            missing.append(f"image not found: {image_path}")
        reference_path = base_dir / entry.get("reference", "")
        if entry.get("reference") and not reference_path.exists():
            missing.append(f"reference not found: {reference_path}")
    if missing:
        raise BenchmarkError("\n".join(missing))


def run_doubao(image_path: Path, note_type: str, tags: Iterable[str]) -> Dict[str, Any]:
    available, reason = doubao_service.availability_status()
    if not available:
        raise BenchmarkError(f"Doubao 服务不可用: {reason or '未配置 API Key 或 SDK'}")

    try:
        return doubao_service.generate_structured_note([str(image_path)], note_type=note_type, tags=list(tags))
    except DoubaoServiceError as exc:
        raise BenchmarkError(f"Doubao 生成失败: {exc}") from exc
    except Exception as exc:  # noqa: BLE001
        raise BenchmarkError(f"调用 Doubao 发生未知错误: {exc}") from exc


async def process_sample(entry: Dict[str, Any]) -> Dict[str, Any]:
    base_dir = Path(__file__).parent
    image_path = base_dir / entry["image"]
    reference_path = base_dir / entry.get("reference", "")

    note_type = entry.get("note_type", "benchmark")
    tags = entry.get("tags") or []

    doubao_output = run_doubao(image_path, note_type, tags)

    note_payload = doubao_output.get("note") or {}
    raw_text = doubao_output.get("raw_text", "")
    cleaned_text = clean_ocr_text(raw_text)

    reference: Dict[str, Any] | None = None
    reference_text = ""
    if reference_path.exists():
        with reference_path.open("r", encoding="utf-8") as fp:
            reference = json.load(fp)
            reference_text = reference.get("reference_text", "") if reference else ""

    ocr_metrics: Dict[str, Any] | None = None
    ai_metrics: Dict[str, Any] | None = None

    if reference_text:
        ocr_metrics = {
            "character_error_rate": character_error_rate(reference_text, raw_text),
            "word_error_rate": word_error_rate(reference_text, raw_text),
        }

    if reference and reference.get("reference_note") and isinstance(note_payload, dict):
        ai_metrics = compare_structured_notes(reference["reference_note"], note_payload)

    return {
        "id": entry.get("id"),
        "image": str(image_path),
        "reference": str(reference_path) if reference_path.exists() else None,
        "doubao": doubao_output,
        "cleaned_text": cleaned_text,
        "ai_note": note_payload,
        "reference_data": reference,
        "metrics": {
            "ocr": ocr_metrics,
            "ai_note": ai_metrics,
        },
    }


async def run(manifest_path: Path) -> Dict[str, Any]:
    entries = list(load_manifest(manifest_path))
    ensure_paths(entries)

    samples: list[Dict[str, Any]] = []
    for entry in entries:
        result = await process_sample(entry)
        samples.append(result)

    system_info = {
        "doubao_pipeline_enabled": settings.USE_DOUBAO_PIPELINE,
        "doubao_configured": bool(settings.DOUBAO_API_KEY),
    }

    logger.info(
        "System info: Doubao enabled=%s, API key configured=%s",
        system_info["doubao_pipeline_enabled"],
        system_info["doubao_configured"],
    )

    return {
        "generated_at": datetime.utcnow().isoformat(),
        "sample_count": len(samples),
        "system_info": system_info,
        "samples": samples,
    }


def dump_results(payload: Dict[str, Any], output_dir: Path) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    output_path = output_dir / f"pipeline_benchmark_{timestamp}.json"
    with output_path.open("w", encoding="utf-8") as fp:
        json.dump(payload, fp, ensure_ascii=False, indent=2)
    return output_path


def main() -> int:
    parser = argparse.ArgumentParser(description="Run Doubao vision benchmark on curated samples.")
    parser.add_argument(
        "--manifest",
        type=Path,
        default=MANIFEST_PATH,
        help="Path to manifest JSON file (default: benchmarks/fixtures/manifest.json)",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=RESULTS_DIR,
        help="Directory to store benchmark results (default: benchmarks/results/)",
    )
    args = parser.parse_args()

    try:
        payload = asyncio.run(run(args.manifest))
    except BenchmarkError as exc:
        print(f"Benchmark configuration error: {exc}")
        return 1

    output_path = dump_results(payload, args.output_dir)
    print(f"Benchmark completed. Results saved to {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
