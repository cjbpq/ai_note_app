from app.utils.text_cleaning import clean_ocr_text


def test_clean_ocr_text_collapses_whitespace():
    raw = "Hello\t\tWorld  !\n\nThis   is    a test."
    cleaned = clean_ocr_text(raw)
    assert cleaned == "Hello World !\n\nThis is a test."


def test_clean_ocr_text_removes_page_footer():
    raw = "第一章\nPage 2\n内容"
    cleaned = clean_ocr_text(raw)
    assert cleaned == "第一章\n内容"


def test_clean_ocr_text_trims_leading_trailing_blank_lines():
    raw = "\n\nContent line\n\n\n"
    cleaned = clean_ocr_text(raw)
    assert cleaned == "Content line"


def test_clean_ocr_text_handles_zero_width_characters():
    raw = "记\u200b录\u200c文本\uFEFF"
    cleaned = clean_ocr_text(raw)
    assert cleaned == "记录文本"
