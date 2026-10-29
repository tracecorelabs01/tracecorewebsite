"""Settings for Tracer, the TraceCore Lab Discord bot. Secrets live in .env (copy .env.example)."""
import os

from dotenv import load_dotenv

load_dotenv()

# The bot's name in messages. Change it here, and set the same name in the Discord Developer Portal.
BOT_NAME = "Tracer"
BRAND = "TraceCore Lab"

BOT_TOKEN = os.getenv("BOT_TOKEN", "").strip()
# Uses data/bot_test.db instead of data/bot.db, for trying things out.
TEST_MODE = os.getenv("TEST_MODE", "false").lower() == "true"
# Discord user IDs with full access, comma-separated. Server administrators always have it.
ADMIN_IDS = [int(x) for x in os.getenv("ADMIN_IDS", "").replace(" ", "").split(",") if x]

# The website. Order lookups use its bot API with the same key as BOT_API_KEY on the website.
STORE_URL = os.getenv("STORE_URL", "https://tracecorelab.com").rstrip("/")
STORE_API_KEY = os.getenv("STORE_API_KEY", "").strip()

LOGO_URL = f"{STORE_URL}/brand/logo-mark.webp"
BANNER_URL = f"{STORE_URL}/brand/banner-gradient.webp"

# Brand colours, the same as the website.
COLOR_BRAND = 0xFF3D00
COLOR_EMBER = 0xFF1408
COLOR_AMBER = 0xFF9A3C
COLOR_SILVER = 0xD9DADC
COLOR_OK = 0x3EE08F
COLOR_WARN = 0xFFB020

# Rotating presence: (type, text). Types: playing, watching, listening, competing.
STATUS_MESSAGES = [
    ("watching", "tracecorelab.com"),
    ("playing", "Lab-tested DMA hardware"),
    ("listening", "your tickets"),
    ("watching", "orders ship worldwide"),
    ("playing", "/track to follow your order"),
    ("watching", "DMA cards, fusers and Ferrum"),
]
