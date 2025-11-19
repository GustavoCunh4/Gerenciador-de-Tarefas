# models.py
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from backend.db import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    tasks = relationship("Task", back_populates="user")

class Status(str, Enum):
    CONCLUIDO = "Concluído"
    EM_ANDAMENTO = "Em andamento"
    NAO_INICIADO = "Não iniciado"

class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    title = Column(Text, nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    data_inicial = Column(DateTime, default=datetime.utcnow, nullable=False)
    data_limite = Column(DateTime, default=datetime.utcnow, nullable=False)
    status = Column(Enum('Concluído', 'Em andamento', 'Não iniciado', name='status_enum'), nullable=False)
    

    user = relationship("User", back_populates="tasks")
