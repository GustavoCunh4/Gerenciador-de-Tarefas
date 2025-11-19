from datetime import datetime
from typing import List, Optional

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.db import get_db
import backend.crud as crud
import backend.models  # garante que os models sejam carregados


app = FastAPI(title="Todo List API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # em dev, tudo liberado
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
        raise HTTPException(status_code=400, detail="E-mail ou senha inválidos.")
    return user


@app.get("/tasks", response_model=List[TaskBase])
def list_tasks(user_id: int, db: Session = Depends(get_db)):
    tasks = crud.get_tasks_for_user(db, user_id)
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
        return task
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
