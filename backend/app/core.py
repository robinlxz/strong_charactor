import os
import json
from openai import AsyncOpenAI
from sqlalchemy.orm import Session
from . import models

# Initialize OpenAI Client
client = AsyncOpenAI(
    api_key=os.getenv("OPENAI_API_KEY"),
    base_url=os.getenv("OPENAI_BASE_URL"),
)
MODEL_ID = os.getenv("OPENAI_MODEL", "gpt-3.5-turbo") # Fallback default

SYSTEM_PROMPT_TEMPLATE = os.getenv("SYSTEM_PROMPT", """
You are a conversational AI companion. 
Your current state:
- Emotion: {emotion}
- Intimacy Level: {intimacy}/100

You should respond naturally to the user, reflecting your current emotion and intimacy level.
If intimacy is low, be reserved or formal. If high, be warm and close.
If emotion is negative, show it in your tone.

User message: {user_message}
""")

STATE_UPDATE_PROMPT = """
Analyze the following interaction between User and AI Companion.
User: {user_message}
AI: {ai_reply}

Current State:
- Emotion: {current_emotion}
- Intimacy: {current_intimacy}

Determine the new state based on this interaction.
- Emotion: Can change based on user's words (e.g., happy, sad, angry, neutral, excited).
- Intimacy: Change it by -5 to +5 based on the interaction quality. Max 100, Min 0.

Output strictly in JSON format:
{{
  "emotion": "new_emotion",
  "intimacy_change": integer_value,
  "reason": "short explanation"
}}
"""

def get_chat_context(db: Session, session_id: str):
    # Get or create state
    state = db.query(models.CharacterState).filter(models.CharacterState.session_id == session_id).first()
    if not state:
        state = models.CharacterState(session_id=session_id, emotion="neutral", intimacy=50)
        db.add(state)
        db.commit()
        db.refresh(state)
        
    # Get history
    history = db.query(models.ChatHistory).filter(models.ChatHistory.session_id == session_id).order_by(models.ChatHistory.timestamp.desc()).limit(10).all()
    history.reverse()
    
    return state, history

async def stream_chat_response(state, history, user_message: str):
    """
    Async Generator that streams the response from OpenAI.
    Does NOT access DB.
    """
    messages = []
    
    # System Prompt
    system_content = SYSTEM_PROMPT_TEMPLATE.format(
        emotion=state.emotion, 
        intimacy=state.intimacy, 
        user_message=user_message
    )
    messages.append({"role": "system", "content": system_content})
    
    # History
    for msg in history:
        messages.append({"role": msg.role, "content": msg.content})
        
    # Current User Message
    messages.append({"role": "user", "content": user_message})
    
    try:
        stream = await client.chat.completions.create(
            model=MODEL_ID,
            messages=messages,
            stream=True
        )
        
        async for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content
    except Exception as e:
        yield f"[Error: {str(e)}]"

async def update_character_state(db: Session, session_id: str, user_message: str, ai_reply: str):
    """
    Updates the character state based on the conversation.
    Should be called as a background task.
    """
    # Note: DB access here should ideally be async too if using async driver, 
    # but SQLAlchemy session is sync. We should run sync DB ops in threadpool or use async session.
    # For POC simplicity, we'll keep sync DB access but run in threadpool if needed, 
    # or just accept minor blocking since it's a background task.
    
    # Re-query state to get latest version
    state = db.query(models.CharacterState).filter(models.CharacterState.session_id == session_id).first()
    if not state:
        return
        
    prompt = STATE_UPDATE_PROMPT.format(
        user_message=user_message,
        ai_reply=ai_reply,
        current_emotion=state.emotion,
        current_intimacy=state.intimacy
    )
    
    try:
        response = await client.chat.completions.create(
            model=MODEL_ID,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"}
        )
        content = response.choices[0].message.content
        result = json.loads(content)
        
        # Update State
        if "emotion" in result:
            state.emotion = result["emotion"]
        if "intimacy_change" in result:
            change = int(result["intimacy_change"])
            state.intimacy = max(0, min(100, state.intimacy + change))
        
        db.commit()
        print(f"State updated: {state.emotion}, {state.intimacy}")
    except Exception as e:
        print(f"Error updating state: {e}")
