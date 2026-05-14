"""Telegram Bot for Kling Motion Control video generation."""

import os
import uuid
import asyncio
import logging
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, BotCommand
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


async def post_init(application):
    """Set bot commands menu after startup."""
    commands = [
        BotCommand("start", "Mulai & panduan penggunaan"),
        BotCommand("model", "Pilih model Kling AI"),
        BotCommand("cfg", "Atur CFG Scale (0-1)"),
        BotCommand("prompt", "Atur prompt deskripsi"),
        BotCommand("status", "Lihat pengaturan saat ini"),
        BotCommand("generate", "Generate video sekarang"),
        BotCommand("reset", "Reset semua pengaturan"),
    ]
    await application.bot.set_my_commands(commands)


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /start command."""
    session = get_user_data(context)
    model_name = next((name for mid, name in MODELS_LIST if mid == session["model"]), session["model"])

    keyboard = [
        [InlineKeyboardButton("Pilih Model", callback_data="menu:model"),
         InlineKeyboardButton("Pengaturan", callback_data="menu:status")],
        [InlineKeyboardButton("Reset", callback_data="menu:reset")],
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)

    await update.message.reply_text(
        "━━━━━━━━━━━━━━━━━━━━━\n"
        "🎬  *MOTION CONTROL BOT*\n"
        "━━━━━━━━━━━━━━━━━━━━━\n\n"
        "Transfer gerakan dari video ke karakter!\n\n"
        "📌 *Cara Pakai:*\n"
        "┣ 1️⃣ Kirim *foto* (karakter referensi)\n"
        "┣ 2️⃣ Kirim *video* (sumber gerakan)\n"
        "┗ 3️⃣ Tunggu hasilnya!\n\n"
        "⚙️ *Pengaturan Saat Ini:*\n"
        f"┣ Model: `{model_name}`\n"
        f"┣ CFG Scale: `{session['cfg_scale']}`\n"
        f"┗ Prompt: _{session['prompt'] or 'kosong'}_\n\n"
        "━━━━━━━━━━━━━━━━━━━━━",
        parse_mode="Markdown",
        reply_markup=reply_markup,
    )


async def model_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /model command — show model selection keyboard."""
    session = get_user_data(context)
    current = session["model"]

    keyboard = []
    for model_id, model_name in MODELS_LIST:
        check = " ✓" if model_id == current else ""
        keyboard.append([InlineKeyboardButton(f"{model_name}{check}", callback_data=f"model:{model_id}")])

    reply_markup = InlineKeyboardMarkup(keyboard)
    await update.message.reply_text(
        "━━━━━━━━━━━━━━━━━━━━━\n"
        "🤖  *PILIH MODEL*\n"
        "━━━━━━━━━━━━━━━━━━━━━\n\n"
        "Pilih model Kling AI yang ingin digunakan:",
        parse_mode="Markdown",
        reply_markup=reply_markup,
    )


async def model_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle model selection callback."""
    query = update.callback_query
    await query.answer()

    model_id = query.data.replace("model:", "")
    session = get_user_data(context)
    session["model"] = model_id

    model_name = next((name for mid, name in MODELS_LIST if mid == model_id), model_id)
    await query.edit_message_text(
        f"✅ Model dipilih: *{model_name}*\n\n"
        f"Kirim foto & video untuk mulai generate!",
        parse_mode="Markdown",
    )


async def menu_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle menu button callbacks."""
    query = update.callback_query
    await query.answer()
    action = query.data.replace("menu:", "")

    if action == "model":
        session = get_user_data(context)
        current = session["model"]
        keyboard = []
        for model_id, model_name in MODELS_LIST:
            check = " ✓" if model_id == current else ""
            keyboard.append([InlineKeyboardButton(f"{model_name}{check}", callback_data=f"model:{model_id}")])
        reply_markup = InlineKeyboardMarkup(keyboard)
        await query.edit_message_text(
            "━━━━━━━━━━━━━━━━━━━━━\n"
            "🤖  *PILIH MODEL*\n"
            "━━━━━━━━━━━━━━━━━━━━━\n\n"
            "Pilih model Kling AI:",
            parse_mode="Markdown",
            reply_markup=reply_markup,
        )

    elif action == "status":
        session = get_user_data(context)
        model_name = next((name for mid, name in MODELS_LIST if mid == session["model"]), session["model"])
        await query.edit_message_text(
            "━━━━━━━━━━━━━━━━━━━━━\n"
            "⚙️  *PENGATURAN*\n"
            "━━━━━━━━━━━━━━━━━━━━━\n\n"
            f"┣ 🤖 Model: *{model_name}*\n"
            f"┣ 🎚️ CFG Scale: `{session['cfg_scale']}`\n"
            f"┣ 💬 Prompt: _{session['prompt'] or 'kosong'}_\n"
            f"┣ 🖼️ Image: {'✅ Ready' if session['image_url'] else '⬜ Belum'}\n"
            f"┗ 🎥 Video: {'✅ Ready' if session['video_url'] else '⬜ Belum'}\n",
            parse_mode="Markdown",
        )

    elif action == "reset":
        context.user_data["session"] = {
            "model": "kling-2.6-standard",
            "cfg_scale": 0.5,
            "prompt": "",
            "image_url": None,
            "video_url": None,
        }
        await query.edit_message_text("🔄 Semua pengaturan di-reset ke default!")


