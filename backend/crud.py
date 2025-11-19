# crud.py
from sqlalchemy.orm import Session
from werkzeug.security import generate_password_hash, check_password_hash  # ou passlib
from backend.models import User, Task
from datetime import datetime

# ---- Usuários ----

def create_user(db: Session, email: str, password: str) -> User:
    existing = db.query(User).filter_by(email=email).first()
    if existing:
        raise ValueError("Já existe um usuário com esse e-mail.")

    if len(password) < 6:
        raise ValueError("A senha deve ter pelo menos 6 caracteres.")

    user = User(
        email=email,
        password_hash=generate_password_hash(password)
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, email: str, password: str) -> User | None:
    user = db.query(User).filter_by(email=email).first()
    if not user:
        return None
    if not check_password_hash(user.password_hash, password):
        return None
    return user

# ---- Tarefas ----

def create_task(db: Session, user_id: int, title: str, description: str | None = None) -> Task:
    if not title:
        raise ValueError("Título é obrigatório.")

    task = Task(
        user_id=user_id,
        title=title,
        description=description or "",
        created_at=datetime.utcnow()
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def get_tasks_for_user(db: Session, user_id: int) -> list[Task]:
    return (
        db.query(Task)
        .filter(Task.user_id == user_id)
        .order_by(Task.created_at.desc())
        .all()
    )
