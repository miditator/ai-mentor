# api/profile.py
from fastapi import APIRouter
from pydantic import BaseModel
import database
import config
import loader

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


class TranslateWordData(BaseModel):
    chat_id: int
    foreign: str


class AddWordData(BaseModel):
    chat_id: int
    foreign: str
    ru: str


# 1. Эндпоинт ТОЛЬКО для перевода (обращается к ИИ)
@router.post("/words/translate")
def translate_word(data: TranslateWordData):
    try:
        user_config = database.get_user_config(data.chat_id)
        target_lang = user_config.get("source_lang", "en") if user_config else "en"
        lang_name = "английского" if target_lang == "en" else "немецкого"

        prompt = f"Переведи слово или фразу '{data.foreign}' с {lang_name} языка на русский. В ответе напиши ТОЛЬКО перевод, без лишних слов, кавычек и точек."

        response = loader.ai_client.chat.completions.create(
            model=config.MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3
        )
        ru_translation = response.choices[0].message.content.strip()
        return {"success": True, "ru": ru_translation}
    except Exception as e:
        return {"success": False, "error": str(e)}


# 2. Эндпоинт ТОЛЬКО для сохранения (кладет в БД)
@router.post("/words/add")
def add_word(data: AddWordData):
    try:
        user_config = database.get_user_config(data.chat_id)
        target_lang = user_config.get("source_lang", "en") if user_config else "en"

        database.add_custom_word(data.chat_id, data.foreign, data.ru, specific_lang=target_lang)
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}



@router.get("/words/all")
def get_dictionary(chat_id: int):
    # Убедись, что database импортирован правильно
    words = database.get_full_dictionary(chat_id)
    return {"success": True, "words": words}