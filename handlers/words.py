# handlers/words.py
import config
import random
import re  # 🔥 Обязательно для работы регулярных выражений при парсинге перевода!
import database
import keyboard
import aiPrompts
import utils
from telebot import types
from loader import bot, ai_client

# Структура: { chat_id: { "words": [...], "current_word": {}, "is_rus_to_eng": False } }
CURRENT_TRAINING = {}
WORDS_INLINE_LOCKS = {}


# ==========================================
# 0. ГЛОБАЛЬНЫЙ ПЕРЕХВАТЧИК ВЫХОДА (ПРИОРЕТЕТНЫЙ)
# ==========================================
@bot.message_handler(func=lambda message: message.text == "🚪 Выход из тренировки")
# ==========================================
# 0. ГЛОБАЛЬНЫЙ ПЕРЕХВАТЧИК ВЫХОДА (ПРИОРЕТЕТНЫЙ)
# ==========================================
@bot.message_handler(func=lambda message: message.text == "🚪 Выход из тренировки")
def global_exit_word_training(message):
    chat_id = message.chat.id
    user_id = message.from_user.id

    # 🔥 ИСПРАВЛЕНО: Убираем жесткий замок для текстовой кнопки выхода.
    # Если пользователь осознанно нажал текстовую кнопку выхода на клавиатуре,
    # мы ВСЕГДА его выпускаем в главное меню и чистим всё за ним.

    # Мгновенно тушим лок кнопок для этого чата на случай зависания
    global WORDS_INLINE_LOCKS
    WORDS_INLINE_LOCKS[chat_id] = False

    # Зачищаем сессию в оперативной памяти
    CURRENT_TRAINING.pop(chat_id, None)

    # Сбрасываем любые состояния ввода
    try:
        bot.delete_state(user_id, chat_id)
    except Exception:
        pass

    # Проверяем active task по грамматике
    active_task = database.get_active_task(chat_id)

    exit_text = "Вышли в главное меню."
    if active_task:
        exit_text += f"\n\n🤔 <b>Кстати, не забудь про текущее задание!</b>\nИИ-Ментор ждет перевод фразы:\n👉 <b>{active_task['phrase']}</b>"

    exit_text += "\n\nВыбери следующее действие на кнопках ниже 👇"

    # Отправляем сообщение и возвращаем клавиатуру меню
    bot.send_message(chat_id, exit_text, reply_markup=keyboard.get_main_menu(), parse_mode="HTML")

    # Снимаем таймер фраз с паузы
    import utils
    utils.start_or_resume_timer(chat_id)


# ==========================================
# 1. ОБРАБОТЧИК ВЫБОРА КОЛИЧЕСТВА СЛОВ (ЗАЩИЩЕННЫЙ)
# ==========================================
@bot.callback_query_handler(func=lambda call: call.data.startswith("train_count_"))
def handle_word_count_selection(call):
    chat_id = call.message.chat.id
    message_id = call.message.message_id

    # 🚨 ЗАЩИТА: Бесшумно игнорируем спам-клики при лагах сети
    if WORDS_INLINE_LOCKS.get(chat_id) is True:
        try:
            bot.answer_callback_query(call.id)
        except Exception:
            pass
        return

    # Включаем лок
    WORDS_INLINE_LOCKS[chat_id] = True

    try:
        try:
            bot.answer_callback_query(call.id)
        except Exception:
            pass

        chosen_count = int(call.data.replace("train_count_", ""))
        database.update_user_setting(chat_id, "words_per_day", chosen_count)

        try:
            bot.edit_message_text(
                chat_id=chat_id,
                message_id=message_id,
                text=f"📊 <b>Выбран лимит сессии: {chosen_count} слов.</b>\nЗапускаю карточки...",
                reply_markup=None,
                parse_mode="HTML"
            )
        except Exception as e:
            print(f"⚠️ Не удалось отредактировать сообщение: {e}")

        # Добавляем наш пустой отступ
        try:
            bot.send_message(chat_id, "․\n")
        except Exception:
            pass

        start_word_training(chat_id)

    finally:
        # 🔥 Гарантированно снимаем лок в конце
        WORDS_INLINE_LOCKS[chat_id] = False