async def cfg_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /cfg command."""
    session = get_user_data(context)

    if context.args and len(context.args) > 0:
        try:
            value = float(context.args[0])
            if 0 <= value <= 1:
                session["cfg_scale"] = value
                await update.message.reply_text(f"✅ CFG Scale: `{value}`", parse_mode="Markdown")
            else:
                await update.message.reply_text("❌ CFG Scale harus antara 0 dan 1")
        except ValueError:
            await update.message.reply_text("❌ Format salah. Contoh: `/cfg 0.5`", parse_mode="Markdown")
    else:
        await update.message.reply_text(
            f"🎚️ CFG Scale saat ini: `{session['cfg_scale']}`\n\n"
            f"Cara ubah: `/cfg 0.5`\n"
            f"• 0 = lebih kreatif\n"
            f"• 1 = lebih faithful",
            parse_mode="Markdown",
        )


async def prompt_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /prompt command."""
    session = get_user_data(context)

    if context.args and len(context.args) > 0:
        prompt_text = " ".join(context.args)
        session["prompt"] = prompt_text
        await update.message.reply_text(f"✅ Prompt:\n_{prompt_text}_", parse_mode="Markdown")
    else:
        current = session["prompt"] or "(kosong)"
        await update.message.reply_text(
            f"💬 Prompt saat ini: _{current}_\n\n"
            f"Cara ubah: `/prompt dancing in the rain`",
            parse_mode="Markdown",
        )


async def status_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /status command."""
    session = get_user_data(context)
    model_name = next((name for mid, name in MODELS_LIST if mid == session["model"]), session["model"])

    await update.message.reply_text(
        "━━━━━━━━━━━━━━━━━━━━━\n"
        "⚙️  *PENGATURAN*\n"
        "━━━━━━━━━━━━━━━━━━━━━\n\n"
        f"┣ 🤖 Model: *{model_name}*\n"
        f"┣ 🎚️ CFG Scale: `{session['cfg_scale']}`\n"
        f"┣ 💬 Prompt: _{session['prompt'] or 'kosong'}_\n"
        f"┣ 🖼️ Image: {'✅ Ready' if session['image_url'] else '⬜ Belum'}\n"
        f"┗ 🎥 Video: {'✅ Ready' if session['video_url'] else '⬜ Belum'}\n",
        parse_mode="Markdown",
    )


async def reset_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /reset command."""
    context.user_data["session"] = {
        "model": "kling-2.6-standard",
        "cfg_scale": 0.5,
        "prompt": "",
        "image_url": None,
        "video_url": None,
    }
    await update.message.reply_text("🔄 Semua pengaturan di-reset ke default!")


async def save_file(file_obj, extension: str) -> str:
    """Download and save a file, return the public URL."""
    filename = f"{uuid.uuid4().hex}.{extension}"
    filepath = os.path.join(UPLOAD_DIR, filename)
    await file_obj.download_to_drive(filepath)
    public_url = f"{BASE_URL}{UPLOAD_URL_PATH}/{filename}"
    return public_url


