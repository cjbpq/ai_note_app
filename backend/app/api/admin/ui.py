from __future__ import annotations

from fastapi import APIRouter, Query, Request
from fastapi.responses import HTMLResponse, RedirectResponse, Response
from fastapi.templating import Jinja2Templates

from app.core.config import settings

templates = Jinja2Templates(directory="app/templates")

ui_router = APIRouter(prefix="/admin", include_in_schema=False, tags=["Admin Console"])


@ui_router.get("/", response_class=HTMLResponse)
async def admin_login(request: Request) -> HTMLResponse:
    return templates.TemplateResponse(
        "admin/login.html",
        {
            "request": request,
            "app_name": settings.APP_NAME,
            "api_base": "/api/admin",
        },
    )


@ui_router.get("/console", response_class=HTMLResponse)
async def admin_console(
    request: Request,
    authorized: bool | None = Query(default=None),
) -> Response:
    if not authorized:
        return RedirectResponse(url="/admin", status_code=307)
    response = templates.TemplateResponse(
        "admin/console.html",
        {
            "request": request,
            "app_name": settings.APP_NAME,
            "api_base": "/api/admin",
        },
    )
    return response
