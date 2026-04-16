import asyncio
from aiogram import Bot, Dispatcher, types

API_TOKEN = '8659214450:AAHayJH61yeG1E7WUoMnZjcIf1sdDMM6tms'

bot = Bot(token=API_TOKEN)
dp = Dispatcher()

@dp.message(lambda message: message.text == "/start")
async def start_cmd(message: types.Message):
    await message.answer("Hello world")

@dp.message()
async def echo(message: types.Message):
    await message.answer(message.text)

async def main():
    await dp.start_polling(bot)

if __name__ == '__main__':
    asyncio.run(main())