import os
import asyncio
import logging
from aiogram import Bot, Dispatcher, types
from aiogram.filters import Command
from yt_dlp import YoutubeDL

# Bot tokeningizni kiriting
TOKEN = "8246224254:AAGs6ELVgAfn5-4iDM3km7ye5JEZB0clQcQ"

logging.basicConfig(level=logging.INFO)

bot = Bot(token=TOKEN)
dp = Dispatcher()

# Video yuklab olish funksiyasi
def download_video(url):
    ydl_opts = {
        'format': 'best[ext=mp4]/best', # Eng yaxshi sifatli mp4 format
        'outtmpl': 'downloads/%(title)s.%(ext)s', # Yuklash manzili
        'noplaylist': True,
    }
    with YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=True)
        return ydl.prepare_filename(info)

@dp.message(Command("start"))
async def cmd_start(message: types.Message):
    await message.answer("Assalomu alaykum! Menga YouTube video linkini yuboring, men uni yuklab beraman.")

@dp.message()
async def handle_message(message: types.Message):
    url = message.text
    
    if "youtube.com" in url or "youtu.be" in url:
        msg = await message.answer("Video yuklab olinmoqda, iltimos kuting...")
        
        try:
            # Yuklab olishni alohida thread'da ishga tushiramiz (asinxronlikni buzmaslik uchun)
            loop = asyncio.get_event_loop()
            file_path = await loop.run_in_executor(None, download_video, url)
            
            # Videoni yuborish
            video_file = types.FSInputFile(file_path)
            await message.answer_video(video=video_file, caption="Video tayyor!")
            
            # Serverdan faylni o'chirib tashlash
            os.remove(file_path)
            await msg.delete()
            
        except Exception as e:
            await message.answer(f"Xatolik yuz berdi: {str(e)}")
            if os.path.exists(file_path):
                os.remove(file_path)
    else:
        await message.answer("Iltimos, haqiqiy YouTube linkini yuboring.")

async def main():
    if not os.path.exists('downloads'):
        os.makedirs('downloads')
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())