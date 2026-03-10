# Project Plan: AI Companion POC (Strong Character)

This plan outlines the steps to build a Proof of Concept (POC) for an AI Companion application with emotion and intimacy tracking. The deployment strategy focuses on simplicity, using a single systemd service and avoiding containerization for now.

## Phase 1: Project Initialization & Backend Setup
- [ ] **Initialize Project Structure**: Create `backend/` and `frontend/` directories.
- [ ] **Backend Dependencies**: Create `backend/requirements.txt` (FastAPI, Uvicorn, SQLAlchemy, OpenAI, Python-dotenv).
- [ ] **Database Setup**: Implement `backend/app/models.py` using SQLite and SQLAlchemy to store:
    - User/Character profiles.
    - Chat History.
    - Current State (Emotion, Intimacy).
- [ ] **Core Logic Implementation**:
    - Implement `backend/app/core.py` for LLM interaction (BytePlus/OpenAI).
    - Implement the "State Engine" to update Emotion and Intimacy based on conversation.
- [ ] **API Development**:
    - Create `backend/app/main.py` and `backend/app/api.py`.
    - specific endpoints: `/chat` (streaming response), `/state` (get current status), `/history` (load previous chat).
- [ ] **Configuration**: Set up `.env` loading for API keys and model settings.

## Phase 2: Frontend Development
- [ ] **Initialize React App**: Set up `frontend/` using Vite + React.
- [ ] **UI Components**:
    - Chat Interface (Bubble style, similar to mobile apps).
    - Status Bar (Displaying current Emotion and Intimacy level).
    - Settings/Debug panel (optional, for changing model/prompt).
- [ ] **State Management**: Implement React hooks to handle chat state and API communication.
- [ ] **API Integration**: Connect frontend to backend API (handling streaming responses).

## Phase 3: Integration & Deployment Preparation
- [ ] **Static File Serving**: Configure FastAPI to serve the built React frontend static files (`frontend/dist`) at the root URL `/`.
- [ ] **Build Script**: Create a script to install frontend dependencies and run `npm run build`.
- [ ] **Service Configuration**: Create `strong_charactor.service` template for systemd.
- [ ] **Deployment Script**: Create `deploy.sh` based on the user's provided reference, adapted to:
    - Install Python dependencies (venv).
    - Install Node.js/npm (required for building frontend).
    - Build the frontend.
    - Setup the systemd service to run the FastAPI app (which serves the frontend).

## Phase 4: Verification
- [ ] **Local Testing**: Run the full stack locally to verify chat flow and state updates.
- [ ] **Deployment Simulation**: Verify the `deploy.sh` script logic (dry run or check paths).
