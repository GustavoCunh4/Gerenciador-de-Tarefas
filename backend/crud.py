from datetime import datetime
from typing import List, Optional

from sqlalchemy.orm import Session
from werkzeug.security import check_password_hash, generate_password_hash

from backend.models import Task, User


# ---- Usuários ----

def create_user(db: Session, email: str, password: str) -> User:
    existing = db.query(User).filter_by(email=email).first()
    if existing:
        raise ValueError("Já existe um usuário com esse e-mail.")

    if len(password) < 6:
        raise ValueError("A senha deve ter pelo menos 6 caracteres.")

    user = User(
        email=email,
        password_hash=generate_password_hash(password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, email: str, password: str) -> Optional[User]:
    user = db.query(User).filter_by(email=email).first()
    if not user:
        return None
    if not check_password_hash(user.password_hash, password):
        return None
    return user


# ---- Tarefas ----

def create_task(
    db: Session,
    user_id: int,
    title: str,
    description: Optional[str] = None,
    data_inicial: Optional[datetime] = None,
    data_limite: Optional[datetime] = None,
    status: Optional[str] = None,
) -> Task:
    if not title:
        raise ValueError("Título é obrigatório.")

    now = datetime.utcnow()

    task = Task(
        user_id=user_id,
        title=title,
        description=description or "",
        created_at=now,
        data_inicial=data_inicial or now,
        data_limite=data_limite or now,
        status=status or "pendente",
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def get_tasks_for_user(db: Session, user_id: int) -> List[Task]:
    return (
        db.query(Task)
        .filter(Task.user_id == user_id)
        .order_by(Task.created_at.desc())
        .all()
    )


def delete_task(db: Session, task_id: int) -> bool:
    """
    Deleta uma tarefa pelo ID.
    Retorna True se deletou, False se não encontrou.
    """
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        return False

    db.delete(task)
    db.commit()
    return True