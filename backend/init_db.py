# init_db.py
from db import engine, Base
import backend.models  # importa para registrar as classes no Base

print("Criando tabelas...")
Base.metadata.create_all(bind=engine)
print("Pronto.")
