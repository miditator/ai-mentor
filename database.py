# ==========================================
# ФАЙЛ: database.py
# ==========================================
import sqlite3

DB_NAME = "mentor_bot.db"


def init_db():
    """Создает все необходимые таблицы при старте бота, если их еще нет"""
    conn = sqlite3.connect(DB_NAME, check_same_thread=False)
    cursor = conn.cursor()

    # 1. ТАБЛИЦА НАСТРОЕК ПОЛЬЗОВАТЕЛЯ
    cursor.execute('''
                   CREATE TABLE IF NOT EXISTS user_settings
                   (
                       chat_id
                       INTEGER
                       PRIMARY
                       KEY,
                       difficulty
                       TEXT
                       DEFAULT
                       'A1',
                       source_lang
                       TEXT
                       DEFAULT
                       'en',
                       words_per_day
                       INTEGER
                       DEFAULT
                       5
                   )
                   ''')

    # 2. ТАБЛИЦА ДЛЯ АКТИВНЫХ ЗАДАНИЙ (ФРАЗЫ)
    cursor.execute('''
                   CREATE TABLE IF NOT EXISTS active_tasks
                   (
                       chat_id
                       INTEGER
                       PRIMARY
                       KEY,
                       phrase
                       TEXT,
                       rule
                       TEXT,
                       help_count
                       INTEGER
                       DEFAULT
                       0
                   )
                   ''')

    # 3. ТАБЛИЦА ИСТОРИИ ВЫДАННЫХ ФРАЗ
    cursor.execute('''
                   CREATE TABLE IF NOT EXISTS task_history
                   (
                       id
                       INTEGER
                       PRIMARY
                       KEY
                       AUTOINCREMENT,
                       chat_id
                       INTEGER,
                       phrase
                       TEXT,
                       date
                       TEXT
                       DEFAULT (
                       DATE
                   (
                       'now',
                       'localtime'
                   ))
                       )
                   ''')

    # 4. ОБНОВЛЕННАЯ ТАБЛИЦА ИНТЕРВАЛЬНОГО СЛОВАРЯ (МУЛЬТИЯЗЫЧНАЯ)
    cursor.execute('''
                   CREATE TABLE IF NOT EXISTS user_dictionary
                   (
                       id
                       INTEGER
                       PRIMARY
                       KEY
                       AUTOINCREMENT,
                       chat_id
                       INTEGER,
                       lang
                       TEXT
                       DEFAULT
                       'en',
                       word_foreign
                       TEXT,
                       word_ru
                       TEXT,
                       score
                       INTEGER
                       DEFAULT
                       0,
                       next_review
                       TEXT
                       DEFAULT (
                       DATE
                   (
                       'now',
                       'localtime'
                   )),
                       last_correct TEXT
                       )
                   ''')

    # --- МИГРАЦИИ (Подстраховка для старой базы данных) ---
    try:
        cursor.execute("ALTER TABLE user_settings ADD COLUMN words_per_day INTEGER DEFAULT 5")
    except sqlite3.OperationalError:
        pass

    try:
        cursor.execute("ALTER TABLE user_dictionary ADD COLUMN lang TEXT DEFAULT 'en'")
    except sqlite3.OperationalError:
        pass

    try:
        cursor.execute("ALTER TABLE user_dictionary RENAME COLUMN word_en TO word_foreign")
    except sqlite3.OperationalError:
        pass

    conn.commit()
    conn.close()


# --- ФУНКЦИИ ДЛЯ НАСТРОЕК ---

def get_user_config(chat_id):
    """Получает настройки пользователя. Если его нет в базе — создает дефолт"""
    conn = sqlite3.connect(DB_NAME, check_same_thread=False)
    cursor = conn.cursor()

    cursor.execute("SELECT difficulty, source_lang, words_per_day FROM user_settings WHERE chat_id = ?", (chat_id,))
    row = cursor.fetchone()

    if row:
        config = {"difficulty": row[0], "source_lang": row[1], "words_per_day": row[2]}
    else:
        cursor.execute("INSERT INTO user_settings (chat_id) VALUES (?)", (chat_id,))
        conn.commit()
        config = {"difficulty": "A1", "source_lang": "en", "words_per_day": 5}

    conn.close()
    return config


