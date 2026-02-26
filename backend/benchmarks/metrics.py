from __future__ import annotations

from typing import Any, Dict, Iterable, List


def _levenshtein_distance(reference: Iterable[str], hypothesis: Iterable[str]) -> int:
    ref = list(reference)
    hyp = list(hypothesis)
    if not ref:
        return len(hyp)
    if not hyp:
        return len(ref)

    prev_row = list(range(len(hyp) + 1))
    for i, ref_token in enumerate(ref, start=1):
        curr_row = [i]
        for j, hyp_token in enumerate(hyp, start=1):
            cost = 0 if ref_token == hyp_token else 1
            curr_row.append(
                min(
                    prev_row[j] + 1,      # deletion
                    curr_row[j - 1] + 1,   # insertion
                    prev_row[j - 1] + cost # substitution
                )
            )
        prev_row = curr_row
    return prev_row[-1]


def character_error_rate(reference: str, hypothesis: str) -> float:
    if not reference:
        return 0.0 if not hypothesis else 1.0
    distance = _levenshtein_distance(reference, hypothesis)
    return distance / len(reference)


def word_error_rate(reference: str, hypothesis: str) -> float:
    ref_words = reference.split()
    hyp_words = hypothesis.split()
    if not ref_words:
        return 0.0 if not hyp_words else 1.0
    distance = _levenshtein_distance(ref_words, hyp_words)
    return distance / len(ref_words)


def section_heading_coverage(reference_sections: List[Dict[str, str]], generated_sections: List[Dict[str, str]]) -> float:
    if not reference_sections:
        return 1.0
    ref_headings = {section.get("heading", "").strip() for section in reference_sections if section.get("heading")}
    if not ref_headings:
        return 1.0
    gen_headings = {section.get("heading", "").strip() for section in generated_sections if section.get("heading")}
    if not gen_headings:
        return 0.0
    matches = sum(1 for heading in ref_headings if heading in gen_headings)
    return matches / len(ref_headings)


def key_point_recall(reference_points: Iterable[str], generated_points: Iterable[str]) -> float:
    ref_points = {point.strip() for point in reference_points if point}
    if not ref_points:
        return 1.0
    gen_points = {point.strip() for point in generated_points if point}
    if not gen_points:
        return 0.0
    matches = sum(1 for point in ref_points if point in gen_points)
    return matches / len(ref_points)


def compare_structured_notes(reference_note: Dict[str, Any], generated_note: Dict[str, Any]) -> Dict[str, float]:
    reference_sections = reference_note.get("sections", []) if reference_note else []
    generated_sections = generated_note.get("sections", []) if generated_note else []
    reference_points = reference_note.get("key_points", []) if reference_note else []
    generated_points = generated_note.get("key_points", []) if generated_note else []

    return {
        "section_heading_coverage": section_heading_coverage(reference_sections, generated_sections),
        "key_point_recall": key_point_recall(reference_points, generated_points),
    }
