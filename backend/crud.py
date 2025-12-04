from datetime import datetime
from typing import List, Optional

from sqlalchemy.orm import Session
from werkzeug.security import check_password_hash, generate_password_hash

from backend.models import Task, User


VALID_STATUSES = {"pendente", "em_andamento", "concluida"}


def _normalize_status(status: Optional[str], allow_none: bool = False) -> Optional[str]:
    """
    Sanitiza e valida o status, retornando em lowercase.
    """
    if status is None:
        if allow_none:
            return None
        return "pendente"

    normalized = status.strip().lower()
    if normalized not in VALID_STATUSES:
        valid_list = ", ".join(sorted(VALID_STATUSES))
        raise ValueError(f"Status invalido. Use: {valid_list}.")

    return normalized


# ---- Usuarios ----

def create_user(db: Session, email: str, password: str) -> User:
    existing = db.query(User).filter_by(email=email).first()
    if existing:
        raise ValueError("Ja existe um usuario com esse e-mail.")

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
        raise ValueError("Titulo e obrigatorio.")

    now = datetime.utcnow()
    normalized_status = _normalize_status(status)

    task = Task(
        user_id=user_id,
        title=title,
        description=description or "",
        created_at=now,
        data_inicial=data_inicial or now,
        data_limite=data_limite or now,
        status=normalized_status,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def get_tasks_for_user(
    db: Session,
    user_id: int,
    status: Optional[str] = None,
) -> List[Task]:
    query = db.query(Task).filter(Task.user_id == user_id)

    if status is not None:
        normalized_status = _normalize_status(status, allow_none=True)
        if normalized_status:
            query = query.filter(Task.status == normalized_status)

    return query.order_by(Task.created_at.desc()).all()


def delete_task(db: Session, task_id: int) -> bool:
    """
    Deleta uma tarefa pelo ID.
    Retorna True se deletou, False se nao encontrou.
    """
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        return False

    db.delete(task)
    db.commit()
    return True


def update_task(
    db: Session,
    task_id: int,
    user_id: int,
    title: Optional[str] = None,
    description: Optional[str] = None,
    data_inicial: Optional[datetime] = None,
    data_limite: Optional[datetime] = None,
    status: Optional[str] = None,
) -> Task:
    task = (
        db.query(Task)
        .filter(Task.id == task_id, Task.user_id == user_id)
        .first()
    )

    if not task:
        raise ValueError("Tarefa nao encontrada para este usuario.")

    updates_applied = False

    if title is not None:
        if not title.strip():
            raise ValueError("Titulo nao pode ser vazio.")
        task.title = title.strip()
        updates_applied = True

    if description is not None:
        task.description = description
        updates_applied = True

    if data_inicial is not None:
        task.data_inicial = data_inicial
        updates_applied = True

    if data_limite is not None:
        task.data_limite = data_limite
        updates_applied = True

    if status is not None:
        task.status = _normalize_status(status)
        updates_applied = True

    if not updates_applied:
        raise ValueError("Nenhuma alteracao informada para atualizar.")

    db.commit()
    db.refresh(task)
    return task
