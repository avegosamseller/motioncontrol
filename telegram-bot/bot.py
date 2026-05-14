"""Telegram Bot for Kling Motion Control video generation."""

import os
import uuid
import logging
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    Application,
    CommandHandler,
    MessageHandler,
    CallbackQueryHandler,
    ContextTypes,
    filters,
)

from config import (
    TELEGRAM_BOT_TOKEN,
    BASE_URL,
    UPLOAD_DIR,
    UPLOAD_URL_PATH,
    MODELS_LIST,
)
from magnific import generate_and_wait

# Logging
logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)

# Ensure upload directory exists
os.makedirs(UPLOAD_DIR, exist_ok=True)


def get_user_data(context: ContextTypes.DEFAULT_TYPE) -> dict:
    """Get or initialize user session data."""
    if "session" not in context.user_data:
        context.user_data["session"] = {
            "model": "kling-2.6-standard",
            "cfg_scale": 0.5,
            "prompt": "",
            "image_url": None,
            "video_url": None,
        }
    return context.user_data["session"]


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /start command."""
    session = get_user_data(context)
    await update.message.reply_text(
        "🎬 *Motion Control Bot*\n\n"
        "Generate motion control videos using Kling AI.\n\n"
        "*How to use:*\n"
        "1. Send a *photo* (reference character)\n"
        "2. Send a *video* (motion source)\n"
        "3. Bot will generate the motion control video!\n\n"
        "*Commands:*\n"
        "/model — Select model\n"
        "/cfg `0.5` — Set CFG scale (0-1)\n"
        "/prompt `text` — Set prompt\n"
        "/status — Show current settings\n"
        "/generate — Generate video (if image & video already set)\n"
        "/reset — Reset all settings\n\n"
        f"*Current model:* `{session['model']}`\n"
        f"*CFG Scale:* `{session['cfg_scale']}`",
        parse_mode="Markdown",
    )


async def model_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /model command — show model selection keyboard."""
    keyboard = []
    for model_id, model_name in MODELS_LIST:
        keyboard.append([InlineKeyboardButton(model_name, callback_data=f"model:{model_id}")])

    reply_markup = InlineKeyboardMarkup(keyboard)
    await update.message.reply_text("🤖 Select a model:", reply_markup=reply_markup)


async def model_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle model selection callback."""
    query = update.callback_query
    await query.answer()

    model_id = query.data.replace("model:", "")
    session = get_user_data(context)
    session["model"] = model_id

    model_name = next((name for mid, name in MODELS_LIST if mid == model_id), model_id)
    await query.edit_message_text(f"✅ Model set to: *{model_name}*", parse_mode="Markdown")


async def cfg_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /cfg command."""
    session = get_user_data(context)

    if context.args and len(context.args) > 0:
        try:
            value = float(context.args[0])
            if 0 <= value <= 1:
                session["cfg_scale"] = value
                await update.message.reply_text(f"✅ CFG Scale set to: `{value}`", parse_mode="Markdown")
            else:
                await update.message.reply_text("❌ CFG Scale must be between 0 and 1")
        except ValueError:
            await update.message.reply_text("❌ Invalid number. Usage: `/cfg 0.5`", parse_mode="Markdown")
    else:
        await update.message.reply_text(
            f"Current CFG Scale: `{session['cfg_scale']}`\n\nUsage: `/cfg 0.5`",
            parse_mode="Markdown",
        )


