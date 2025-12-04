import json
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.encoders import jsonable_encoder
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.db import get_db
import backend.crud as crud
import backend.models  # garante que os models sejam carregados
from backend.cache.redis_client import is_cache_available, redis_client


BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BASE_DIR / "frontend"
CACHE_TTL_SECONDS = 60

app = FastAPI(title="Todo List API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # em dev, tudo liberado
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Servir arquivos est?ticos do frontend pela pr?pria API
app.mount(
    "/css",
    StaticFiles(directory=str(FRONTEND_DIR / "css")),
    name="css",
)
app.mount(
    "/js",
    StaticFiles(directory=str(FRONTEND_DIR / "js")),
    name="js",
)


def normalize_status_param(raw_status: Optional[str]) -> Optional[str]:
    """
    Valida o status vindo da query string. Aceita 'all'/'todas' como sem filtro.
    """
    if raw_status is None:
        return None

    normalized = raw_status.strip().lower()
    if normalized in ("all", "todas", "todos"):
        return None

    if normalized not in crud.VALID_STATUSES:
        valid_list = ", ".join(sorted(crud.VALID_STATUSES))
        raise HTTPException(
            status_code=400,
            detail=f"Status invalido. Use: {valid_list}.",
        )

    return normalized


def tasks_cache_key(user_id: int, status: Optional[str]) -> str:
    status_key = status or "all"
    return f"tasks:user:{user_id}:status:{status_key}"


def invalidate_task_cache_for_user(user_id: int) -> None:
    """
    Remove todas as variacoes de cache de tarefas de um usuario.
    """
    if not redis_client:
        return

    status_keys = ["all"] + list(crud.VALID_STATUSES)
    try:
        for status_key in status_keys:
            redis_client.delete(tasks_cache_key(user_id, status_key))
    except Exception:
        # Cache e opcional; evitar que erros de cache prejudiquem a API.
        pass


@app.get("/", response_class=FileResponse)
def serve_frontend() -> FileResponse:
    """Serve o arquivo index.html do frontend."""
    return FileResponse(FRONTEND_DIR / "index.html")


class UserBase(BaseModel):
    id: int
    email: str

    class Config:
        orm_mode = True


class UserCreate(BaseModel):
    email: str
    password: str


class UserLogin(BaseModel):
    email: str
    password: str


class TaskBase(BaseModel):
    id: int
    user_id: int
    title: str
    description: Optional[str] = None
    created_at: datetime
    data_inicial: Optional[datetime] = None
    data_limite: Optional[datetime] = None
    status: str

    class Config:
        orm_mode = True


class TaskCreate(BaseModel):
    user_id: int
    title: str
    description: Optional[str] = None
    data_inicial: Optional[datetime] = None
    data_limite: Optional[datetime] = None
    status: Optional[str] = "pendente"


class TaskUpdate(BaseModel):
    user_id: int
    title: Optional[str] = None
    description: Optional[str] = None
    data_inicial: Optional[datetime] = None
    data_limite: Optional[datetime] = None
    status: Optional[str] = None


@app.post("/register", response_model=UserBase)
def register_user(data: UserCreate, db: Session = Depends(get_db)):
    try:
        user = crud.create_user(db, data.email, data.password)
        return user
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/login", response_model=UserBase)
def login_user(data: UserLogin, db: Session = Depends(get_db)):
    user = crud.authenticate_user(db, data.email, data.password)
    if not user:
        raise HTTPException(status_code=400, detail="E-mail ou senha inv?lidos.")
    return user


@app.get("/tasks", response_model=List[TaskBase])
def list_tasks(
    user_id: int,
    status: Optional[str] = Query(None, description="pendente|em_andamento|concluida|all"),
    db: Session = Depends(get_db),
):
    status_filter = normalize_status_param(status)
    cache_key = tasks_cache_key(user_id, status_filter)

    if redis_client:
        try:
            cached_tasks = redis_client.get(cache_key)
            if cached_tasks:
                return json.loads(cached_tasks)
        except Exception:
            pass

    tasks = crud.get_tasks_for_user(db, user_id, status=status_filter)

    if redis_client:
        try:
            serialized = jsonable_encoder(tasks)
            redis_client.setex(cache_key, CACHE_TTL_SECONDS, json.dumps(serialized))
        except Exception:
            pass

    return tasks


@app.post("/tasks", response_model=TaskBase)
def create_task(task_in: TaskCreate, db: Session = Depends(get_db)):
    try:
        task = crud.create_task(
            db,
            user_id=task_in.user_id,
            title=task_in.title,
            description=task_in.description,
            data_inicial=task_in.data_inicial,
            data_limite=task_in.data_limite,
            status=task_in.status,
        )
        invalidate_task_cache_for_user(task_in.user_id)
        return task
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.put("/tasks/{task_id}", response_model=TaskBase)
def update_task_endpoint(
    task_id: int,
    task_in: TaskUpdate,
    db: Session = Depends(get_db),
):
    try:
        updated = crud.update_task(
            db,
            task_id=task_id,
            user_id=task_in.user_id,
            title=task_in.title,
            description=task_in.description,
            data_inicial=task_in.data_inicial,
            data_limite=task_in.data_limite,
            status=task_in.status,
        )
        invalidate_task_cache_for_user(task_in.user_id)
        return updated
    except ValueError as e:
        message = str(e)
        status_code = 404 if "nao encontrada" in message else 400
        raise HTTPException(status_code=status_code, detail=message)


@app.delete("/tasks/{task_id}")
def delete_task(task_id: int, db: Session = Depends(get_db)):
    """
    Remove uma tarefa pelo ID.
    """
    user_id_for_cache = None

    try:
        task_obj = (
            db.query(backend.models.Task)
            .filter(backend.models.Task.id == task_id)
            .first()
        )
        if task_obj:
            user_id_for_cache = task_obj.user_id
    except Exception:
        pass

    deleted = crud.delete_task(db, task_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Tarefa n?o encontrada.")

    if user_id_for_cache:
        invalidate_task_cache_for_user(user_id_for_cache)

    return {"detail": "Tarefa apagada com sucesso."}


@app.get("/cache/ping")
def cache_ping():
    """Endpoint simples para verificar disponibilidade do Redis."""
    return {"redis_available": is_cache_available()}
