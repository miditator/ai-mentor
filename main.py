import telebot

import config
from loader import bot
import handlers
import database
import config
import handlers.buttons
import handlers.words
import handlers.intensity







if __name__ == "__main__":
    database.init_db()  # 🔥 Создаем таблицы при старте
    bot.add_custom_filter(telebot.custom_filters.StateFilter(bot))
    print("🚀 Архитектурный ИИ-Ментор успешно запущен на ПК!")
    bot.infinity_polling()