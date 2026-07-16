# keyboards.py
from telebot import types

# 🔥 ИСПРАВЛЕНО: Ключи приведены к числам (1-5) для синхронизации с твоей БД,
# а значения — это красивые строковые названия для вывода пользователю.
DIFFICULTY = {
    1: "A1 (Начальный)",
    2: "A2 (Элементарный)",
    3: "B1 (Средний)",
    4: "B2 (Выше среднего)",
    5: "C1 (Продвинутый)"
}

def get_main_menu():
    """Главное меню со встроенной кнопкой запуска Telegram Mini App"""
    markup = types.ReplyKeyboardMarkup(resize_keyboard=True)

    # 🔥 ТВОЯ ССЫЛКА ИЗ GITHUB PAGES (не забудь заменить на свою реальную ссылку!)
    web_app = types.WebAppInfo(url="https://miditator.github.io/ai-mentor/?v=2.1")

    btn_task = types.KeyboardButton(text="🎯 Новое задание")
    btn_add_word = types.KeyboardButton(text="➕ Добавить слово")
    btn_words = types.KeyboardButton(text="📚 Тренировать слова")
    btn_intensity = types.KeyboardButton(text="🔥 Интенсив по слову")
    btn_settings = types.KeyboardButton(text="⚙️ Настройки")

    # Кнопка, открывающая Mini App прямо снизу чата
    btn_profile = types.KeyboardButton(text="📱 Мой Профиль", web_app=web_app)

    markup.row(btn_add_word, btn_task)  # 1-й ряд: Добавить слово и Новое задание
    markup.row(btn_words, btn_intensity)  # 2-й ряд: Тренировка и Интенсив
    markup.row(btn_settings, btn_profile)  # 3-й ряд: Настройки и Профиль
    return markup


def get_start_language_menu():
    """Шаг 1: Выбор языка при старте"""
    markup = types.InlineKeyboardMarkup(row_width=2)
    lang_en = types.InlineKeyboardButton(text="🇬🇧 Английский (EN)", callback_data="start_lang_en")
    lang_ger = types.InlineKeyboardButton(text="🇩🇪 Немецкий (GER)", callback_data="start_lang_de")
    markup.add(lang_en, lang_ger)
    return markup


def get_start_mode_menu():
    """Шаг 3 (Финал): Выбор режима (Фразы, Слова или Интенсив)"""
    markup = types.InlineKeyboardMarkup(row_width=1)
    btn_phrases = types.InlineKeyboardButton(text="✍️ Тренировать Фразы", callback_data="start_mode_phrases")
    btn_words = types.InlineKeyboardButton(text="📚 Учить Слова", callback_data="start_mode_words")
    btn_intensity = types.InlineKeyboardButton(text="🔥 Интенсив по Слову", callback_data="start_mode_intensity")

    markup.add(btn_phrases, btn_words, btn_intensity)
    return markup


def get_start_difficulty_menu():
    """Шаг 2: Выбор уровня сложности на основе числовых ключей"""
    markup = types.InlineKeyboardMarkup(row_width=2)

    # key — это число (1, 2, 3...), value — это строка ("A1 (Начальный)"...)
    diff_buttons = [
        types.InlineKeyboardButton(text=f"📊 {value}", callback_data=f"start_diff_{key}")
        for key, value in DIFFICULTY.items()
    ]
    markup.add(*diff_buttons)
    return markup


def get_settings_menu():
    """Создает Inline-клавиатуру для настроек (язык и сложность)"""
    markup = types.InlineKeyboardMarkup(row_width=2)

    # Генерация кнопок сложности
    diff_buttons = [
        types.InlineKeyboardButton(text=f"📊 {value}", callback_data=f"set_diff_{key}")
        for key, value in DIFFICULTY.items()
    ]
    markup.add(*diff_buttons)

    # Кнопки выбора языка
    lang_en = types.InlineKeyboardButton(text="🇬🇧 Английский (EN)", callback_data="set_lang_en")
    lang_ger = types.InlineKeyboardButton(text="🇩🇪 Немецкий (GER)", callback_data="set_lang_de")

    markup.add(lang_en, lang_ger)
    return markup


