"""
Jetlag Game API - application entrypoint.

Wires up the app, DB startup/table creation, the games router
(app/routers/games.py) and the gemeente reference-data router
(app/routers/gemeentes.py), plus a simple health check.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.database import init_db
from app.game_data import get_gemeente_pairs
from app.routers.games import router as games_router
from app.routers.gemeentes import router as gemeentes_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    # Fill the gemeente-pairs cache here so the KML is parsed during startup
    # instead of inside whichever request happens to ask for it first.
    get_gemeente_pairs()
    yield


app = FastAPI(title="Jetlag Game API", version="0.1.0", lifespan=lifespan)

app.frontend("/", directory="frontend")
app.include_router(gemeentes_router)
app.include_router(games_router)


@app.get("/health")
def health_check():
    return {"status": "ok"}
