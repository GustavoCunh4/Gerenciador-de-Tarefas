# db.py
import os

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.pool import NullPool

# Carrega variáveis de ambiente a partir de um .env local (não usado em produção Vercel).
load_dotenv()

# Em producao (Vercel + Supabase), use sempre DATABASE_URL.
# O fallback para SQLite fica apenas para desenvolvimento local mais simples.
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./todo.db")

is_sqlite = DATABASE_URL.startswith("sqlite")

# NullPool evita reter conexoes em ambiente serverless (Vercel). pool_pre_ping detecta conexoes quebradas.
pool_args = {"pool_pre_ping": True}
connect_args = {"check_same_thread": False} if is_sqlite else {}
if not is_sqlite:
    pool_args["poolclass"] = NullPool

engine = create_engine(DATABASE_URL, connect_args=connect_args, **pool_args)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """Dependencia para pegar sessao (FastAPI)."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