async def prompt_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /prompt command."""
    session = get_user_data(context)

    if context.args and len(context.args) > 0:
        prompt_text = " ".join(context.args)
        session["prompt"] = prompt_text
        await update.message.reply_text(f"✅ Prompt set to:\n_{prompt_text}_", parse_mode="Markdown")
    else:
        current = session["prompt"] or "(empty)"
        await update.message.reply_text(
            f"Current prompt: _{current}_\n\nUsage: `/prompt dancing in the rain`",
            parse_mode="Markdown",
        )


async def status_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /status command — show current settings."""
    session = get_user_data(context)
    model_name = next((name for mid, name in MODELS_LIST if mid == session["model"]), session["model"])

    text = (
        "📋 *Current Settings*\n\n"
        f"*Model:* {model_name}\n"
        f"*CFG Scale:* `{session['cfg_scale']}`\n"
        f"*Prompt:* _{session['prompt'] or '(none)'}_\n"
        f"*Image:* {'✅ Set' if session['image_url'] else '❌ Not set'}\n"
        f"*Video:* {'✅ Set' if session['video_url'] else '❌ Not set'}\n"
    )
    await update.message.reply_text(text, parse_mode="Markdown")


async def reset_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /reset command."""
    context.user_data["session"] = {
        "model": "kling-2.6-standard",
        "cfg_scale": 0.5,
        "prompt": "",
        "image_url": None,
        "video_url": None,
    }
    await update.message.reply_text("🔄 All settings reset to default.")


async def save_file(file_obj, extension: str) -> str:
    """Download and save a file, return the public URL."""
    filename = f"{uuid.uuid4().hex}.{extension}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    await file_obj.download_to_drive(filepath)

    # Return public URL
    public_url = f"{BASE_URL}{UPLOAD_URL_PATH}/{filename}"
    return public_url


async def handle_photo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle photo messages — save as reference image."""
    session = get_user_data(context)

    msg = await update.message.reply_text("📷 Uploading image...")

    try:
        photo = update.message.photo[-1]  # highest resolution
        file = await photo.get_file()
        url = await save_file(file, "jpg")

        session["image_url"] = url
        await msg.edit_text(
            f"✅ *Reference image set!*\n\n"
            f"{'Now send a *video* for motion source.' if not session['video_url'] else 'Both image and video ready! Use /generate to start.'}\n",
            parse_mode="Markdown",
        )

        # Auto-generate if both are set
        if session["image_url"] and session["video_url"]:
            await msg.edit_text("✅ *Reference image set!*\n\n🎬 Both files ready! Generating video...", parse_mode="Markdown")
            await do_generate(update, context)

    except Exception as e:
        await msg.edit_text(f"❌ Failed to upload image: {e}")


