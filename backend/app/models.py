from sqlalchemy import Column, Integer, String, Text, DateTime, JSON
from sqlalchemy.orm import declarative_base
from datetime import datetime

Base = declarative_base()

class ChatHistory(Base):
    __tablename__ = "chat_history"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, index=True)
    role = Column(String)  # "user" or "assistant"
    content = Column(Text)
    timestamp = Column(DateTime, default=datetime.utcnow)
    
    # Store snapshot of state at this moment (optional, good for analysis)
    emotion_snapshot = Column(String, nullable=True)
    intimacy_snapshot = Column(Integer, nullable=True)

class CharacterState(Base):
    __tablename__ = "character_state"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, unique=True, index=True)
    emotion = Column(String, default="neutral")
    intimacy = Column(Integer, default=50)
    last_updated = Column(DateTime, default=datetime.utcnow)
