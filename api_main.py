# api_main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.profile import router as profile_router # Импортируем наш роутер

app = FastAPI(title="ИИ-Ментор API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 🚀 ПОДКЛЮЧАЕМ НАШИ РОУТЕРЫ
app.include_router(profile_router)

# Когда добавим задания, это будет выглядеть так же просто:
# from api.tasks import router as tasks_router
# app.include_router(tasks_router)