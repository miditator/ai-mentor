# api/profile.py
from fastapi import APIRouter
from pydantic import BaseModel
import database

# Создаем роутер вместо приложения app
router = APIRouter(
    prefix="/api",  # Этот префикс автоматически добавится ко всем эндпоинтам ниже
    tags=["Profile"]  # Тег для красивой группировки в документации Swagger (/docs)
)


class OnboardingData(BaseModel):
    chat_id: int
    language: str
    difficulty: str


@router.get("/profile")  # Полный путь будет: /api/profile
def get_user_profile(chat_id: int):
    config = database.get_user_config(chat_id)
    is_new = not config or not config.get("source_lang") or not config.get("difficulty")

    if is_new:
        return {"success": True, "is_new_user": True}

    words = database.get_full_dictionary(chat_id)
    words_count = len(words) if words else 0

    return {
        "success": True,
        "is_new_user": False,
        "language": config.get("source_lang"),
        "difficulty": config.get("difficulty"),
        "words_count": words_count,
        "words_per_day": config.get("words_per_day", 10)
    }


@router.post("/onboarding")  # Полный путь будет: /api/onboarding
def save_onboarding(data: OnboardingData):
    try:
        database.update_user_setting(data.chat_id, "source_lang", data.language)
        database.update_user_setting(data.chat_id, "difficulty", data.difficulty)

        from handlers.buttons import seed_initial_words_via_ai
        seed_initial_words_via_ai(data.chat_id, data.language)

        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}