# api/profile.py
from fastapi import APIRouter
from pydantic import BaseModel
import database
import config
import loader
import aiPrompts
import json
import re

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

class TaskHelpData(BaseModel):
    chat_id: int
    step: int

class UpdateSettingData(BaseModel):
    chat_id: int
    setting_key: str
    setting_value: str

class IntensityStartData(BaseModel):
    chat_id: int
    word: str

class IntensityCheckData(BaseModel):
    chat_id: int
    original_foreign_phrase: str
    russian_task_phrase: str
    user_answer: str

class IntensityHelpData(BaseModel):
    chat_id: int
    russian_phrase: str
    foreign_phrase: str

# 1. Эндпоинт ТОЛЬКО для перевода (обращается к ИИ)
@router.post("/words/translate")
# 1. Эндпоинт ТОЛЬКО для перевода (обращается к ИИ)
@router.post("/words/translate")
def translate_word(data: TranslateWordData):
    try:
        user_config = database.get_user_config(data.chat_id)
        target_lang = user_config.get("source_lang", "en") if user_config else "en"

        # 🔥 Теперь мы используем твой умный промпт из aiPrompts.py
        prompt = aiPrompts.word_translation_prompt(data.foreign, target_lang)

        response = loader.ai_client.chat.completions.create(
            model=config.MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3
        )
        answer = response.choices[0].message.content.strip()

        # 1. Проверка на белиберду
        if answer == "ERROR_NONSENSE":
            return {"success": False, "error": "nonsense"}

        # 2. Проверка на опечатку
        is_typo = False
        if answer.startswith("TYPO ||"):
            parts = answer.split("||")
            if len(parts) >= 3:
                original_word = parts[1].strip()
                translation = parts[2].strip()
                is_typo = True
        else:
            # 3. Обычный сценарий
            parts = answer.split("||")
            original_word = parts[0].strip()
            translation = parts[1].strip() if len(parts) > 1 else ""

        # Возвращаем новые ключи: original, translation и is_typo
        return {
            "success": True,
            "original": original_word,
            "translation": translation,
            "is_typo": is_typo
        }
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
@router.get("/tasks/new")
def get_new_task(chat_id: int, force: bool = False):
    try:
        if force:
            database.delete_active_task(chat_id)

        active = database.get_active_task(chat_id)
        # 🔥 ИСПРАВЛЕНО: Теперь возвращаем реальное правило, а не заглушку
        if active:
            return {
                "success": True,
                "phrase": active["phrase"],
                "rule": active.get("rule", "General Grammar")
            }

        user_config = database.get_user_config(chat_id)
        target_lang = user_config.get("source_lang", "en") if user_config else "en"
        lang_name = "английском" if target_lang == "en" else "немецком"
        difficulty = user_config.get("difficulty", "A1")

        words = database.get_words_for_grammar_context(chat_id, limit=1)
        words_str = ", ".join([f"{w['foreign']} ({w['ru']})" for w in words]) if words else "базовые слова"

        #prompt = aiPrompts.webapp_new_task_prompt(lang_name, words_str)
        prompt = aiPrompts.generate_pure_vocabulary_task_prompt_ver2(lang_name, words_str,difficulty)

        response = loader.ai_client.chat.completions.create(
            model=config.MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7
        )
        content = response.choices[0].message.content.strip()
        lines = [line.strip() for line in content.split('\n') if line.strip()]

        ru_phrase = lines[0]
        rule = lines[1] if len(lines) > 1 else "General Grammar"

        # 🔥 ИСПРАВЛЕНО: Сохраняем правило в БД вместе с фразой
        database.save_active_task(chat_id, ru_phrase, rule)
        return {"success": True, "phrase": ru_phrase, "rule": rule}
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.post("/tasks/help")
def get_task_help(data: TaskHelpData):
    try:
        active = database.get_active_task(data.chat_id)
        if not active:
            return {"success": False, "error": "Нет активного задания."}

        user_config = database.get_user_config(data.chat_id)
        target_lang = user_config.get("source_lang", "en") if user_config else "en"
        lang_name = "английском" if target_lang == "en" else "немецком"

        original_phrase = active["phrase"]

        # 🔥 Берем промпт из файла aiPrompts
        prompt = aiPrompts.webapp_task_help_prompt(original_phrase, lang_name, data.step)

        response = loader.ai_client.chat.completions.create(
            model=config.MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.5
        )
        ai_feedback = response.choices[0].message.content.strip()

        if data.step == 2:
            database.delete_active_task(data.chat_id)

        return {"success": True, "feedback": ai_feedback}
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
        lang_name = "английском" if target_lang == "en" else "немецком"

        original_phrase = active["phrase"]

        # 🔥 Берем промпт из файла aiPrompts
        prompt = aiPrompts.webapp_task_check_prompt(original_phrase, data.answer, lang_name)

        response = loader.ai_client.chat.completions.create(
            model=config.MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3
        )
        ai_feedback = response.choices[0].message.content.strip()

        is_correct = ai_feedback.upper().startswith("ПРАВИЛЬНО")

        if is_correct:
            database.delete_active_task(data.chat_id)
            database.add_to_history(data.chat_id, original_phrase)
            return {"success": True, "is_correct": True, "feedback": "✅ <b>Отлично! Перевод верный.</b>"}
        else:
            database.increment_help_count(data.chat_id)
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





