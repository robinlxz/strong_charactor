from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from . import models, database, api
import os

# Initialize DB (now uses lazy engine internally)
database.init_db()

app = FastAPI(title="Strong Character AI")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Router
app.include_router(api.router, prefix="/api")

@app.get("/health")
def health_check():
    return {"status": "ok"}

# Serve Frontend Static Files (if built)
# MOVED TO END to ensure /health and /api are matched first
frontend_dist = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "frontend", "dist")
if os.path.exists(frontend_dist):
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="static")
