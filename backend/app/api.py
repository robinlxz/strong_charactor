from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List
from . import database, models, core

router = APIRouter()

class ChatRequest(BaseModel):
    session_id: str
    message: str

class StateResponse(BaseModel):
    emotion: str
    intimacy: int

class Message(BaseModel):
    role: str
    content: str

def get_db():
    yield from database.get_db()

@router.get("/state/{session_id}", response_model=StateResponse)
def get_state(session_id: str, db: Session = Depends(get_db)):
    state = db.query(models.CharacterState).filter(models.CharacterState.session_id == session_id).first()
    if not state:
        return StateResponse(emotion="neutral", intimacy=50)
    return StateResponse(emotion=state.emotion, intimacy=state.intimacy)

@router.get("/history/{session_id}", response_model=List[Message])
def get_history(session_id: str, db: Session = Depends(get_db)):
    history = db.query(models.ChatHistory).filter(models.ChatHistory.session_id == session_id).order_by(models.ChatHistory.timestamp.asc()).all()
    return [Message(role=msg.role, content=msg.content) for msg in history]

@router.post("/chat")
async def chat(request: ChatRequest, db: Session = Depends(get_db)):
    # 1. Save User Message
    user_msg = models.ChatHistory(
        session_id=request.session_id,
        role="user",
        content=request.message
    )
    db.add(user_msg)
    db.commit()
    
    # 2. Get Context (State + History)
    state, history = core.get_chat_context(db, request.session_id)
    
    # 3. Stream Response Wrapper
    async def response_generator():
        full_response = ""
        # We need to use a separate DB session for the background work 
        # because the request session might be closed or we want to be safe.
        
        try:
            async for chunk in core.stream_chat_response(state, history, request.message):
                full_response += chunk
                yield chunk
        except Exception as e:
            yield f"[Error: {str(e)}]"
            return

        # After stream ends, save AI message and update state
        # We create a new session to ensure thread safety and no closed-session errors
        new_db = database.SessionLocal()
        try:
            # Save AI Message
            ai_msg = models.ChatHistory(
                session_id=request.session_id,
                role="assistant",
                content=full_response
            )
            new_db.add(ai_msg)
            new_db.commit()
            
            # Update State (Async call)
            await core.update_character_state(new_db, request.session_id, request.message, full_response)
        except Exception as e:
            print(f"Post-chat processing error: {e}")
        finally:
            new_db.close()

    return StreamingResponse(response_generator(), media_type="text/plain")
