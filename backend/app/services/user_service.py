from typing import Optional

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.note import Note
from app.models.upload_job import UploadJob

from app.core.security import get_password_hash, verify_password
from app.models.user import User


class UserService:
    """用户领域服务，负责用户增删改查与认证校验"""

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
            raise ValueError("用户名已存在") from exc
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