async def handle_photo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle photo messages — save as reference image, delete original."""
    session = get_user_data(context)

    msg = await update.message.reply_text("📷 Mengupload gambar...")

    try:
        photo = update.message.photo[-1]
        file = await photo.get_file()
        url = await save_file(file, "jpg")
        session["image_url"] = url

        # Delete the user's photo message to keep chat clean
        try:
            await update.message.delete()
        except Exception:
            pass

        if session["image_url"] and session["video_url"]:
            await msg.edit_text(
                "✅ *Gambar diterima!*\n\n"
                "🖼️ Image: ✅\n"
                "🎥 Video: ✅\n\n"
                "🎬 Memulai generate...",
                parse_mode="Markdown",
            )
            await do_generate(update, context, msg)
        else:
            await msg.edit_text(
                "✅ *Gambar diterima!*\n\n"
                "🖼️ Image: ✅\n"
                "🎥 Video: ⬜ *Kirim video untuk melanjutkan*",
                parse_mode="Markdown",
            )

    except Exception as e:
        await msg.edit_text(f"❌ Gagal upload gambar: {e}")


async def handle_video(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle video/animation messages — save as motion source, delete original."""
    session = get_user_data(context)

    msg = await update.message.reply_text("🎥 Mengupload video...")

    try:
        video = update.message.video or update.message.animation
        if not video:
            await msg.edit_text("❌ Video tidak terdeteksi.")
            return

        file = await video.get_file()
        url = await save_file(file, "mp4")
        session["video_url"] = url

        # Delete the user's video message to keep chat clean
        try:
            await update.message.delete()
        except Exception:
            pass

        if session["image_url"] and session["video_url"]:
            await msg.edit_text(
                "✅ *Video diterima!*\n\n"
                "🖼️ Image: ✅\n"
                "🎥 Video: ✅\n\n"
                "🎬 Memulai generate...",
                parse_mode="Markdown",
            )
            await do_generate(update, context, msg)
        else:
            await msg.edit_text(
                "✅ *Video diterima!*\n\n"
                "🖼️ Image: ⬜ *Kirim foto untuk melanjutkan*\n"
                "🎥 Video: ✅",
                parse_mode="Markdown",
            )

    except Exception as e:
        await msg.edit_text(f"❌ Gagal upload video: {e}")


