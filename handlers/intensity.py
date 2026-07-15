# ==========================================
# ФАЙЛ: handlers/intensity.py
# ==========================================
import json
import re
import config
import database
import keyboard
import aiPrompts
import utils
from loader import bot, ai_client

# Структура для мини-игры: { chat_id: { "word": "apple", "phrases": [...], "current_index": 0, "score": 0 } }
CURRENT_INTENSITY = {}


# ========================================================
# 1. ПЕРЕХВАТ ВВОДА СЛОВА ДЛЯ СВОБОДНОГО РЕЖИМА (ИЗ МЕНЮ)
# ========================================================
@bot.message_handler(state="waiting_for_intensity_word")
def handle_intensity_word_input(message):
    chat_id = message.chat.id
    user_id = message.from_user.id
    user_text = message.text.strip() if message.text else ""

    # Если нажали отмену или прервать
    if user_text in ["🚪 Назад в меню", "🚪 Прервать интенсив", "🚪 Выход из тренировки"]:
        try:
            bot.delete_state(user_id, chat_id)
        except Exception:
            pass
        import utils
        utils.start_or_resume_timer(chat_id)
        bot.send_message(chat_id, "Режим интенсива отменен.", reply_markup=keyboard.get_main_menu())
        return

    # 🛑 ЗАЩИТА: Если пользователь случайно нажал любую другую кнопку меню во время ожидания ввода слова
    if user_text in ["⚙️ Настройки", "🎯 Новое задание", "📚 Тренировать слова", "➕ Добавить слово", "🔥 Интенсив по слову"]:
        try:
            bot.delete_state(user_id, chat_id)
        except Exception:
            pass
        import utils
        utils.start_or_resume_timer(chat_id)

        # Перенаправляем на глобальные хэндлеры
        from handlers.buttons import (
            show_settings, global_new_task_handler,
            global_words_training_handler, global_intensity_menu_handler,
            global_add_word_mode_handler
        )

        if user_text == "⚙️ Настройки":
            show_settings(message)
        elif user_text == "🎯 Новое задание":
            global_new_task_handler(message)
        elif user_text == "📚 Тренировать слова":
            global_words_training_handler(message)
        elif user_text == "🔥 Интенсив по слову":
            global_intensity_menu_handler(message)
        elif user_text == "➕ Добавить слово":
            global_add_word_mode_handler(message)
        return

    # Обычный сценарий — удаляем стейт и запускаем Интенсив
    try:
        bot.delete_state(user_id, chat_id)
    except Exception:
        pass

    user_config = database.get_user_config(chat_id)
    target_lang = user_config.get("source_lang", "en")

    start_word_intensity(chat_id, user_text, target_lang)


# ========================================================
# 2. ПЕРЕХВАТ ИНЛАЙН-КНОПКИ ПОСЛЕ ДОБАВЛЕНИЯ СЛОВА
# ========================================================
@bot.callback_query_handler(func=lambda call: call.data.startswith("launch_int__"))
def handle_inline_intensity_launch(call):
    chat_id = call.message.chat.id
    bot.answer_callback_query(call.id)

    word_to_train = call.data.replace("launch_int__", "")

    try:
        bot.delete_message(chat_id, call.message.message_id)
    except Exception:
        pass

    user_config = database.get_user_config(chat_id)
    target_lang = user_config.get("source_lang", "en")

    start_word_intensity(chat_id, word_to_train, target_lang)


