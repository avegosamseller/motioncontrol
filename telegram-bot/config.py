import os
from dotenv import load_dotenv

load_dotenv()

# Telegram
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")

# Magnific API
MAGNIFIC_API_KEY = os.getenv("MAGNIFIC_API_KEY", "")

# Server / Domain
BASE_URL = os.getenv("BASE_URL", "https://yourdomain.com")
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "/var/www/uploads")
UPLOAD_URL_PATH = os.getenv("UPLOAD_URL_PATH", "/uploads")

# Model endpoints for generation
MODEL_ENDPOINTS = {
    "kling-2.6-standard": "https://api.magnific.com/v1/ai/video/kling-v2-6-motion-control-std",
    "kling-2.6-pro": "https://api.magnific.com/v1/ai/video/kling-v2-6-motion-control-pro",
    "kling-3.0-standard": "https://api.magnific.com/v1/ai/video/kling-v3-motion-control-std",
    "kling-3.0-pro": "https://api.magnific.com/v1/ai/video/kling-v3-motion-control-pro",
}

# Status check endpoints
MODEL_STATUS_ENDPOINTS = {
    "kling-2.6-standard": "https://api.magnific.com/v1/ai/image-to-video/kling-v2-6",
    "kling-2.6-pro": "https://api.magnific.com/v1/ai/image-to-video/kling-v2-6",
    "kling-3.0-standard": "https://api.magnific.com/v1/ai/video/kling-v3-motion-control-std",
    "kling-3.0-pro": "https://api.magnific.com/v1/ai/video/kling-v3-motion-control-pro",
}

# Available models for display
MODELS_LIST = [
    ("kling-2.6-standard", "Kling 2.6 Standard"),
    ("kling-2.6-pro", "Kling 2.6 Pro"),
    ("kling-3.0-standard", "Kling 3.0 Standard"),
    ("kling-3.0-pro", "Kling 3.0 Pro"),
]

# Polling settings
POLL_INTERVAL = 5  # seconds
POLL_TIMEOUT = 600  # max 10 minutes
