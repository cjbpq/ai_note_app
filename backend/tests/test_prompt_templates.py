from app.services import pipeline_runner


def test_normalize_tags_filters_empty_entries():
    tags = ["  math  ", "", "science", "  "]
    assert pipeline_runner._normalize_tags(tags) == ["math", "science"]