def update_user_setting(chat_id, key, value):
    """Обновляет конкретную настройку (difficulty, source_lang или words_per_day)"""
    conn = sqlite3.connect(DB_NAME, check_same_thread=False)
    cursor = conn.cursor()

    get_user_config(chat_id)

    if key in ["difficulty", "source_lang", "words_per_day"]:
        cursor.execute(f"UPDATE user_settings SET {key} = ? WHERE chat_id = ?", (value, chat_id))
        conn.commit()

    conn.close()


# --- ФУНКЦИИ ДЛЯ АКТИВНЫХ ЗАДАНИЙ (ACTIVE_TASKS) ---

def save_active_task(chat_id, phrase, rule):
    conn = sqlite3.connect(DB_NAME, check_same_thread=False)
    cursor = conn.cursor()
    cursor.execute('''
        INSERT OR REPLACE INTO active_tasks (chat_id, phrase, rule, help_count) 
        VALUES (?, ?, ?, 0)
    ''', (chat_id, phrase, rule))
    conn.commit()
    conn.close()


def get_active_task(chat_id):
    conn = sqlite3.connect(DB_NAME, check_same_thread=False)
    cursor = conn.cursor()
    cursor.execute("SELECT phrase, rule, help_count FROM active_tasks WHERE chat_id = ?", (chat_id,))
    row = cursor.fetchone()
    conn.close()

    if row:
        return {"phrase": row[0], "rule": row[1], "help_count": row[2]}
    return None


def increment_help_count(chat_id):
    conn = sqlite3.connect(DB_NAME, check_same_thread=False)
    cursor = conn.cursor()
    cursor.execute("UPDATE active_tasks SET help_count = help_count + 1 WHERE chat_id = ?", (chat_id,))
    conn.commit()
    conn.close()


def delete_active_task(chat_id):
    conn = sqlite3.connect(DB_NAME, check_same_thread=False)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM active_tasks WHERE chat_id = ?", (chat_id,))
    conn.commit()
    conn.close()


def add_to_history(chat_id, phrase):
    conn = sqlite3.connect(DB_NAME, check_same_thread=False)
    cursor = conn.cursor()
    cursor.execute("INSERT INTO task_history (chat_id, phrase) VALUES (?, ?)", (chat_id, phrase))
    conn.commit()
    conn.close()


def get_today_phrases_list(chat_id):
    conn = sqlite3.connect(DB_NAME, check_same_thread=False)
    cursor = conn.cursor()
    cursor.execute(
        "SELECT phrase FROM task_history WHERE chat_id = ? AND date = DATE('now', 'localtime')",
        (chat_id,)
    )
    rows = cursor.fetchall()
    conn.close()
    return [row[0].strip().lower() for row in rows] if rows else []


# --- ФУНКЦИИ ИНТЕРВАЛЬНОГО СЛОВАРЯ ---




def get_words_for_training(chat_id, limit_new=5):
    """Вытаскивает слова на повторение + новые с фильтрацией по текущему языку"""
    user_config = get_user_config(chat_id)
    current_lang = user_config.get("source_lang", "en")

    conn = sqlite3.connect(DB_NAME, check_same_thread=False)
    cursor = conn.cursor()

    # 1. Выбираем слова на повторение (next_review наступило)
    cursor.execute("""
                   SELECT id, word_foreign, word_ru, score
                   FROM user_dictionary
                   WHERE chat_id = ?
                     AND lang = ?
                     AND score > 0
                     AND next_review <= DATE ('now'
                       , 'localtime')
                   """, (chat_id, current_lang))
    repeat_words = cursor.fetchall()

    # 2. Добираем новые слова (score = 0)
    cursor.execute("""
                   SELECT id, word_foreign, word_ru, score
                   FROM user_dictionary
                   WHERE chat_id = ?
                     AND lang = ?
                     AND score = 0 LIMIT ?
                   """, (chat_id, current_lang, limit_new))
    new_words = cursor.fetchall()

    result = repeat_words + new_words

    # Подстраховка (если лимиты вышли — гоняем по кругу текущий язык)
    if not result:
        cursor.execute("""
                       SELECT id, word_foreign, word_ru, score
                       FROM user_dictionary
                       WHERE chat_id = ?
                         AND lang = ? LIMIT ?
                       """, (chat_id, current_lang, limit_new))
        result = cursor.fetchall()

    conn.close()
    return result


