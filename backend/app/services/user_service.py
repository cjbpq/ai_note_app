from typing import Optional

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import get_password_hash, verify_password
from app.models.note import Note
from app.models.upload_job import UploadJob
from app.models.user import User


class UserService:
    """User domain service for account CRUD and credential operations."""

    def __init__(self, db: Session):
        self.db = db

    def create_user(self, username: str, password: str, email: Optional[str] = None) -> User:
        hashed_password = get_password_hash(password)
        user = User(username=username, email=email, password_hash=hashed_password)
        self.db.add(user)
        try:
            self.db.commit()
        except IntegrityError as exc:
            self.db.rollback()
            self._raise_integrity_error(exc)
        self.db.refresh(user)
        return user

    def authenticate_user(self, username: str, password: str) -> Optional[User]:
        user = self.get_user_by_username(username)
        if not user:
            return None
        if not verify_password(password, user.password_hash):
            return None
        return user

    def get_user_by_username(self, username: str) -> Optional[User]:
        return self.db.query(User).filter(User.username == username).first()

    def get_user_by_id(self, user_id: str) -> Optional[User]:
        return self.db.query(User).filter(User.id == user_id).first()

    def delete_user(self, user_id: str) -> bool:
        user = self.get_user_by_id(user_id)
        if not user:
            return False

        self.db.query(Note).filter(Note.user_id == user_id).delete(synchronize_session=False)
        self.db.query(UploadJob).filter(UploadJob.user_id == user_id).delete(synchronize_session=False)

        self.db.delete(user)
        self.db.commit()
        return True

    def get_user_by_email(self, email: str) -> Optional[User]:
        return self.db.query(User).filter(User.email == email).first()

    def create_user_with_verified_email(self, username: str, password: str, email: str) -> User:
        hashed_password = get_password_hash(password)
        user = User(
            username=username,
            email=email,
            password_hash=hashed_password,
            email_verified=True,
        )
        self.db.add(user)
        try:
            self.db.commit()
        except IntegrityError as exc:
            self.db.rollback()
            self._raise_integrity_error(exc)
        self.db.refresh(user)
        return user

    def change_password(self, user: User, old_password: str, new_password: str) -> User:
        if not verify_password(old_password, user.password_hash):
            raise ValueError("旧密码错误")
        if old_password == new_password:
            raise ValueError("新密码不能与旧密码相同")

        user.password_hash = get_password_hash(new_password)
        self.db.commit()
        self.db.refresh(user)
        return user

    def reset_password_by_email(self, email: str, new_password: str) -> User:
        user = self.get_user_by_email(email)
        if not user:
            raise ValueError("该邮箱未注册")

        user.password_hash = get_password_hash(new_password)
        self.db.commit()
        self.db.refresh(user)
        return user

    def change_email(self, user: User, new_email: str) -> User:
        if user.email == new_email:
            raise ValueError("新邮箱不能与当前邮箱相同")

        existing_user = self.get_user_by_email(new_email)
        if existing_user and existing_user.id != user.id:
            raise ValueError("邮箱已被注册")

        user.email = new_email
        user.email_verified = True
        try:
            self.db.commit()
        except IntegrityError as exc:
            self.db.rollback()
            self._raise_integrity_error(exc)
        self.db.refresh(user)
        return user

    @staticmethod
    def _raise_integrity_error(exc: IntegrityError) -> None:
        error_msg = str(exc.orig).lower()
        if "email" in error_msg:
            raise ValueError("邮箱已被注册") from exc
        if "username" in error_msg:
            raise ValueError("用户名已存在") from exc
        raise ValueError("数据唯一性校验失败") from exc