# ==========================================
# 4. ОБРАБОТКА ИНЛАЙН КНОПОК ПОД КАРТОЧКАМИ (ЗАЩИЩЕННАЯ)
# ==========================================
@bot.callback_query_handler(func=lambda call: call.data.startswith("train_"))
def handle_training_inline(call):
    chat_id = call.message.chat.id
    message_id = call.message.message_id

    if chat_id not in CURRENT_TRAINING:
        try:
            bot.answer_callback_query(call.id, "Сессия тренировки не найдена.")
        except Exception:
            pass
        return

    session = CURRENT_TRAINING[chat_id]

    # --- 🔥 КЛИК ПО «ПЕРЕВЕРНУТЬ ПОРЯДОК» ---
    if call.data == "train_flip":
        # 1. Меняем флаг направления перевода
        session["is_rus_to_eng"] = not session["is_rus_to_eng"]
        direction = "Русский ➡️ Иностранный" if session["is_rus_to_eng"] else "Иностранный ➡️ Русский"

        try:
            bot.answer_callback_query(call.id, f"Порядок изменен: {direction}")
        except Exception:
            pass

        # 2. Берем текущую карточку слова, которая сейчас на экране
        word_card = session["current_word"]
        if not word_card:
            return

        # 3. Формируем новый перевернутый текст задания
        if session["is_rus_to_eng"]:
            text_to_show = f"🗣 Как переводится: <b>{word_card['ru']}</b>?"
        else:
            text_to_show = f"🇬🇧 Как переводится: <b>{word_card['en']}</b>?"

        # 4. 🔥 РЕДАКТИРУЕМ сообщение на месте вместо удаления!
        try:
            bot.edit_message_text(
                chat_id=chat_id,
                message_id=message_id,
                text=f"{text_to_show}\n\n<i>(Пройдено повторений этого слова: {word_card['streak']}/3)</i>",
                reply_markup=keyboard.get_training_menu(),
                parse_mode="HTML"
            )
        except Exception as e:
            print(f"⚠️ Не удалось перевернуть карточку на месте: {e}")

    # --- КЛИК ПО «ВЕСЬ СЛОВАРЬ» ---
    elif call.data == "train_show_dict":
        try:
            bot.answer_callback_query(call.id, "Загружаю словарь...")
        except Exception:
            pass

        words = database.get_full_dictionary(chat_id)

        text = "📖 <b>Твой текущий словарь:</b>\n\n"
        for en, ru, score in words:
            percent = min(score * 20, 100)
            text += f"• {en} — {ru} (<code>{percent}%</code>)\n"

        bot.send_message(chat_id, text, parse_mode="HTML")


# ==========================================
# 2. ЛОГИКА ТРЕНИРОВКИ СЛОВ
# ==========================================
def start_word_training(message_or_id):
    if isinstance(message_or_id, int):
        chat_id = message_or_id
    else:
        chat_id = message_or_id.chat.id

    utils.pause_timer(chat_id)

    user_config = database.get_user_config(chat_id)
    words_per_day = user_config.get("words_per_day", 5) if user_config else 5

    raw_words = database.get_words_for_training(chat_id, limit_new=words_per_day)

    if not raw_words:
        bot.send_message(chat_id, "🎉 На сегодня все слова повторены! Возвращайся завтра.",
                         reply_markup=keyboard.get_main_menu())
        utils.start_or_resume_timer(chat_id)
        return

    session_words = []
    for w_id, foreign, ru, score in raw_words:
        if foreign and ru:
            session_words.append({"id": w_id, "en": foreign.strip(), "ru": ru.strip(), "streak": 0})

    if not session_words:
        bot.send_message(chat_id, "⚠️ Не удалось загрузить слова. Попробуй добавить новые слова.",
                         reply_markup=keyboard.get_main_menu())
        utils.start_or_resume_timer(chat_id)
        return

    random.shuffle(session_words)

    CURRENT_TRAINING[chat_id] = {
        "words": session_words,
        "current_word": None,
        "is_rus_to_eng": False
    }

    send_next_card(chat_id, is_first_card=True)