def update_word_progress(word_id, is_correct):
    """Логика Spaced Repetition (Animemo) для расчета интервалов дней"""
    intervals = {0: 1, 1: 3, 2: 7, 3: 30, 4: 90, 5: 180}

    conn = sqlite3.connect(DB_NAME, check_same_thread=False)
    cursor = conn.cursor()

    if is_correct:
        cursor.execute("SELECT score FROM user_dictionary WHERE id = ?", (word_id,))
        row = cursor.fetchone()
        current_score = row[0] if row else 0
        new_score = min(current_score + 1, 5)
        days = intervals.get(new_score, 30)

        cursor.execute("""
                       UPDATE user_dictionary
                       SET score       = ?,
                           next_review = DATE ('now', 'localtime', ?), last_correct = DATE ('now', 'localtime')
                       WHERE id = ?
                       """, (new_score, f"+{days} days", word_id))
    else:
        cursor.execute("""
                       UPDATE user_dictionary
                       SET score       = 1,
                           next_review = DATE ('now', 'localtime', '+1 day')
                       WHERE id = ?
                       """, (word_id,))

    conn.commit()
    conn.close()


def get_full_dictionary(chat_id, specific_lang=None):
    """Возвращает весь личный словарь пользователя по выбранному языку"""
    if specific_lang is None:
        user_config = get_user_config(chat_id)
        current_lang = user_config.get("source_lang", "en")
    else:
        current_lang = specific_lang

    conn = sqlite3.connect(DB_NAME, check_same_thread=False)
    cursor = conn.cursor()
    cursor.execute("SELECT word_foreign, word_ru, score FROM user_dictionary WHERE chat_id = ? AND lang = ?",
                   (chat_id, current_lang))
    rows = cursor.fetchall()
    conn.close()
    return rows


def add_custom_word(chat_id, word_foreign, word_ru, specific_lang=None):
    """Добавляет новое слово текущего или указанного языка, исключая дубликаты"""
    if specific_lang is None:
        user_config = get_user_config(chat_id)
        current_lang = user_config.get("source_lang", "en")
    else:
        current_lang = specific_lang

    conn = sqlite3.connect(DB_NAME, check_same_thread=False)
    cursor = conn.cursor()

    cursor.execute("""
                   SELECT COUNT(*)
                   FROM user_dictionary
                   WHERE chat_id = ?
                     AND lang = ?
                     AND LOWER(word_foreign) = LOWER(?)
                   """, (chat_id, current_lang, word_foreign.strip()))

    if cursor.fetchone()[0] == 0:
        cursor.execute("""
                       INSERT INTO user_dictionary (chat_id, lang, word_foreign, word_ru)
                       VALUES (?, ?, ?, ?)
                       """, (chat_id, current_lang, word_foreign.strip().lower(), word_ru.strip().lower()))
        conn.commit()
        saved = True
    else:
        saved = False

    conn.close()
    return saved


# database.py

def get_words_for_grammar_context(chat_id, limit=2):
    """
    Вытаскивает N слов активного языка.
    Ключ 'en' заменен на 'foreign' для универсальности (EN/GER).
    """
    user_config = get_user_config(chat_id)
    current_lang = user_config.get("source_lang", "en")

    conn = sqlite3.connect(DB_NAME, check_same_thread=False)
    cursor = conn.cursor()

    query = """
            SELECT word_foreign, word_ru
            FROM user_dictionary
            WHERE chat_id = ? \
              AND lang = ?
            ORDER BY score ASC, RANDOM() LIMIT ? \
            """
    cursor.execute(query, (chat_id, current_lang, limit))
    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    # 🔥 ИСПРАВЛЕНО: Ключ теперь называется 'foreign' вместо 'en'
    return [{"foreign": row[0], "ru": row[1]} for row in rows]