# ========================================================
# 3. ГЛАВНАЯ ФУНКЦИЯ ЗАПУСКА И ГЕНЕРАЦИИ 5 ФРАЗ ЧЕРЕЗ ИИ
# ========================================================
def start_word_intensity(chat_id, word, target_lang=None):
    import utils
    utils.pause_timer(chat_id)

    # Гарантированно сбрасываем обычную сессию слов, чтобы режимы не конфликтовали
    from handlers.words import CURRENT_TRAINING
    CURRENT_TRAINING.pop(chat_id, None)

    # ВЫТАСКИВАЕМ НАСТРОЙКИ НАПРЯМУЮ ИЗ БАЗЫ ДАННЫХ
    user_config = database.get_user_config(chat_id)

    # 1. Забираем код языка
    if not target_lang:
        target_lang = user_config.get("source_lang", "en")

    # 2. Переводим цифру сложности из БД в строковый маркер уровня для ИИ
    diff_from_db = user_config.get("difficulty", "2")  # По дефолту "2" (это A2)

    # Нам нужно очистить строку от лишних пояснений, чтобы передать ИИ чистые "A1", "A2" и т.д.
    try:
        diff_key = int(diff_from_db)
        # Из "A2 (Элементарный)" забираем только первые два символа "A2"
        full_diff_text = keyboard.DIFFICULTY.get(diff_key, "A2 (Элементарный)")
        difficulty_for_ai = full_diff_text.split(" ")[0]  # Получим строго "A2"
    except ValueError:
        # Если в базе вдруг уже лежала чистая строка "A2"
        difficulty_for_ai = str(diff_from_db).split(" ")[0]

    # Красивое имя сложности для вывода пользователю в телеграм
    pretty_diff = keyboard.DIFFICULTY.get(int(diff_from_db) if str(diff_from_db).isdigit() else 2, "A2 (Элементарный)")

    loading = bot.send_message(
        chat_id,
        f"🧠 <i>ИИ генерирует 5 contextual-фразы уровня <b>{pretty_diff}</b> для слова <b>{word}</b>...</i>",
        parse_mode="HTML"
    )

    try:
        # 🔥 Передаем ИИ строго строковый маркер сложности ("A1", "A2", "B1"...)
        prompt = aiPrompts.generate_word_intensity_prompt(word, target_lang, difficulty_for_ai)

        response = ai_client.chat.completions.create(
            model=config.MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.5
        )

        raw_json = response.choices[0].message.content.strip()

        # Надежный парсинг JSON-массива
        import re
        match = re.search(r'\[.*\]', raw_json, re.DOTALL)
        if match:
            clean_json = match.group(0)
        else:
            clean_json = raw_json

        phrases_list = json.loads(clean_json)

        if len(phrases_list) < 5:
            raise ValueError("ИИ вернул неполный список фраз")

        # Записываем сессию интенсива
        CURRENT_INTENSITY[chat_id] = {
            "word": word,
            "phrases": phrases_list,
            "current_index": 0,
            "score": 0
        }

        bot.delete_message(chat_id, loading.message_id)

        bot.send_message(
            chat_id,
            f"🔥 <b>Запущен интенсив по слову: {word}!</b>\n"
            f"Сложность: <b>{pretty_diff}</b>. Переведи 5 предложений.\n"
            f"Погнали 🚀",
            reply_markup=keyboard.get_intensity_reply_menu(),
            parse_mode="HTML"
        )

        send_next_intensity_phrase(chat_id)

    except Exception as e:
        print(f"🔴 Ошибка старта интенсива: {e}")
        try:
            bot.delete_message(chat_id, loading.message_id)
        except Exception:
            pass
        bot.send_message(
            chat_id,
            f"⚠️ Не удалось сгенерировать интенсив для слова «{word}». Попробуй другое слово.",
            reply_markup=keyboard.get_main_menu()
        )
        utils.start_or_resume_timer(chat_id)


def send_next_intensity_phrase(chat_id):
    session = CURRENT_INTENSITY.get(chat_id)
    if not session:
        return

    idx = session["current_index"]

    if idx >= 5:
        score = session["score"]
        if score == 5:
            medal = "🥇 Великолепно! Истинный мастер контекста!"
        elif score >= 3:
            medal = "🥈 Хороший результат! Но есть над чем поработать."
        else:
            medal = "🥉 Нужно повторить правила, ИИ заметил много ошибок."

        bot.send_message(
            chat_id,
            f"🏆 <b>Интенсив по слову '{session['word']}' завершен!</b>\n\n"
            f"📊 Твой результат: <b>{score} из 5</b> правильных переводов.\n"
            f"{medal}\n\n"
            f"Выбери следующее действие на кнопках ниже 👇",
            reply_markup=keyboard.get_main_menu(),
            parse_mode="HTML"
        )
        CURRENT_INTENSITY.pop(chat_id, None)
        import utils
        utils.start_or_resume_timer(chat_id)
        return

    current_task = session["phrases"][idx]

    # 🌍 Вытаскиваем настройки пользователя из БД
    user_config = database.get_user_config(chat_id)
    target_lang_code = user_config.get("source_lang", "en")  # По дефолту английский

    # Сопоставляем код языка с красивым названием в дательном/винительном падеже
    lang_names_declined = {
        "en": "английский язык",
        "de": "немецкий язык",
    }

    # Получаем красивое название языка (или дефолтное, если код не распознан)
    display_lang = lang_names_declined.get(target_lang_code, "изучаемый язык")

    # Отправляем карточку с динамическим подставлением языка
    bot.send_message(
        chat_id,
        f"📝 <b>Фраза {idx + 1} из 5:</b>\n\n"
        f"👉 <code>{current_task['translation']}</code>\n\n"
        f"⚙️ <b>Задание:</b> {current_task['rule']}\n\n"
        f"<i>Напиши перевод на <b>{display_lang}</b> 👇</i>",
        parse_mode="HTML"
    )


# ========================================================
# 4. ИЗОЛИРОВАННЫЙ ПЕРЕХВАТ И ИИ-ПРОВЕРКА КАЖДОГО ОТВЕТА
# ========================================================