def send_next_card(chat_id, is_first_card=False):
    session = CURRENT_TRAINING.get(chat_id)

    if not session or not session["words"]:
        active_task = database.get_active_task(chat_id)
        main_text = "🏆 <b>Отличная работа!</b> Сессия завершена, все слова успешно закреплены!"
        if active_task:
            main_text += f"\n\n⏰ <b>Напоминание:</b> Ментор все еще ожидает твой перевод для фразы:\n👉 <b>{active_task['phrase']}</b>"

        bot.send_message(chat_id, main_text, reply_markup=keyboard.get_main_menu(), parse_mode="HTML")
        CURRENT_TRAINING.pop(chat_id, None)

        import utils
        utils.start_or_resume_timer(chat_id)
        return

    word_card = session["words"][0]
    session["current_word"] = word_card

    user_config = database.get_user_config(chat_id)
    is_en = user_config.get("source_lang", "en") == "en"
    lang_emoji = "🇬🇧" if is_en else "🇩🇪"

    if session["is_rus_to_eng"]:
        text_to_show = f"🗣 Как переводится на {'английский' if is_en else 'немецкий'}: <b>{word_card['ru']}</b>?"
    else:
        text_to_show = f"{lang_emoji} Как переводится: <b>{word_card['en']}</b>?"
        if is_first_card:
            bot.send_message(
                chat_id,
                "🚀 Начинаем сессию повторения слов! Используй нижнее меню для подсказок.",
                reply_markup=keyboard.get_training_reply_menu(),
                parse_mode="HTML"
            )

    bot.send_message(
        chat_id,
        f"{text_to_show}\n\n<i>(Пройдено повторений этого слова: {word_card['streak']}/3)</i>",
        reply_markup=keyboard.get_training_menu(),
        parse_mode="HTML"
    )


# ==========================================
# 3. ОБРАБОТЧИК ОТВЕТОВ ВНУТРИ ТРЕНИРОВКИ
# ==========================================
@bot.message_handler(func=lambda message: message.chat.id in CURRENT_TRAINING)
def handle_training_answers(message):
    chat_id = message.chat.id
    session = CURRENT_TRAINING.get(chat_id)

    if not session or not session.get("current_word"):
        return

    user_text = message.text.strip() if message.text else ""

    # 🛑 ПРЕДОХРАНИТЕЛЬ: Если прилетела кнопка выхода или любая кнопка меню,
    # мы мгновенно выходим и не обрабатываем её текст как перевод слова!
    if user_text in [
        "🚪 Выход из тренировки", "🚪 Назад в меню", "⚙️ Настройки",
        "🎯 Новое задание", "📚 Тренировать слова", "➕ Добавить слово", "🔥 Интенсив по слову"
    ]:
        return

    # Переводим в нижний регистр для проверки только после отсечения системных кнопок!
    user_text_lower = user_text.lower()
    word_card = session["current_word"]

    if user_text == "💡 Помощь":
        hint = word_card["en"] if session["is_rus_to_eng"] else word_card["ru"]
        hint_letters = hint.strip()[:3].upper()

        bot.send_message(
            chat_id,
            f"💡 Подсказка: ответ начинается на — <b>{hint_letters}...</b>",
            parse_mode="HTML"
        )
        return

    correct_answer = word_card["en"].lower() if session["is_rus_to_eng"] else word_card["ru"].lower()

    if user_text_lower == correct_answer:
        bot.send_message(chat_id, "✅ Правильно!")
        word_card["streak"] += 1

        if word_card["streak"] >= 3:
            database.update_word_progress(word_id=word_card["id"], is_correct=True)
            session["words"].pop(0)
        else:
            session["words"].append(session["words"].pop(0))
    else:
        bot.send_message(chat_id, f"❌ Неверно. Правильный ответ: <b>{correct_answer}</b>", parse_mode="HTML")
        word_card["streak"] = 0
        database.update_word_progress(word_id=word_card["id"], is_correct=False)
        session["words"].append(session["words"].pop(0))

    send_next_card(chat_id)


# ==========================================
# 5. ДОБАВЛЕНИЕ СЛОВ ВРУЧНУЮ (FSM РЕЖИМ)
# ==========================================
def enter_add_word_mode(message):
    chat_id = message.chat.id
    CURRENT_TRAINING.pop(chat_id, None)

    utils.pause_timer(chat_id)

    bot.set_state(message.from_user.id, "waiting_for_custom_word", chat_id)

    bot.send_message(
        chat_id,
        "⏸ <b>Режим добавления слов активирован!</b>\n\n"
        "📥 Отправь мне любое слово или фразу.\n"
        "ИИ-Ментор автоматически переведет его и предложит сохранить.",
        reply_markup=keyboard.get_cancel_word_keyboard(),
        parse_mode="HTML"
    )


