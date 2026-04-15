import os
import asyncio
import logging
from aiogram import Bot, Dispatcher, types
from aiogram.filters import Command
from yt_dlp import YoutubeDL

# Bot tokeningizni kiriting
TOKEN = "YOUR_BOT_TOKEN"

logging.basicConfig(level=logging.INFO)

bot = Bot(token=TOKEN)
dp = Dispatcher()

# Video yuklab olish funksiyasi
def download_video(url):
    ydl_opts = {
        'format': 'best[filesize<50M][ext=mp4]/best',  # 50MB dan kichik mp4
        'outtmpl': 'downloads/%(id)s.%(ext)s',         # xavfsiz filename
        'noplaylist': True,
        'quiet': True,
    }
    with YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=True)
        return ydl.prepare_filename(info)

@dp.message(Command("start"))
async def cmd_start(message: types.Message):
    await message.answer(
        "Assalomu alaykum!\n\n"
        "Menga YouTube video linkini yuboring, men uni yuklab beraman 🎬"
    )

@dp.message()
async def handle_message(message: types.Message):
    url = message.text or ""

    if "youtube.com" in url or "youtu.be" in url:
        msg = await message.answer("⏳ Video yuklab olinmoqda, iltimos kuting...")

        file_path = None

        try:
            loop = asyncio.get_running_loop()
            file_path = await loop.run_in_executor(None, download_video, url)

            video_file = types.FSInputFile(file_path)

            await message.answer_video(
                video=video_file,
                caption="✅ Video tayyor!"
            )

            # Faylni o‘chirish
            if os.path.exists(file_path):
                os.remove(file_path)

            await msg.delete()

        except Exception as e:
            await message.answer(f"❌ Xatolik yuz berdi:\n{str(e)}")

            if file_path and os.path.exists(file_path):
                os.remove(file_path)
    else:
        await message.answer("❗ Iltimos, haqiqiy YouTube linkini yuboring.")

async def main():
    # downloads papkasini yaratish
    if not os.path.exists('downloads'):
        os.makedirs('downloads')

    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())