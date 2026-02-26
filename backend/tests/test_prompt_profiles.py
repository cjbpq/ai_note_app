from app.services.prompt_profiles import resolve_prompt_profile


def test_resolve_profile_aliases():
    profile = resolve_prompt_profile("数学")
    assert profile.key == "math"
    system_prompt, user_prompt = profile.render_prompts(note_type="数学", tags=["函数"])
    assert "数学" in system_prompt
    assert "函数" in user_prompt


def test_profile_schema_contains_subject_specific_fields():
    profile = resolve_prompt_profile("文言文")
    schema = profile.schema_payload()
    properties = schema["format"]["schema"]["properties"]
    assert "translation" in properties
    assert "annotations" in properties


def test_unknown_subject_falls_back_to_general():
    profile = resolve_prompt_profile("未知学科")
    assert profile.key == "general"
    system_prompt, _ = profile.render_prompts(note_type="未知学科", tags=[])
    assert "学习笔记" in system_prompt
