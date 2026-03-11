from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from .models import Base
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./sql_app.db")

# Lazy Engine Initialization
_engine = None
_SessionLocal = None

def get_engine():
    global _engine
    if _engine is None:
        # SQLite specific config
        connect_args = {"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
        _engine = create_engine(
            DATABASE_URL, connect_args=connect_args
        )
    return _engine

def get_session_maker():
    global _SessionLocal
    if _SessionLocal is None:
        _SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=get_engine())
    return _SessionLocal

def init_db():
    Base.metadata.create_all(bind=get_engine())

def get_db():
    SessionLocal = get_session_maker()
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# For direct import compatibility in main.py (not recommended but keeps existing code working)
# We use a property-like access or just initialize on import if strictly needed,
# BUT for Gunicorn safety, we want to delay this.
# Let's change main.py to call init_db() instead of accessing engine directly.
