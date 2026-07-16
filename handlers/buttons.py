# ==========================================
# ФАЙЛ: handlers/buttons.py
# ==========================================
import threading
import telebot
import keyboard  # Используем имя модуля, как в твоем файле клавиатур
import database
import config
import utils
import aiPrompts
from telebot import types
from loader import bot, ai_client
from utils import send_text_task
from handlers.words import start_word_training, enter_add_word_mode
import json

SEPARATOR = "___"
BUTTONS_LOCKS = {}


def show_settings(message):
    chat_id = message.chat.id
    markup = keyboard.get_settings_menu()
    bot.send_message(
        chat_id,
        "⚙️ <b>Настройки профиля</b>\n\nВыбери уровень сложности и целевой язык для перевода задания:",
        reply_markup=markup,
        parse_mode="HTML"
    )


def seed_initial_words_via_ai(chat_id, target_lang="en"):
    """Проверяет наличие слов СТРОГО для передаваемого target_lang"""
    existing_words = database.get_full_dictionary(chat_id, specific_lang=target_lang)
    if existing_words:
        print(f"ℹ️ Для chat_id {chat_id} слова на языке '{target_lang}' уже существуют. Пропускаем.")
        return

    print(f"📡 Запрашиваем у ИИ стартовый набор слов ({target_lang}) для chat_id: {chat_id}")
    try:
        prompt = aiPrompts.get_starting_words_prompt(target_lang)
        response = ai_client.chat.completions.create(
            model=config.MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3
        )
        raw_json = response.choices[0].message.content.strip().replace("```json", "").replace("```", "").strip()
        words_list = json.loads(raw_json)

        for item in words_list:
            database.add_custom_word(chat_id, item["foreign"], item["ru"], specific_lang=target_lang)
        print(f"✅ База данных chat_id {chat_id} успешно инициализирована 10 словами ({target_lang}) от ИИ.")
    except Exception as e:
        print(f"❌ Критическая ошибка генерации стартовых слов ИИ: {e}")


@bot.callback_query_handler(func=lambda call: call.data.startswith(("set_", "start_")))
@bot.callback_query_handler(func=lambda call: call.data.startswith(("set_", "start_")))
def handle_settings_clicks(call):
    chat_id = call.message.chat.id
    message_id = call.message.message_id

    if BUTTONS_LOCKS.get(chat_id) is True:
        try:
            bot.answer_callback_query(call.id, "⏳ Секунду, бот обрабатывает прошлый клик...")
        except Exception:
            pass
        return

    BUTTONS_LOCKS[chat_id] = True

    try:
        # --- СТАРТ ШАГ 1: ВЫБРАЛИ ЯЗЫК (При первом запуске) ---
        if call.data.startswith("start_lang_"):
            chosen_lang = call.data.replace("start_lang_", "")
            database.update_user_setting(chat_id, "source_lang", chosen_lang)

            lang_text = "Английский" if chosen_lang == "en" else "Немецкий"

            try:
                # Просто "гасим" часы на кнопке без всплывающего текста
                bot.answer_callback_query(call.id)
                bot.edit_message_reply_markup(chat_id=chat_id, message_id=message_id, reply_markup=None)
            except Exception:
                pass

            bot.send_message(chat_id, SEPARATOR)

            # Переходим к Шагу 2
            markup = keyboard.get_start_difficulty_menu()
            bot.send_message(
                chat_id,
                f"🌍 Язык изменен на <b>{lang_text}</b>.\n\n⚙️ <b>Шаг 2 из 3:</b> Выбери уровень сложности:",
                reply_markup=markup,
                parse_mode="HTML"
            )

        # --- СТАРТ ШАГ 2: ВЫБРАЛИ СЛОЖНОСТЬ (При первом запуске) ---
        elif call.data.startswith("start_diff_"):
            chosen_diff_str = call.data.replace("start_diff_", "")
            database.update_user_setting(chat_id, "difficulty", chosen_diff_str)

            try:
                diff_key = int(chosen_diff_str)
                pretty_diff = keyboard.DIFFICULTY.get(diff_key, f"Уровень {chosen_diff_str}")
            except ValueError:
                pretty_diff = chosen_diff_str

            try:
                bot.answer_callback_query(call.id)
                bot.edit_message_reply_markup(chat_id=chat_id, message_id=message_id, reply_markup=None)
            except Exception:
                pass

            bot.send_message(chat_id, SEPARATOR)
            finish_global_onboarding(chat_id, pretty_diff)

        # --- ОБЫЧНЫЕ НАСТРОЙКИ (ИЗ МЕНЮ ⚙️) ---
        elif call.data.startswith("set_"):
            try:
                chat_message_text = "⚙️ Настройки обновлены!"

                if call.data.startswith("set_diff_"):
                    chosen_diff_str = call.data.replace("set_diff_", "")
                    database.update_user_setting(chat_id, "difficulty", chosen_diff_str)

                    try:
                        diff_key = int(chosen_diff_str)
                        pretty_diff = keyboard.DIFFICULTY.get(diff_key, f"Уровень {chosen_diff_str}")
                    except ValueError:
                        pretty_diff = chosen_diff_str

                    chat_message_text = f"📊 <b>Уровень сложности успешно изменен!</b>\nНовый уровень: <b>{pretty_diff}</b>"

                elif call.data.startswith("set_lang_"):
                    chosen_lang = call.data.replace("set_lang_", "")
                    database.update_user_setting(chat_id, "source_lang", chosen_lang)
                    lang_name = "Английский 🇬🇧" if chosen_lang == "en" else "Немецкий 🇩🇪"

                    chat_message_text = f"🌍 <b>Целевой язык успешно изменен!</b>\nНовый язык: <b>{lang_name}</b>"

                    # Генерируем стартовые слова через ИИ для обычных настроек
                    seed_initial_words_via_ai(chat_id, chosen_lang)

                # 1. Сбрасываем бесконечную загрузку на кнопке
                bot.answer_callback_query(call.id)

                # 2. Отправляем сообщение об изменении ПРЯМО В ЧАТ бота
                bot.send_message(chat_id, chat_message_text, parse_mode="HTML")

            except Exception as e:
                print(f"⚠️ Ошибка обработки настроек меню: {e}")
    finally:
        BUTTONS_LOCKS[chat_id] = False


