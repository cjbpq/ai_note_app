from email.utils import parsedate_to_datetime

import pytest

from app.core.config import settings
from app.services.email_service import EmailService


class _DummySMTP:
    def __init__(self, host: str, port: int):
        self.host = host
        self.port = port
        self.login_args = None
        self.sent_message = None

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        return False

    def login(self, username: str, password: str):
        self.login_args = (username, password)

    def send_message(self, msg):
        self.sent_message = msg


@pytest.mark.unit
def test_send_verification_email_sets_required_headers(monkeypatch):
    instances: list[_DummySMTP] = []

    def smtp_factory(host: str, port: int):
        smtp = _DummySMTP(host, port)
        instances.append(smtp)
        return smtp

    monkeypatch.setattr("app.services.email_service.smtplib.SMTP_SSL", smtp_factory)
    monkeypatch.setattr(settings, "SMTP_USERNAME", "no-reply@example.com")
    monkeypatch.setattr(settings, "SMTP_PASSWORD", "test-password")
    monkeypatch.setattr(settings, "SMTP_HOST", "smtp.example.com")
    monkeypatch.setattr(settings, "SMTP_PORT", 465)

    service = EmailService()
    sent = service.send_verification_code("user@gmail.com", "123456", "register")

    assert sent is True
    assert len(instances) == 1

    smtp_instance = instances[0]
    assert smtp_instance.login_args == ("no-reply@example.com", "test-password")
    assert smtp_instance.sent_message is not None

    msg = smtp_instance.sent_message
    assert msg["Date"] is not None
    assert parsedate_to_datetime(msg["Date"]) is not None

    assert msg["Message-ID"] is not None
    assert msg["Message-ID"].startswith("<")
    assert msg["Message-ID"].endswith(">")
    assert "@example.com>" in msg["Message-ID"]


@pytest.mark.unit
def test_message_id_domain_falls_back_to_smtp_host(monkeypatch):
    monkeypatch.setattr(settings, "SMTP_USERNAME", "smtp-user")
    monkeypatch.setattr(settings, "SMTP_HOST", "smtp.exmail.qq.com")
    service = EmailService()

    assert service._message_id_domain() == "smtp.exmail.qq.com"
