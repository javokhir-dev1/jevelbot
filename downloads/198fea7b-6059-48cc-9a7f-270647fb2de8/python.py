import asyncio
import logging
from aiogram import Bot, Dispatcher, types
from aiogram.filters import Command
from deep_translator import GoogleTranslator

TOKEN = "8371611013:AAEjLAuvuYCJtzfg3jcp_IVEhjQx0W5tGcg"

bot = Bot(token=TOKEN)
dp = Dispatcher()

@dp.message(Command("start"))
async def start_handler(message: types.Message):
    await message.answer(
        "Salom! Men tarjimon botman. \n\n"
        "Menga istalgan tilda matn yuboring, men uni **O'zbek tiliga** tarjima qilib beraman."
    )

@dp.message()
async def translate_text(message: types.Message):
    if not message.text:
        return

    try:
        # Avtomatik tilni aniqlab, o'zbek tiliga tarjima qilish
        translated = GoogleTranslator(source='auto', target='uz').translate(message.text)
        
        await message.reply(f"🇺🇿 **Tarjima:**\n\n{translated}", parse_mode="Markdown")
    except Exception as e:
        await message.reply("Kechirasiz, tarjima qilishda xatolik yuz berdi.")
        logging.error(f"Xatolik: {e}")

async def main():
    logging.basicConfig(level=logging.INFO)
    await dp.start_polling(bot)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("Bot to'xtatildi")