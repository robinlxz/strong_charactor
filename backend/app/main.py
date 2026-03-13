from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from . import models, database, api
import os

# Initialize DB (now uses lazy engine internally)
database.init_db()

app_name = os.getenv("APP_PUBLIC_NAME", "App")
enable_docs = os.getenv("ENABLE_DOCS", "false").lower() in ("1", "true", "yes", "on")
if enable_docs:
    app = FastAPI(title=app_name)
else:
    app = FastAPI(title=app_name, docs_url=None, redoc_url=None, openapi_url=None)

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

@app.middleware("http")
async def strip_headers(request, call_next):
    response = await call_next(request)
    response.headers.pop("server", None)
    response.headers.pop("x-powered-by", None)
    return response

# Serve Frontend Static Files (if built)
# MOVED TO END to ensure /health and /api are matched first
frontend_dist = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "frontend", "dist")
if os.path.exists(frontend_dist):
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="static")
