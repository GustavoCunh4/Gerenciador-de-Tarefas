"""Cliente Redis compatível com Vercel Redis usando apenas REDIS_URL."""
import os
from typing import Optional
from urllib.parse import urlparse

import redis
from dotenv import load_dotenv

# Carrega .env em ambiente local.
load_dotenv()

redis_url = os.getenv("REDIS_URL")
redis_client: Optional[redis.Redis] = None

if redis_url:
    parsed = urlparse(redis_url)
    try:
        redis_client = redis.Redis(
            host=parsed.hostname,
            port=parsed.port,
            password=parsed.password,
            username=parsed.username,
            ssl=True,
            decode_responses=True,  # evita precisar decodificar bytes nas leituras
        )
    except Exception:
        redis_client = None


def is_cache_available() -> bool:
    """Tenta dar ping no Redis; retorna False se não houver URL ou conexão falhar."""
    if not redis_client:
        return False
    try:
        return bool(redis_client.ping())
    except redis.RedisError:
        return False
