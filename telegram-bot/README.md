# Motion Control Telegram Bot

Telegram bot for generating Kling AI motion control videos via Magnific API.

## Features

- Send photo (reference character) + video (motion source) → auto-generate
- Select model: Kling 2.6 Standard/Pro, 3.0 Standard/Pro
- Adjustable CFG Scale
- Custom prompt
- Auto-polling until video is ready
- Direct video delivery to Telegram chat

## Requirements

- Python 3.10+
- Ubuntu server with a domain + SSL (nginx)
- Telegram Bot Token (from @BotFather)
- Magnific API Key (from magnific.com)

## Setup on Ubuntu Server

### 1. Install dependencies

```bash
sudo apt update
sudo apt install python3 python3-pip python3-venv nginx certbot python3-certbot-nginx
```

### 2. Clone and setup

```bash
cd /opt
git clone https://github.com/avegosam-three/motioncontrol.git
cd motioncontrol/telegram-bot

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install Python packages
pip install -r requirements.txt
```

### 3. Configure environment

```bash
cp .env.example .env
nano .env
```

Fill in:
- `TELEGRAM_BOT_TOKEN` — from @BotFather
- `MAGNIFIC_API_KEY` — from magnific.com
- `BASE_URL` — your domain (e.g., `https://yourdomain.com`)
- `UPLOAD_DIR` — path for uploads (e.g., `/var/www/uploads`)

### 4. Setup Nginx (serve uploaded files)

```bash
sudo nano /etc/nginx/sites-available/motioncontrol
```

Paste:
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # Serve uploaded files
    location /uploads/ {
        alias /var/www/uploads/;
        autoindex off;
    }
}
```

Enable and restart:
```bash
sudo ln -s /etc/nginx/sites-available/motioncontrol /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 5. Setup SSL (Let's Encrypt)

```bash
sudo certbot --nginx -d yourdomain.com
```

### 6. Create upload directory

```bash
sudo mkdir -p /var/www/uploads
sudo chown $USER:$USER /var/www/uploads
```

### 7. Run the bot (test)

```bash
cd /opt/motioncontrol/telegram-bot
source venv/bin/activate
python bot.py
```

### 8. Run as service (production)

Create systemd service:

```bash
sudo nano /etc/systemd/system/motioncontrol-bot.service
```

Paste:
```ini
[Unit]
Description=Motion Control Telegram Bot
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/motioncontrol/telegram-bot
ExecStart=/opt/motioncontrol/telegram-bot/venv/bin/python bot.py
Restart=always
RestartSec=10
Environment=PATH=/opt/motioncontrol/telegram-bot/venv/bin:/usr/bin

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable motioncontrol-bot
sudo systemctl start motioncontrol-bot

# Check status
sudo systemctl status motioncontrol-bot

# View logs
sudo journalctl -u motioncontrol-bot -f
```

## Usage

1. Open your bot in Telegram
2. Send `/start`
3. Send a **photo** (character reference)
4. Send a **video** (motion source)
5. Bot auto-generates and sends the result!

### Commands

| Command | Description |
|---------|-----------|
| `/start` | Welcome message |
| `/model` | Select Kling model |
| `/cfg 0.5` | Set CFG scale (0-1) |
| `/prompt text` | Set prompt |
| `/status` | Show current settings |
| `/generate` | Force generate (if image+video set) |
| `/reset` | Reset all settings |

## Troubleshooting

- **Bot not responding:** Check `sudo systemctl status motioncontrol-bot`
- **Upload fails:** Ensure nginx is serving `/uploads/` correctly
- **SSL issues:** Run `sudo certbot renew`
- **File too large:** Telegram has 20MB download limit for bot API. For larger files, the bot sends a download link instead.
