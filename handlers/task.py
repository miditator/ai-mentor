# handlers/task.py
from telebot import types  # 🔥 ДОБАВИЛИ ДЛЯ СВЕРТЫВАНИЯ КЛАВИАТУРЫ
import aiPrompts
import config
from loader import bot, ai_client
import utils
from utils import send_text_task
import database
import keyboard  # Импортируем для меню

from . import buttons


# ==========================================
# ОСНОВНОЙ ХЭНДЛЕР ОЖИДАНИЯ ПЕРЕВОДА
# ==========================================

@bot.message_handler(func=lambda message: database.get_active_task(message.chat.id) is not None)
def check_english_translation(message):
    chat_id = message.chat.id

    # Подстраховка на случай пустых сообщений
    if not message.text:
        return

    user_answer = message.text.strip()

    # 🔥 ЖЕСТКИЙ ПЕРЕХВАТ КНОПОК (Ищем слова "Задание" и "Настройки" напрямую в тексте)
    if "Задание" in user_answer or "Настройки" in user_answer:
        print(f"--- ЖЕСТКИЙ ПЕРЕХВАТ СРАБОТАЛ: Удаляем задание для {chat_id} ---")

        database.delete_active_task(chat_id)
        utils.GENERATION_LOCKS[chat_id] = False  # Сбрасываем замки

        if "Настройки" in user_answer:
            buttons.show_settings(message)
        else:
            send_text_task(chat_id)
        return

    # ЛОГИКА КОМАНДЫ HELP
    if user_answer.lower() == "help":
        task_data = database.get_active_task(chat_id)
        if not task_data:
            return

        original_ru_phrase = task_data["phrase"]
        user_config = database.get_user_config(chat_id)
        end_lesson = False

        if task_data["help_count"] < 1:
            database.increment_help_count(chat_id)
            bot.send_message(
                chat_id,
                "💡 <b>Ментор отправляет подсказку</b>\n\n📌 Осталась 1 попытка\n",
                parse_mode="HTML"
            )
            prompt_text = aiPrompts.help_prompt(original_ru_phrase, user_config)
        else:
            bot.send_message(chat_id, "🛑 <b>Ответ ИИ-Ментора:</b>\n\n", parse_mode="HTML")
            prompt_text = aiPrompts.final_ready_prompt(original_ru_phrase, user_config)
            end_lesson = True

        try:
            response = ai_client.chat.completions.create(
                model=config.MODEL,
                messages=[{"role": "user", "content": prompt_text}],
                temperature=0.7
            )
            ai_text = response.choices[0].message.content

            # Если это была последняя попытка — прячем клавиатуру Android
            if end_lesson:
                bot.send_message(chat_id, ai_text, reply_markup=types.ReplyKeyboardRemove(), parse_mode="HTML")
                database.delete_active_task(chat_id)
                # Возвращаем меню
                bot.send_message(chat_id, "Выбери следующее действие 👇", reply_markup=keyboard.get_main_menu(),
                                 parse_mode="HTML")
            else:
                bot.send_message(chat_id, ai_text, parse_mode="HTML")

        except Exception as e:
            bot.reply_to(message, f"Ошибка ИИ: {e}")
        return

    # --- Сценарий обычного перевода ---
    task_data = database.get_active_task(chat_id)
    if not task_data:
        return

    original_ru_phrase = task_data["phrase"]
    user_config = database.get_user_config(chat_id)

    prompt_text = aiPrompts.answer_prompt(original_ru_phrase, user_answer, user_config)
    bot.send_message(chat_id, "🔍 <b>Проверяю твою грамматику...</b>", parse_mode="HTML")

    try:
        response = ai_client.chat.completions.create(
            model=config.MODEL,
            messages=[{"role": "user", "content": prompt_text}],
            temperature=0.5
        )
        ai_text = response.choices[0].message.content

        # 🔥 ИСПРАВЛЕНО: Шлем вердикт ИИ и принудительно ЗАКРЫВАЕМ клавиатуру Android
        bot.send_message(chat_id, ai_text, reply_markup=types.ReplyKeyboardRemove(), parse_mode="HTML")

        # Теперь безопасно удаляем задачу из активных
        database.delete_active_task(chat_id)

        # 🔥 Выкатываем обратно красивое нижнее меню (клавиатура телефона останется закрытой)
        bot.send_message(
            chat_id,
            "Задание выполнено! Выбери следующее действие:",
            reply_markup=keyboard.get_main_menu(),
            parse_mode="HTML"
        )

    except Exception as e:
        bot.reply_to(message, f"Ошибка ИИ: {e}")