@bot.message_handler(state="waiting_for_custom_word")
def handle_custom_word_input(message):
    chat_id = message.chat.id
    user_id = message.from_user.id
    user_text = message.text.strip() if message.text else ""

    # 🛑 ГЛОБАЛЬНЫЙ ПРЕДОХРАНИТЕЛЬ: Сбрасываем режим ввода слов при клике на любые системные кнопки меню!
    if user_text in ["🚪 Назад в меню", "⚙️ Настройки", "🎯 Новое задание", "📚 Тренировать слова", "➕ Добавить слово", "🔥 Интенсив по слову"]:
        bot.delete_state(user_id, chat_id)
        utils.start_or_resume_timer(chat_id)

        # Если это была обычная отмена "Назад в меню"
        if user_text in ["🚪 Назад в меню"]:
            active_task = database.get_active_task(chat_id)
            exit_text = "Режим добавления отменен."
            if active_task:
                exit_text += f"\n\n⏰ <b>Напоминание:</b> ИИ-Ментор ждет перевод фразы:\n👉 <b>{active_task['phrase']}</b>"
            bot.send_message(chat_id, exit_text, reply_markup=keyboard.get_main_menu(), parse_mode="HTML")
            return

        # Если кликнули на другую кнопку — перенаправляем на её логику в buttons.py
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

    # Логика перевода ИИ
    user_config = database.get_user_config(chat_id)
    target_lang = user_config.get("source_lang", "en")

    loading = bot.send_message(chat_id, "⏳ <i>ИИ переводит слово...</i>", parse_mode="HTML")

    try:
        prompt = aiPrompts.word_translation_prompt(user_text, target_lang)
        response = ai_client.chat.completions.create(
            model=config.MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1
        )
        ai_response = response.choices[0].message.content.strip().replace('"', '').replace("'", "")

        bot.delete_message(chat_id, loading.message_id)

        if "||" in ai_response:
            orig, trans = ai_response.split("||", 1)
            orig, trans = orig.strip(), trans.strip()

            if re.search('[a-zA-Z]', orig):
                word_en, word_ru = orig, trans
            else:
                word_en, word_ru = trans, orig

            markup = keyboard.get_confirm_word_keyboard(word_en, word_ru)
            bot.send_message(
                chat_id,
                f"🤖 <b>Перевод готов:</b>\n"
                f"🇬🇧 Язык: <b>{word_en}</b>\n"
                f"🇷🇺 Русский: <b>{word_ru}</b>\n\n"
                f"Внести эту пару в твой интервальный словарь?",
                reply_markup=markup,
                parse_mode="HTML"
            )
        else:
            bot.send_message(chat_id, "❌ Не удалось корректно распознать перевод ИИ. Попробуй другое слово.")

    except Exception as e:
        print(f"Ошибка при переводе слова: {e}")
        try:
            bot.delete_message(chat_id, loading.message_id)
        except Exception:
            pass
        bot.send_message(chat_id, "⚠️ Ошибка связи с ИИ-словарем.")


@bot.callback_query_handler(func=lambda call: call.data.startswith("addword__"))
def handle_confirm_add_word(call):
    chat_id = call.message.chat.id
    user_id = call.from_user.id

    # 🛑 СБРАСЫВАЕМ СТЕЙТ В МОМЕНТ НАЖАТИЯ «Добавить»!
    # Это полностью закрывает сессию добавления, и кнопки главного меню снова работают безопасно.
    try:
        bot.delete_state(user_id, chat_id)
    except Exception as e:
        print(f"⚠️ Ошибка сброса стейта при добавлении слова: {e}")

    bot.answer_callback_query(call.id)

    raw_data = call.data.replace("addword__", "")
    try:
        word_en, word_ru = raw_data.split("::", 1)
    except ValueError:
        bot.send_message(chat_id, "❌ Ошибка обработки данных слова.")
        return

    is_saved = database.add_custom_word(chat_id, word_en, word_ru)

    if is_saved:
        post_add_markup = keyboard.get_post_add_word_menu(word_en)

        success_text = (
            f"📥 Слово <b>{word_en}</b> [<i>{word_ru}</i>] успешно добавлено в словарь!\n\n"
            f"🧠 Хочешь прямо сейчас закрепить его на практике в контексте?"
        )

        try:
            bot.edit_message_text(
                chat_id=chat_id,
                message_id=call.message.message_id,
                text=success_text,
                reply_markup=post_add_markup,
                parse_mode="HTML"
            )
        except Exception:
            bot.send_message(
                chat_id=chat_id,
                text=success_text,
                reply_markup=post_add_markup,
                parse_mode="HTML"
            )
    else:
        bot.send_message(chat_id, f"⚠️ Слово <b>{word_en}</b> уже есть в твоем словаре.")
        try:
            bot.delete_message(chat_id, call.message.message_id)
        except Exception:
            pass