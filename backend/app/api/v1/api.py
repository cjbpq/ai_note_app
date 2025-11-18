from fastapi import APIRouter

api_router = APIRouter()


def _safe_include(module_path: str, attr: str, *, prefix: str, tags: list[str]) -> None:
    """Try importing the router module and include it when available."""

    try:
        module = __import__(module_path, fromlist=[attr])
        router = getattr(module, attr)
    except ImportError as exc:  # noqa: BLE001
        print(f"路由模块导入失败 {module_path}: {exc}")
        return
    except AttributeError as exc:  # noqa: BLE001
        print(f"模块 {module_path} 缺少 {attr}: {exc}")
        return

    api_router.include_router(router, prefix=prefix, tags=tags)


_safe_include("app.api.v1.endpoints.library", "router", prefix="/library", tags=["Library"])
_safe_include("app.api.v1.endpoints.notes", "router", prefix="/notes", tags=["Notes"])
_safe_include("app.api.v1.endpoints.upload", "router", prefix="/upload", tags=["Upload"])
_safe_include("app.api.v1.endpoints.auth", "router", prefix="/auth", tags=["Auth"])