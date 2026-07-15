import time
import config
import database
import aiPrompts
from loader import bot, ai_client
import keyboard
import json

GENERATION_LOCKS = {}
TIMER_STATES = {}


def start_or_resume_timer(chat_id):
    """Включает или возобновляет таймер для пользователя"""
    import threading
    if TIMER_STATES.get(chat_id) == "active":
        return
    if TIMER_STATES.get(chat_id) == "paused":
        TIMER_STATES[chat_id] = "active"
        print(f"⏰ Таймер для {chat_id} ВОЗОБНОВЛЕН.")
        return
    TIMER_STATES[chat_id] = "active"
    print(f"⏰ Фоновый таймер для {chat_id} ЗАПУЩЕН.")
    threading.Thread(target=send_question_timer_loop, args=(chat_id,), daemon=True).start()


def pause_timer(chat_id):
    """Ставит таймер на паузу"""
    TIMER_STATES[chat_id] = "paused"
    print(f"⏸ Таймер для {chat_id} ПОСТАВЛЕН НА ПАУЗУ.")


def send_question_timer_loop(chat_id):
    time.sleep(config.TASK_INTERVAL)
    while True:
        current_state = TIMER_STATES.get(chat_id, "stopped")
        if current_state == "stopped":
            break
        if current_state == "paused":
            time.sleep(5)
            continue
        if database.get_active_task(chat_id) is not None:
            try:
                bot.send_message(chat_id, "⏰ <b>Не забудь решить текущее задание!</b> Ментор ждет твой перевод.",
                                 parse_mode="HTML")
            except Exception:
                pass
        else:
            send_text_task(chat_id)
        time.sleep(config.TASK_INTERVAL)


def send_text_task(chat_id):
    user_config = database.get_user_config(chat_id)
    target_lang = user_config.get("source_lang", "en")

    # 1. Извлекаем сырую сложность из БД (цифру, например "3")
    diff_from_db = user_config.get("difficulty", "2")  # По умолчанию "2" (это A2)

    # 2. Конвертируем цифру из БД в чистый буквенный маркер для ИИ (например, "B1")
    try:
        diff_key = int(diff_from_db)
        # Из строки "B1 (Средний)" забираем только "B1"
        full_diff_text = keyboard.DIFFICULTY.get(diff_key, "A2 (Элементарный)")
        difficulty_for_ai = full_diff_text.split(" ")[0]  # Получим строго "B1"
    except ValueError:
        # Если в базе вдруг уже лежала чистая строка "B1"
        difficulty_for_ai = str(diff_from_db).split(" ")[0]

    # 3. Получаем красивое название уровня сложности для вывода пользователю в чате
    try:
        diff_key = int(diff_from_db)
        pretty_diff = keyboard.DIFFICULTY.get(diff_key, f"Уровень {diff_from_db}")
    except ValueError:
        pretty_diff = diff_from_db

    # Сбор материалов для генерации задания
    words_to_blend = database.get_words_for_grammar_context(chat_id, limit=2)
    history = database.get_today_phrases_list(chat_id)

    try:
        # 🔥 Передаем ИИ строго буквенный маркер сложности (A1, A2, B1...), а не сырую цифру!
        prompt = aiPrompts.generate_pure_vocabulary_task_prompt(target_lang, difficulty_for_ai, words_to_blend, history)
        response = ai_client.chat.completions.create(
            model=config.MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.4
        )

        raw_json = response.choices[0].message.content.strip().replace("```json", "").replace("```", "").strip()
        task_json = json.loads(raw_json)

        database.save_active_task(chat_id, task_json["phrase"], task_json["rule_hint"])
        database.add_to_history(chat_id, task_json["phrase"])

        words_line = ", ".join([f"<b>{w['foreign']}</b>" for w in words_to_blend])
        lang_label = "АНГЛИЙСКИЙ 🇬🇧" if target_lang == "en" else "НЕМЕЦКИЙ 🇩🇪"

        # 🔥 Отправляем задание пользователю с отображением красивого pretty_diff вместо цифры!
        bot.send_message(
            chat_id,
            f"🤖 <b>Новое задание на основе твоего словаря!</b>\n"
            f"🎯 Уровень сложности: <code>{pretty_diff}</code>\n"
            f"💡 Используем слова: {words_line}\n\n"
            f"👉 <code>{task_json['phrase']}</code>\n\n"
            f"<b>Переведи это предложение на {lang_label} язык 👇</b>",
            reply_markup=keyboard.get_main_menu(),
            parse_mode="HTML"
        )

    except Exception as e:
        print(f"🔴 Ошибка генерации контекстного таска: {e}")
        bot.send_message(chat_id, "⚠️ Ментор задумался. Нажми «🎯 Новое задание» еще раз.")