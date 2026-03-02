"""Email delivery service for verification codes via SMTP."""

import logging
import smtplib
import time
import uuid
from email.utils import formataddr, formatdate, parseaddr
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
        sender_email = self._sender_email()
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = formataddr((settings.SMTP_FROM_NAME, sender_email))
        msg["To"] = to_email
        msg["Date"] = formatdate(localtime=True)
        msg["Message-ID"] = self._build_message_id()
        msg.attach(MIMEText(html_body, "html", "utf-8"))

        try:
            with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
                server.send_message(msg)
            logger.info("验证码邮件已发送至 %s (message_id=%s)", to_email, msg["Message-ID"])
            return True
        except Exception:
            logger.error("邮件发送失败 (to=%s)", to_email, exc_info=True)
            return False

    @staticmethod
    def _sender_email() -> str:
        _, parsed = parseaddr(settings.SMTP_USERNAME.strip())
        return parsed or settings.SMTP_USERNAME.strip()

    def _build_message_id(self) -> str:
        domain = self._message_id_domain()
        nonce = uuid.uuid4().hex
        timestamp = int(time.time())
        return f"<{timestamp}.{nonce}@{domain}>"

    def _message_id_domain(self) -> str:
        sender_email = self._sender_email()
        if "@" in sender_email:
            domain = sender_email.rsplit("@", 1)[1].strip().lower()
            if self._is_valid_message_id_domain(domain):
                return domain

        smtp_host = settings.SMTP_HOST.strip().lower()
        if self._is_valid_message_id_domain(smtp_host):
            return smtp_host

        return "localhost.localdomain"

    @staticmethod
    def _is_valid_message_id_domain(domain: str) -> bool:
        if not domain or any(char.isspace() for char in domain):
            return False
        if "." not in domain:
            return False
        if domain.startswith(".") or domain.endswith("."):
            return False
        return True


email_service = EmailService()