async def handle_video(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle video/animation messages — save as motion source."""
    session = get_user_data(context)

    msg = await update.message.reply_text("🎥 Uploading video...")

    try:
        video = update.message.video or update.message.animation
        if not video:
            await msg.edit_text("❌ No video detected. Please send a video file.")
            return

        file = await video.get_file()
        ext = "mp4"
        url = await save_file(file, ext)

        session["video_url"] = url
        await msg.edit_text(
            f"✅ *Motion video set!*\n\n"
            f"{'Now send a *photo* for reference character.' if not session['image_url'] else 'Both image and video ready! Use /generate to start.'}\n",
            parse_mode="Markdown",
        )

        # Auto-generate if both are set
        if session["image_url"] and session["video_url"]:
            await msg.edit_text("✅ *Motion video set!*\n\n🎬 Both files ready! Generating video...", parse_mode="Markdown")
            await do_generate(update, context)

    except Exception as e:
        await msg.edit_text(f"❌ Failed to upload video: {e}")


async def generate_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /generate command."""
    session = get_user_data(context)

    if not session["image_url"]:
        await update.message.reply_text("❌ No reference image set. Send a photo first.")
        return
    if not session["video_url"]:
        await update.message.reply_text("❌ No motion video set. Send a video first.")
        return

    await do_generate(update, context)


async def do_generate(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Execute the video generation process."""
    session = get_user_data(context)

    model_name = next((name for mid, name in MODELS_LIST if mid == session["model"]), session["model"])

    msg = await update.effective_message.reply_text(
        f"🎬 *Generating video...*\n\n"
        f"*Model:* {model_name}\n"
        f"*CFG:* {session['cfg_scale']}\n"
        f"*Prompt:* _{session['prompt'] or '(none)'}_\n\n"
        f"⏳ This may take 1-5 minutes...",
        parse_mode="Markdown",
    )

    last_status = [""]

    async def on_status(status: str):
        if status != last_status[0]:
            last_status[0] = status
            try:
                await msg.edit_text(
                    f"🎬 *Generating video...*\n\n"
                    f"*Status:* `{status}`\n"
                    f"⏳ Please wait...",
                    parse_mode="Markdown",
                )
            except Exception:
                pass

    result = await generate_and_wait(
        model=session["model"],
        image_url=session["image_url"],
        video_url=session["video_url"],
        prompt=session["prompt"],
        cfg_scale=session["cfg_scale"],
        on_status=on_status,
    )

    if "error" in result:
        await msg.edit_text(f"❌ *Generation failed:*\n\n`{result['error']}`", parse_mode="Markdown")
        return

    video_url = result["video_url"]

    await msg.edit_text(
        f"✅ *Video generated successfully!*\n\n"
        f"🔗 [Download Video]({video_url})\n\n"
        f"Sending video...",
        parse_mode="Markdown",
    )

    # Send video to user
    try:
        await update.effective_message.reply_video(
            video=video_url,
            caption=f"🎬 Motion Control Video\nModel: {model_name}",
        )
    except Exception:
        # If sending as video fails, send as link
        await update.effective_message.reply_text(
            f"🎬 Video ready!\n\n🔗 {video_url}",
        )

    # Reset image and video for next generation
    session["image_url"] = None
    session["video_url"] = None


async def handle_document(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle document uploads (for videos sent as files)."""
    doc = update.message.document
    if not doc:
        return

    mime = doc.mime_type or ""

    if mime.startswith("image/"):
        # Treat as image
        session = get_user_data(context)
        msg = await update.message.reply_text("📷 Uploading image...")
        try:
            file = await doc.get_file()
            ext = mime.split("/")[-1] if "/" in mime else "jpg"
            url = await save_file(file, ext)
            session["image_url"] = url
            await msg.edit_text("✅ *Reference image set!*", parse_mode="Markdown")
            if session["image_url"] and session["video_url"]:
                await do_generate(update, context)
        except Exception as e:
            await msg.edit_text(f"❌ Failed: {e}")

    elif mime.startswith("video/"):
        # Treat as video
        session = get_user_data(context)
        msg = await update.message.reply_text("🎥 Uploading video...")
        try:
            file = await doc.get_file()
            ext = mime.split("/")[-1] if "/" in mime else "mp4"
            url = await save_file(file, ext)
            session["video_url"] = url
            await msg.edit_text("✅ *Motion video set!*", parse_mode="Markdown")
            if session["image_url"] and session["video_url"]:
                await do_generate(update, context)
        except Exception as e:
            await msg.edit_text(f"❌ Failed: {e}")


def main():
    """Start the bot."""
    if not TELEGRAM_BOT_TOKEN:
        print("ERROR: TELEGRAM_BOT_TOKEN not set in .env")
        return

    app = Application.builder().token(TELEGRAM_BOT_TOKEN).build()

    # Commands
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("model", model_command))
    app.add_handler(CommandHandler("cfg", cfg_command))
    app.add_handler(CommandHandler("prompt", prompt_command))
    app.add_handler(CommandHandler("status", status_command))
    app.add_handler(CommandHandler("reset", reset_command))
    app.add_handler(CommandHandler("generate", generate_command))

    # Callbacks
    app.add_handler(CallbackQueryHandler(model_callback, pattern=r"^model:"))

    # Message handlers
    app.add_handler(MessageHandler(filters.PHOTO, handle_photo))
    app.add_handler(MessageHandler(filters.VIDEO | filters.ANIMATION, handle_video))
    app.add_handler(MessageHandler(filters.Document.ALL, handle_document))

    print("🤖 Bot started! Press Ctrl+C to stop.")
    app.run_polling(drop_pending_updates=True)


if __name__ == "__main__":
    main()
