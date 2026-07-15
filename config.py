from dotenv import load_dotenv
import os

load_dotenv()
GEMINI_KEY = os.getenv("GOOGLE_API_KEY")
GROQ_KEY = os.getenv("GROQ_API_KEY")
#MODEL = 'gemini-2.5-flash'
MODEL = "llama-3.3-70b-versatile"
TOKEN = os.getenv("TOKEN")
TASK_INTERVAL = 7200