# 🛑 Перехватываем кнопку отмены И все системные кнопки меню ДО отправки текста к ИИ!
@bot.message_handler(
    func=lambda message: message.text in [
        "🚪 Прервать интенсив", "🚪 Назад в меню", "🚪 Выход из тренировки",
        "⚙️ Настройки", "🎯 Новое задание", "📚 Тренировать слова", "➕ Добавить слово", "🔥 Интенсив по слову"
    ]
)
def handle_intensity_cancel(message):
    chat_id = message.chat.id
    user_id = message.from_user.id
    trigger_text = message.text

    # Мгновенный замок: удаляем сессию из памяти
    CURRENT_INTENSITY.pop(chat_id, None)

    try:
        bot.delete_state(user_id, chat_id)
    except Exception:
        pass

    import utils
    utils.start_or_resume_timer(chat_id)

    # Если была нажата обычная кнопка прерывания
    if trigger_text in ["🚪 Прервать интенсив", "🚪 Назад в меню", "🚪 Выход из тренировки"]:
        bot.send_message(
            chat_id,
            "🚪 Интенсив прерван. Выбери следующее действие 👇",
            reply_markup=keyboard.get_main_menu()
        )
    # Если нажата другая кнопка нижнего меню — перенаправляем на её логику
    else:
        from handlers.buttons import (
            show_settings, global_new_task_handler,
            global_words_training_handler, global_intensity_menu_handler,
            global_add_word_mode_handler
        )

        if trigger_text == "⚙️ Настройки":
            show_settings(message)
        elif trigger_text == "🎯 Новое задание":
            global_new_task_handler(message)
        elif trigger_text == "📚 Тренировать слова":
            global_words_training_handler(message)
        elif trigger_text == "➕ Добавить слово":
            global_add_word_mode_handler(message)
        elif trigger_text == "🔥 Интенсив по слову":
            global_intensity_menu_handler(message)


# Этот хэндлер обрабатывает ТОЛЬКО реальные ответы пользователя
@bot.message_handler(func=lambda message: message.chat.id in CURRENT_INTENSITY)
def handle_intensity_answers(message):
    chat_id = message.chat.id
    session = CURRENT_INTENSITY[chat_id]
    user_text = message.text.strip() if message.text else ""

    # Дополнительная заглушка-предохранитель
    if user_text in [
        "🚪 Прервать интенсив", "🚪 Назад в меню", "🚪 Выход из тренировки",
        "⚙️ Настройки", "🎯 Новое задание", "📚 Тренировать слова", "➕ Добавить слово", "🔥 Интенсив по слову"
    ]:
        return

    idx = session["current_index"]
    current_task = session["phrases"][idx]

    checking_msg = bot.send_message(chat_id, "⏳ <i>ИИ-Ментор проверяет твой перевод...</i>", parse_mode="HTML")

    try:
        prompt = aiPrompts.check_intensity_answer_prompt(
            original_foreign_phrase=current_task["phrase"],
            russian_task_phrase=current_task["translation"],
            user_foreign_answer=user_text
        )

        response = ai_client.chat.completions.create(
            model=config.MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2
        )

        raw_json = response.choices[0].message.content.strip().replace("```json", "").replace("```", "").strip()
        result = json.loads(raw_json)

        bot.delete_message(chat_id, checking_msg.message_id)

        if result.get("is_correct") is True:
            status_emoji = "✅"
            session["score"] += 1
        else:
            status_emoji = "❌"

        feedback_text = (
            f"{status_emoji} <b>Разбор ИИ-Ментора:</b>\n"
            f"{result.get('feedback')}\n\n"
            f"🎯 <b>Эталон перевода:</b> <code>{current_task['phrase']}</code>"
        )

        bot.send_message(chat_id, feedback_text, parse_mode="HTML")

        try:
            bot.send_message(chat_id, "․\n")
        except Exception:
            pass

    except Exception as e:
        print(f"🔴 Ошибка проверки ИИ в интенсиве: {e}")
        try:
            bot.delete_message(chat_id, checking_msg.message_id)
        except Exception:
            pass
        bot.send_message(
            chat_id,
            f"⚠️ Ошибка связи с ментором. Засчитаем попытку!\n🎯 <b>Эталон:</b> {current_task['phrase']}"
        )

    session["current_index"] += 1
    send_next_intensity_phrase(chat_id)


# =====================================================================
# ПЕРЕХВАТ ИНЛАЙН-КНОПОК ПОСЛЕ УСПЕШНОГО ДОБАВЛЕНИЯ СЛОВА В СЛОВАРЬ
# =====================================================================

@bot.callback_query_handler(func=lambda call: call.data.startswith("post_add_int__"))
def handle_post_add_intensity_launch(call):
    chat_id = call.message.chat.id
    bot.answer_callback_query(call.id)

    word_to_train = call.data.replace("post_add_int__", "")

    try:
        bot.delete_message(chat_id, call.message.message_id)
    except Exception:
        pass

    start_word_intensity(chat_id, word_to_train)


@bot.callback_query_handler(func=lambda call: call.data == "post_add_to_menu")
def handle_post_add_return_to_menu(call):
    chat_id = call.message.chat.id
    bot.answer_callback_query(call.id)

    try:
        bot.delete_message(chat_id, call.message.message_id)
    except Exception:
        pass

    try:
        bot.delete_state(call.from_user.id, chat_id)
    except Exception:
        pass

    import utils
    utils.start_or_resume_timer(chat_id)

    bot.send_message(
        chat_id,
        "Возвращаемся в главное меню. Что будем делать дальше? 👇",
        reply_markup=keyboard.get_main_menu()
    )