# --- ФУНКЦИИ СЛОВАРЯ И ТРЕНИРОВОК ---

def get_training_menu():
    """Специальное инлайн-меню под карточкой слова во время тренировки"""
    markup = types.InlineKeyboardMarkup(row_width=2)
    btn_flip = types.InlineKeyboardButton("🔄 Перевернуть порядок", callback_data="train_flip")
    btn_dict = types.InlineKeyboardButton("📖 Весь словарь", callback_data="train_show_dict")
    markup.add(btn_flip, btn_dict)
    return markup


def get_training_reply_menu():
    """Нижняя текстовая панель во время тренировки"""
    markup = types.ReplyKeyboardMarkup(resize_keyboard=True, row_width=2)
    markup.add(types.KeyboardButton("💡 Помощь"), types.KeyboardButton("🚪 Выход из тренировки"))
    return markup


def get_cancel_word_keyboard():
    """Кнопка отмены режима добавления слова / ожидания ввода слова для Интенсива"""
    markup = types.ReplyKeyboardMarkup(resize_keyboard=True, row_width=1)
    markup.add(types.KeyboardButton("🚪 Назад в меню"))
    return markup


def get_confirm_word_keyboard(word_en, word_ru):
    """Кнопка подтверждения добавления слова в интервальный словарь"""
    markup = types.InlineKeyboardMarkup()
    callback_data = f"addword__{word_en}::{word_ru}"
    btn_confirm = types.InlineKeyboardButton(text="➕ Добавить в словарь", callback_data=callback_data)
    markup.add(btn_confirm)
    return markup


def get_word_count_menu():
    """Инлайн-кнопки для выбора количества слов перед тренировкой"""
    markup = types.InlineKeyboardMarkup(row_width=3)
    btn_3 = types.InlineKeyboardButton(text="3 слова", callback_data="train_count_3")
    btn_5 = types.InlineKeyboardButton(text="5 слов", callback_data="train_count_5")
    btn_10 = types.InlineKeyboardButton(text="10 слов", callback_data="train_count_10")
    markup.add(btn_3, btn_5, btn_10)
    return markup


def get_pre_training_reply_menu():
    """Нижняя панель, которая висит ТОЛЬКО во время выбора количества слов"""
    markup = types.ReplyKeyboardMarkup(resize_keyboard=True, row_width=1)
    markup.add(types.KeyboardButton("🚪 Выход из тренировки"))
    return markup


def get_intensity_reply_menu():
    """Нижняя панель, которая отображается во время прохождения Интенсива"""
    markup = types.ReplyKeyboardMarkup(resize_keyboard=True, row_width=1)
    markup.add(types.KeyboardButton("🚪 Прервать интенсив"))
    return markup


def get_post_add_word_menu(word):
    """
    Клавиатура после успешного добавления слова.
    Позволяет сразу запустить Интенсив по этому слову или вернуться в меню.
    """
    markup = types.InlineKeyboardMarkup(row_width=1)

    # Вшиваем само слово в callback_data, чтобы обработчик знал, по какому слову стартовать
    btn_intensity = types.InlineKeyboardButton(
        text=f"🔥 Пройти интенсив по слову «{word}»",
        callback_data=f"post_add_int__{word}"
    )
    btn_menu = types.InlineKeyboardButton(
        text="🚪 Вернуться в главное меню",
        callback_data="post_add_to_menu"
    )

    markup.add(btn_intensity, btn_menu)
    return markup


from telebot import types


def get_onboarding_app_menu():
    """Создает клавиатуру с кнопкой запуска Mini App для онбординга"""
    markup = types.InlineKeyboardMarkup(row_width=1)

    # Ссылка на твой Mini App на GitHub Pages.
    # Не забывай менять версию (?v=...), чтобы сбрасывать кэш в Telegram!
    web_app_url = "https://miditator.github.io/ai-mentor/?v=3.4"

    app_button = types.InlineKeyboardButton(
        text="⚙️ Настроить профиль",
        web_app=types.WebAppInfo(url=web_app_url)
    )
    markup.add(app_button)
    return markup