async def generate_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /generate command."""
    session = get_user_data(context)

    if not session["image_url"]:
        await update.message.reply_text("❌ Belum ada gambar. Kirim foto dulu.")
        return
    if not session["video_url"]:
        await update.message.reply_text("❌ Belum ada video. Kirim video dulu.")
        return

    msg = await update.message.reply_text("🎬 Memulai generate...")
    await do_generate(update, context, msg)


async def do_generate(update: Update, context: ContextTypes.DEFAULT_TYPE, msg=None):
    """Execute the video generation process."""
    session = get_user_data(context)
    model_name = next((name for mid, name in MODELS_LIST if mid == session["model"]), session["model"])

    if not msg:
        msg = await update.effective_message.reply_text("🎬 Memulai generate...")

    await msg.edit_text(
        "━━━━━━━━━━━━━━━━━━━━━\n"
        "🎬  *GENERATING VIDEO*\n"
        "━━━━━━━━━━━━━━━━━━━━━\n\n"
        f"┣ 🤖 Model: *{model_name}*\n"
        f"┣ 🎚️ CFG: `{session['cfg_scale']}`\n"
        f"┗ 💬 Prompt: _{session['prompt'] or 'kosong'}_\n\n"
        "⏳ Estimasi 1-5 menit...\n"
        "━━━━━━━━━━━━━━━━━━━━━",
        parse_mode="Markdown",
    )

    last_status = [""]

    async def on_status(status: str):
        if status != last_status[0]:
            last_status[0] = status
            status_emoji = "🔄" if status == "processing" else "⏳"
            try:
                await msg.edit_text(
                    "━━━━━━━━━━━━━━━━━━━━━\n"
                    "🎬  *GENERATING VIDEO*\n"
                    "━━━━━━━━━━━━━━━━━━━━━\n\n"
                    f"{status_emoji} Status: `{status}`\n\n"
                    "⏳ Mohon tunggu...\n"
                    "━━━━━━━━━━━━━━━━━━━━━",
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
        await msg.edit_text(
            "━━━━━━━━━━━━━━━━━━━━━\n"
            "❌  *GENERATION GAGAL*\n"
            "━━━━━━━━━━━━━━━━━━━━━\n\n"
            f"`{result['error']}`\n\n"
            "Coba lagi dengan /generate",
            parse_mode="Markdown",
        )
        return

    video_url = result["video_url"]

    # Delete the status message
    try:
        await msg.delete()
    except Exception:
        pass

    # Send video to user
    try:
        await update.effective_message.reply_video(
            video=video_url,
            caption=(
                "━━━━━━━━━━━━━━━━━━━━━\n"
                "✅ *VIDEO BERHASIL!*\n"
                "━━━━━━━━━━━━━━━━━━━━━\n\n"
                f"🤖 Model: {model_name}\n"
                f"🎚️ CFG: {session['cfg_scale']}\n\n"
                "Kirim foto + video baru untuk generate lagi!"
            ),
            parse_mode="Markdown",
        )
    except Exception:
        await update.effective_message.reply_text(
            "━━━━━━━━━━━━━━━━━━━━━\n"
            "✅ *VIDEO BERHASIL!*\n"
            "━━━━━━━━━━━━━━━━━━━━━\n\n"
            f"🤖 Model: {model_name}\n\n"
            f"🔗 [Download Video]({video_url})\n\n"
            "Kirim foto + video baru untuk generate lagi!",
            parse_mode="Markdown",
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
        session = get_user_data(context)
        msg = await update.message.reply_text("📷 Mengupload gambar...")
        try:
            file = await doc.get_file()
            ext = mime.split("/")[-1] if "/" in mime else "jpg"
            url = await save_file(file, ext)
            session["image_url"] = url
            try:
                await update.message.delete()
            except Exception:
                pass
            if session["image_url"] and session["video_url"]:
                await msg.edit_text("✅ *Gambar diterima!*\n\n🎬 Memulai generate...", parse_mode="Markdown")
                await do_generate(update, context, msg)
            else:
                await msg.edit_text("✅ *Gambar diterima!*\n\n🎥 Kirim video untuk melanjutkan.", parse_mode="Markdown")
        except Exception as e:
            await msg.edit_text(f"❌ Gagal: {e}")

    elif mime.startswith("video/"):
        session = get_user_data(context)
        msg = await update.message.reply_text("🎥 Mengupload video...")
        try:
            file = await doc.get_file()
            ext = mime.split("/")[-1] if "/" in mime else "mp4"
            url = await save_file(file, ext)
            session["video_url"] = url
            try:
                await update.message.delete()
            except Exception:
                pass
            if session["image_url"] and session["video_url"]:
                await msg.edit_text("✅ *Video diterima!*\n\n🎬 Memulai generate...", parse_mode="Markdown")
                await do_generate(update, context, msg)
            else:
                await msg.edit_text("✅ *Video diterima!*\n\n🖼️ Kirim foto untuk melanjutkan.", parse_mode="Markdown")
        except Exception as e:
            await msg.edit_text(f"❌ Gagal: {e}")


def main():
    """Start the bot."""
    if not TELEGRAM_BOT_TOKEN:
        print("ERROR: TELEGRAM_BOT_TOKEN not set in .env")
        return

    app = Application.builder().token(TELEGRAM_BOT_TOKEN).post_init(post_init).build()

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
    app.add_handler(CallbackQueryHandler(menu_callback, pattern=r"^menu:"))

    # Message handlers
    app.add_handler(MessageHandler(filters.PHOTO, handle_photo))
    app.add_handler(MessageHandler(filters.VIDEO | filters.ANIMATION, handle_video))
    app.add_handler(MessageHandler(filters.Document.ALL, handle_document))

    print("🤖 Bot started! Press Ctrl+C to stop.")
    app.run_polling(drop_pending_updates=True)


if __name__ == "__main__":
    main()