def finish_global_onboarding(chat_id, pretty_diff):
    """
    Универсальный финал онбординга.
    Выводит сводку настроек и открывает главное меню.
    """
    current_config = database.get_user_config(chat_id)
    current_lang_code = current_config.get("source_lang", "en")
    current_lang_text = "Английский" if current_lang_code == "en" else "Немецкий"

    # 🔥 ИСПРАВЛЕНО: Убран seed_test_words. Вместо этого запускаем твою ИИ-генерацию!
    seed_initial_words_via_ai(chat_id, current_lang_code)

    # Отправляем финальное приветствие
    bot.send_message(
        chat_id,
        f"🎉 <b>Настройка успешно завершена!</b>\n\n"
        f"🌍 Изучаемый язык: <b>{current_lang_text}</b>\n"
        f"📈 Уровень сложности: <b>{pretty_diff}</b>\n\n"
        f"Все инструменты готовы к работе. Выбери режим тренировки на кнопках ниже 👇",
        reply_markup=keyboard.get_main_menu(),
        parse_mode="HTML"
    )

    # Запускаем фоновый таймер интервальных фраз
    import utils
    utils.start_or_resume_timer(chat_id)


@bot.message_handler(func=lambda message: message.text == "🎯 Новое задание")
def global_new_task_handler(message):
    chat_id = message.chat.id
    utils.GENERATION_LOCKS[chat_id] = False
    database.delete_active_task(chat_id)
    send_text_task(chat_id)
    utils.start_or_resume_timer(chat_id)


@bot.message_handler(func=lambda message: message.text == "⚙️ Настройки")
def global_settings_handler(message):
    chat_id = message.chat.id
    from handlers.words import CURRENT_TRAINING
    if chat_id in CURRENT_TRAINING:
        return
    show_settings(message)


@bot.message_handler(func=lambda message: message.text == "📚 Тренировать слова")
def global_words_training_handler(message):
    chat_id = message.chat.id
    utils.pause_timer(chat_id)
    bot.send_message(
        chat_id,
        "🟢 ═ ТРЕНИРОВКА СЛОВ ═ 🟢",
        reply_markup=keyboard.get_pre_training_reply_menu(),
        parse_mode="HTML"
    )
    markup = keyboard.get_word_count_menu()
    bot.send_message(
        chat_id,
        "📊 <b>Сколько слов ты хочешь потренировать сейчас?</b>\nВыбери лимит сессии на кнопках ниже 👇",
        reply_markup=markup,
        parse_mode="HTML"
    )


@bot.message_handler(func=lambda message: message.text == "➕ Добавить слово")
def global_add_word_mode_handler(message):
    enter_add_word_mode(message)


@bot.message_handler(func=lambda message: message.text == "🔥 Интенсив по слову")
def global_intensity_menu_handler(message):
    chat_id = message.chat.id
    user_id = message.from_user.id

    utils.pause_timer(chat_id)

    user_config = database.get_user_config(chat_id)
    target_lang = "Английский" if user_config.get("source_lang", "en") == "en" else "Немецкий"

    # Красиво вытаскиваем сложность на основе циферного ключа из БД
    diff_from_db = user_config.get("difficulty", "2")
    try:
        diff_key = int(diff_from_db)
        difficulty = keyboard.DIFFICULTY.get(diff_key, f"Уровень {diff_from_db}")
    except ValueError:
        difficulty = diff_from_db

    bot.set_state(user_id, "waiting_for_intensity_word", chat_id)

    bot.send_message(
        chat_id,
        f"🧠 <b>Режим Интенсива по слову!</b>\n\n"
        f"⚙️ Текущие настройки:\n"
        f"🌍 Язык перевода: <b>{target_lang}</b>\n"
        f"📈 Сложность контекстов: <b>{difficulty}</b>\n\n"
        f"📥 <b>Напиши в чат любое слово</b> (или короткую фразу), и ИИ-Ментор построит вокруг него 5 грамматических испытаний 👇",
        reply_markup=keyboard.get_cancel_word_keyboard(),
        parse_mode="HTML"
    )


@bot.callback_query_handler(func=lambda call: call.data == "start_chat_onboarding")
def start_chat_onboarding_callback(call):
    chat_id = call.message.chat.id

    # Удаляем старое инлайн-сообщение с выбором, чтобы не захламлять чат
    bot.delete_message(chat_id, call.message.message_id)

    # Отправляем стандартный текстовый выбор языка
    markup = keyboard.get_start_language_menu()  # Твоя старая функция выбора языка в чате
    bot.send_message(
        chat_id,
        "🌍 <b>Шаг 1 из 2 (в чате):</b> Выбери целевой язык для изучения:",
        reply_markup=markup,
        parse_mode="HTML"
    )