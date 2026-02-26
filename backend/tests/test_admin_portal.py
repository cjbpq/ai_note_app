from __future__ import annotations

import hashlib
from pathlib import Path

from fastapi.testclient import TestClient

from app.core.config import settings
from app.database import SessionLocal
from app.main import app
from app.models.prompt_profile_version import PromptProfileVersion
from app.services.admin_key_binding import delete_binding
from app.services.prompt_profiles import reload_prompt_profiles


def test_admin_prompt_crud_flow(tmp_path):
    client = TestClient(app)

    original_key = settings.ADMIN_PORTAL_API_KEY
    original_path = Path(settings.PROMPT_PROFILES_PATH)
    original_content = original_path.read_text(encoding="utf-8")

    # 使用临时文件替换配置，避免污染真实数据
    temp_profiles = tmp_path / "profiles.json"
    temp_profiles.write_text(original_content, encoding="utf-8")
    settings.ADMIN_PORTAL_API_KEY = "unit-test-key"

    # 调整 manager 使用的文件路径
    from app.services.prompt_profiles import prompt_profile_manager  # noqa: WPS433

    prompt_profile_manager.path = temp_profiles
    prompt_profile_manager.reload(force=True)

    headers = {
        "X-Admin-Key": "unit-test-key",
        "X-Admin-Actor": "tester",
    }

    try:
        # 登录校验
        resp = client.post("/api/admin/session", headers=headers)
        assert resp.status_code == 200
        assert resp.json()["actor"] == "tester"

        resp = client.post(
            "/api/admin/session",
            headers={
                "X-Admin-Key": "unit-test-key",
                "X-Admin-Actor": "other",
            },
        )
        assert resp.status_code == 400
        assert "已绑定" in resp.json()["detail"]

        # 列表接口
        resp = client.get("/api/admin/prompts", headers=headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "profiles" in data
        assert all("last_version" in item for item in data["profiles"])

        # 新增 / 更新
        payload = {
            "key": "unit_math",
            "display_name": "Single Test Math",
            "system_template": "You are a math teacher.",
            "user_template": "Please output the formula",
            "aliases": ["math", "Math"],
            "comment": "add unit math",
        }
        resp = client.post("/api/admin/prompts", json=payload, headers=headers)
        assert resp.status_code == 201
        created = resp.json()
        assert created["key"] == "unit_math"
        assert created["display_name"] == "Single Test Math"
        assert created["last_version"] == 1
        assert created["last_actor"] == "tester"
        assert created["last_comment"] == "add unit math"

        # 查看详情
        resp = client.get("/api/admin/prompts/unit_math", headers=headers)
        assert resp.status_code == 200
        detail = resp.json()
        assert detail["system_template"].startswith("You are a math teacher")
        assert detail["last_version"] == 1
        assert detail["last_actor"] == "tester"

        # 预览接口
        resp = client.post(
            "/api/admin/prompts/unit_math/preview",
            json={"note_type": "数学", "tags": ["函数", "极限"]},
            headers=headers,
        )
        assert resp.status_code == 200
        preview = resp.json()
        assert preview["key"] == "unit_math"
        assert preview["note_type"] == "数学"
        assert preview["tags"] == ["函数", "极限"]
        assert "You are a math teacher" in preview["system_prompt"]
        assert "Please output" in preview["user_prompt"]

        # 获取版本历史
        resp = client.get("/api/admin/prompts/unit_math/versions", headers=headers)
        assert resp.status_code == 200
        versions = resp.json()
        assert len(versions) >= 1
        version_id = versions[0]["id"]
        original_version_number = versions[0]["version"]

        # 恢复版本
        resp = client.post(
            f"/api/admin/prompts/unit_math/versions/{version_id}/restore",
            json={"comment": "restore test"},
            headers=headers,
        )
        assert resp.status_code == 200
        restored = resp.json()
        assert restored["last_version"] == original_version_number + 1
        assert restored["last_comment"] == "restore test"

        # 删除
        resp = client.request(
            "DELETE",
            "/api/admin/prompts/unit_math",
            json={"comment": "cleanup"},
            headers=headers,
        )
        assert resp.status_code == 200
        deleted = resp.json()
        assert deleted["status"] == "deleted"
        assert deleted["key"] == "unit_math"
        assert deleted["version"] == restored["last_version"] + 1

    finally:
        # 恢复环境
        settings.ADMIN_PORTAL_API_KEY = original_key
        prompt_profile_manager.path = original_path
        prompt_profile_manager.reload(force=True)
        original_path.write_text(original_content, encoding="utf-8")
        reload_prompt_profiles()
        with SessionLocal() as db:
            db.query(PromptProfileVersion).filter(PromptProfileVersion.profile_key.like("unit_%")).delete()
            db.commit()
            fingerprint = hashlib.sha256("unit-test-key".encode("utf-8")).hexdigest()
            delete_binding(db, fingerprint)