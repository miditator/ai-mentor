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

class TaskAnswerData(BaseModel):
    chat_id: int
    answer: str

@router.get("/tasks/new")
def get_new_task(chat_id: int, force: bool = False):
    try:
        # 1. Если force=True или задачи нет, удаляем старую
        if force:
            database.delete_active_task(chat_id)

        active = database.get_active_task(chat_id)
        if active:
            return {"success": True, "phrase": active["phrase"]}

        # 2. Узнаем язык пользователя
        user_config = database.get_user_config(chat_id)
        target_lang = user_config.get("source_lang", "en") if user_config else "en"
        lang_name = "английском" if target_lang == "en" else "немецком"

        # 3. Достаем его слова для контекста (чтобы ИИ делал предложения с ними)
        words = database.get_words_for_grammar_context(chat_id, limit=2)
        words_str = ", ".join([f"{w['foreign']} ({w['ru']})" for w in words]) if words else "базовые слова"

        # 4. Просим ИИ сгенерировать предложение
        prompt = f"Сгенерируй одно простое предложение на русском языке для перевода на {lang_name} язык. Постарайся использовать по смыслу эти слова: {words_str}. В ответе напиши ТОЛЬКО русское предложение без кавычек и перевода."

        response = loader.ai_client.chat.completions.create(
            model=config.MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7
        )
        ru_phrase = response.choices[0].message.content.strip()

        # 5. Сохраняем в активные задачи
        database.save_active_task(chat_id, ru_phrase, "")
        return {"success": True, "phrase": ru_phrase}
    except Exception as e:
        return {"success": False, "error": str(e)}

@router.post("/tasks/check")
def check_task(data: TaskAnswerData):
    try:
        active = database.get_active_task(data.chat_id)
        if not active:
            return {"success": False, "error": "Нет активного задания."}

        user_config = database.get_user_config(data.chat_id)
        target_lang = user_config.get("source_lang", "en") if user_config else "en"
        lang_name = "английский" if target_lang == "en" else "немецкий"

        original_phrase = active["phrase"]

        # Проверяем перевод через ИИ
        prompt = f"Пользователь перевел фразу '{original_phrase}' на {lang_name} язык так: '{data.answer}'.\nОцени перевод. Если он правильный (допускаются мелкие опечатки), ответь 'ПРАВИЛЬНО'. Если есть ошибка, укажи на нее, объясни коротко и напиши правильный вариант."

        response = loader.ai_client.chat.completions.create(
            model=config.MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3
        )
        ai_feedback = response.choices[0].message.content.strip()

        is_correct = ai_feedback.upper().startswith("ПРАВИЛЬНО")

        if is_correct:
            database.delete_active_task(data.chat_id) # Задание выполнено
            database.add_to_history(data.chat_id, original_phrase)
            return {"success": True, "is_correct": True, "feedback": "✅ <b>Отлично! Перевод верный.</b>"}
        else:
            database.increment_help_count(data.chat_id) # Считаем попытки
            return {"success": True, "is_correct": False, "feedback": f"❌ <b>Ошибка:</b>\n{ai_feedback}"}

    except Exception as e:
        return {"success": False, "error": str(e)}

class TrainingAnswerData(BaseModel):
    chat_id: int
    word_id: int
    is_correct: bool

@router.get("/train/start")
def start_training(chat_id: int, count: int = 5):
    try:
        # Получаем слова из базы
        words = database.get_words_for_training(chat_id, limit_new=count)
        # Форматируем для фронтенда
        result = [{"id": w[0], "foreign": w[1], "ru": w[2], "score": w[3]} for w in words]
        return {"success": True, "words": result}
    except Exception as e:
        return {"success": False, "error": str(e)}

@router.post("/train/check")
def check_training_answer(data: TrainingAnswerData):
    try:
        database.update_word_progress(data.word_id, data.is_correct)
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}