@router.post("/settings/update")
def update_setting(data: UpdateSettingData):
    try:
        # Обновляем настройку в БД (database.py должен поддерживать эту функцию)
        database.update_user_setting(data.chat_id, data.setting_key, data.setting_value)
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}



# --- ЭНДПОИНТ 1: ГЕНЕРАЦИЯ 5 ФРАЗ (ПРОГРЕССИВНАЯ СЛОЖНОСТЬ) ---
@router.post("/intensity/start")
def start_intensity(data: IntensityStartData):
    try:
        user_config = database.get_user_config(data.chat_id)
        target_lang = user_config.get("source_lang", "en") if user_config else "en"

        # 🔥 Передаем только слово и язык. Сложность теперь жестко зашита в промпт (лесенка A1-B2)
        prompt = aiPrompts.generate_word_intensity_prompt(data.word, target_lang)

        response = loader.ai_client.chat.completions.create(
            model=config.MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.5
        )

        raw_json = response.choices[0].message.content.strip()

        # Надежный парсинг JSON (чистим от markdown)
        match = re.search(r'\[.*\]', raw_json, re.DOTALL)
        clean_json = match.group(0) if match else raw_json

        phrases_list = json.loads(clean_json)

        if len(phrases_list) < 5:
            return {"success": False, "error": "ИИ вернул неполный список"}

        return {"success": True, "phrases": phrases_list, "difficulty": "Прогрессивная (A1 ➔ B2)"}
    except Exception as e:
        return {"success": False, "error": str(e)}


# --- ЭНДПОИНТ 2: ПРОВЕРКА ОТВЕТА ---
@router.post("/intensity/check")
def check_intensity(data: IntensityCheckData):
    try:
        prompt = aiPrompts.check_intensity_answer_prompt(
            original_foreign_phrase=data.original_foreign_phrase,
            russian_task_phrase=data.russian_task_phrase,
            user_foreign_answer=data.user_answer
        )

        response = loader.ai_client.chat.completions.create(
            model=config.MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2
        )

        raw_json = response.choices[0].message.content.strip().replace("```json", "").replace("```", "").strip()
        result = json.loads(raw_json)

        return {
            "success": True,
            "is_correct": result.get("is_correct", False),
            "feedback": result.get("feedback", "Нет комментария")
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


# --- ЭНДПОИНТ 3: ПОДСКАЗКА ДЛЯ ИНТЕНСИВА ---
@router.post("/intensity/help")
def help_intensity(data: IntensityHelpData):
    try:
        prompt = aiPrompts.intensity_help_prompt(data.russian_phrase, data.foreign_phrase)

        response = loader.ai_client.chat.completions.create(
            model=config.MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3
        )

        explanation = response.choices[0].message.content.strip()
        return {"success": True, "explanation": explanation}
    except Exception as e:
        return {"success": False, "error": str(e)}


