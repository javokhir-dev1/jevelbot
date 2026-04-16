import logging
import asyncio
from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import Command
from aiogram.utils.keyboard import InlineKeyboardBuilder

# Bot tokeningizni kiriting
TOKEN = "8659214450:AAHayJH61yeG1E7WUoMnZjcIf1sdDMM6tms"

logging.basicConfig(level=logging.INFO)
bot = Bot(token=TOKEN)
dp = Dispatcher()

# Kalkulyator tugmalarini shakllantirish
def get_keyboard(display="0"):
    builder = InlineKeyboardBuilder()
    
    buttons = [
        "7", "8", "9", "/",
        "4", "5", "6", "*",
        "1", "2", "3", "-",
        "0", ".", "=", "+"
    ]
    
    for btn in buttons:
        builder.button(text=btn, callback_data=f"calc_{btn}")
    
    builder.button(text="C", callback_data="calc_clear")
    builder.button(text="⌫", callback_data="calc_back")
    
    builder.adjust(4)
    return builder.as_markup()

@dp.message(Command("start"))
async def start_calc(message: types.Message):
    await message.answer("Kalkulyator:", reply_markup=get_keyboard())

@dp.callback_query(F.data.startswith("calc_"))
async def callbacks_num(callback: types.CallbackQuery):
    data = callback.data.split("_")[1]
    current_text = callback.message.text.replace("Kalkulyator:", "").strip()
    
    if current_text == "0" or current_text == "Error":
        current_text = ""

    if data == "=":
        try:
            # eval funksiyasi matematik ifodani hisoblaydi
            result = str(eval(current_text))
            new_text = f"{current_text} = {result}"
        except:
            new_text = "Error"
    
    elif data == "clear":
        new_text = "0"
        
    elif data == "back":
        new_text = current_text[:-1] if len(current_text) > 1 else "0"
        
    else:
        new_text = current_text + data

    # Faqat matn o'zgargandagina tahrirlash (Telegram xatolik bermasligi uchun)
    if new_text != current_text:
        try:
            await callback.message.edit_text(f"Kalkulyator: {new_text}", reply_markup=get_keyboard())
        except Exception:
            pass
            
    await callback.answer()

async def main():
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())