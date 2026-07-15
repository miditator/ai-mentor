# start.py
from loader import bot
import utils
import database
import keyboard
from telebot import types
from utils import send_text_task


@bot.message_handler(commands=['start'])
def StartMentor(message):
    chat_id = message.chat.id
    user_id = message.from_user.id if message.from_user else chat_id

    # Если уже идет тренировка слов — молча игнорируем повторный старт
    from handlers.words import CURRENT_TRAINING
    if chat_id in CURRENT_TRAINING:
        return

    # Если в режиме добавления слов — тоже молча игнорируем
    current_state = bot.get_state(user_id, chat_id)
    if current_state == "waiting_for_custom_word":
        return

    # Удаляем активный таск при перезапуске
    database.delete_active_task(chat_id)

    # 🔍 ПРОВЕРКА: Существует ли уже конфигурация пользователя в БД?
    user_config = database.get_user_config(chat_id)

    # Меняем условие: пользователь зарегистрирован ТОЛЬКО если конфиг существует
    # И в нем реально заполнены и язык, и сложность (не равны None или пустой строке)
    is_registered = False
    if user_config:
        has_lang = user_config.get("source_lang") is not None and user_config.get("source_lang") != ""
        has_diff = user_config.get("difficulty") is not None and user_config.get("difficulty") != ""
        if has_lang and has_diff:
            is_registered = True

    if is_registered:
        # Пользователь уже зарегистрирован — показываем настройки и главное меню
        lang_code = user_config.get("source_lang", "en")
        pretty_lang = "Английский" if lang_code == "en" else "Немецкий"

        diff_from_db = user_config.get("difficulty", "2")
        try:
            diff_key = int(diff_from_db)
            pretty_diff = keyboard.DIFFICULTY.get(diff_key, f"Уровень {diff_from_db}")
        except ValueError:
            pretty_diff = diff_from_db

        # Включаем фоновый таймер фраз, если он спал
        utils.start_or_resume_timer(chat_id)

        bot.send_message(
            chat_id,
            f"👋 <b>Рад видеть тебя снова!</b>\n\n"
            f"Твой профиль уже настроен и готов к работе:\n"
            f"🌍 Изучаемый язык: <b>{pretty_lang}</b>\n"
            f"📈 Уровень сложности: <b>{pretty_diff}</b>\n\n"
            f"Выбери режим тренировки на кнопках ниже 👇",
            reply_markup=keyboard.get_main_menu(),
            parse_mode="HTML"
        )
        return  # Завершаем функцию, не пуская в онбординг

    # --- 🟢 ЛОГИКА ОНБОРДИНГА ДЛЯ НОВЫХ ПОЛЬЗОВАТЕЛЕЙ ---

    # 🆕 Резервируем пустую запись в БД (поля настроек запишутся как NULL)
    database.create_empty_user(chat_id)

    # Прячем "Новое задание", "Настройки" и т.д., чтобы очистить интерфейс
    bot.send_message(
        chat_id,
        "🚀 <b>Добро пожаловать в Умный ИИ-Ментор!</b>\n\n"
        "Давай настроим твой профиль для максимально эффективного обучения.",
        reply_markup=types.ReplyKeyboardRemove(),
        parse_mode="HTML"
    )

    # Шаг 1: Выбор языка
    markup = keyboard.get_start_language_menu()
    bot.send_message(
        chat_id,
        "🌍 <b>Шаг 1 из 2:</b> Выбери целевой язык для изучения:",
        reply_markup=markup,
        parse_mode="HTML"
    )