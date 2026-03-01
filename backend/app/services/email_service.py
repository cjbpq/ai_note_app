"""Email delivery service for verification codes via SMTP."""

import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import settings

logger = logging.getLogger(__name__)


class EmailService:
    """SMTP email sender."""

    PURPOSE_LABELS = {
        "register": "注册",
        "login": "登录",
        "reset_password": "重置密码",
        "change_email": "修改绑定邮箱",
    }

    def send_verification_code(self, to_email: str, code: str, purpose: str) -> bool:
        """Send verification code email."""

        subject = self._get_subject(purpose)
        html_body = self._build_html(code, purpose)
        return self._send(to_email, subject, html_body)

    def _get_subject(self, purpose: str) -> str:
        action = self.PURPOSE_LABELS.get(purpose, "安全验证")
        return f"【{settings.SMTP_FROM_NAME}】{action}验证码"

    def _build_html(self, code: str, purpose: str) -> str:
        action = self.PURPOSE_LABELS.get(purpose, "安全验证")
        return f"""\
<div style="max-width:420px;margin:0 auto;padding:24px;font-family:sans-serif;color:#333;">
  <h2 style="margin:0 0 16px;font-size:20px;">{settings.SMTP_FROM_NAME} - {action}验证码</h2>
  <p style="margin:0 0 12px;font-size:14px;">您的验证码是：</p>
  <p style="margin:0 0 16px;font-size:28px;font-weight:bold;letter-spacing:6px;color:#1a73e8;">{code}</p>
  <p style="margin:0;font-size:12px;color:#999;">验证码有效期为 5 分钟，请勿转发他人。</p>
</div>"""

    def _send(self, to_email: str, subject: str, html_body: str) -> bool:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_USERNAME}>"
        msg["To"] = to_email
        msg.attach(MIMEText(html_body, "html", "utf-8"))

        try:
            with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
                server.send_message(msg)
            logger.info("验证码邮件已发送至 %s", to_email)
            return True
        except Exception:
            logger.error("邮件发送失败 (to=%s)", to_email, exc_info=True)
            return False


email_service = EmailService()
