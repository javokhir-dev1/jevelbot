from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import Command
from aiogram.types import FSInputFile
import asyncio
bot = Bot(token="8729927581:AAEPM2Olkhn9LjieoFtGROVpQRD6nvbyPJk")
dp = Dispatcher()
menu_ortga = types.InlineKeyboardMarkup(
    inline_keyboard=[
        [types.InlineKeyboardButton(text="⬅️Ortga Qaytish", callback_data="Or")],
    ],
)
@dp.message(Command("start"))
async def start(m:types.Message):
    with open("users.txt","a+") as f:
        f.seek(0)   
        telegram_id = str(m.from_user.id)
        telegram_lichkasi = str(m.from_user.username)
        ismi = str(m.from_user.first_name)
        if telegram_id not in f.read():
            f.write(f"{telegram_id} | {ismi} | {telegram_lichkasi}\n")

        menu = types.InlineKeyboardMarkup(
        inline_keyboard=[
            [types.InlineKeyboardButton(text="ℹ️ Biz Haqimizda", callback_data="Haq")],
            
            [
                types.InlineKeyboardButton(text="👑 Kichkina Admin", callback_data="Ad1"),
                types.InlineKeyboardButton(text="👑 Katta Admin", callback_data="Ak"),
            ],
            [
                types.InlineKeyboardButton(text="👨‍💻 Bot Yaratuvchisi", url="https://t.me/UzPython212"),
                types.InlineKeyboardButton(text="📸 Instagram",url="https://www.instagram.com/kattatoshdamolishmaskani1/"),
                
            ],
            [
                types.InlineKeyboardButton(text="🌐 Rasmiy Saytimiz", url="https://kattatoshdamolishmaskani.netlify.app/"),
                types.InlineKeyboardButton(text="📍 Manzilimiz", url="https://www.google.com/maps?q=39.407416,66.999012&ll=39.407416,66.999012&z=16"),
            ],
            [   types.InlineKeyboardButton(text="📸Rasmlar",callback_data="Ra")],
            [
                types.InlineKeyboardButton(text="📢Reklama Joylash",callback_data="Re")
            ]
        ],
    )
        await m.answer(f"Assalomu alaykum Python_Programmes Bizning maskanimiz shahar shovqinidan uzoqda, tabiat qo'ynida joylashgan. Bu yerda oilangiz va do'stlaringiz bilan mazmunli hordiq chiqarishingiz uchun barcha sharoitlar yaratilgan. Toza havo, shinam joylar va a'lo darajadagi xizmat sizni kutmoqda.", reply_markup=menu)          
@dp.callback_query(F.data=="Ra")
async def rasmlae(m:types.CallbackQuery):
        menu = types.InlineKeyboardMarkup(
        inline_keyboard=[
            [
                types.InlineKeyboardButton(text="🌙 Tungi Muhit", callback_data="Tu"),
                types.InlineKeyboardButton(text="⚡ Faollik", callback_data="Fa"),
            ],
            [
                types.InlineKeyboardButton(text="🌿 Tabiat", callback_data="Tab"),
                types.InlineKeyboardButton(text="⛰ Tog'", callback_data="To")
            ],
            [
                types.InlineKeyboardButton(text="🏠 Uy Rasmi", callback_data="Uy"),
                types.InlineKeyboardButton(text="🌊 Basseyn", callback_data="Ba"),
            ],
        ],
    )
        xabar_matni = "Rasmlardi Tanlang Asosiy Bulim qaytish uchun /start bosing"
        
        await m.message.answer(text=xabar_matni,reply_markup=menu)
@dp.callback_query(F.data=="Tu")
async def Rasmlar_tungi(m:types.CallbackQuery):
    photo = FSInputFile("2.jpg")
    photo2 = FSInputFile("3.jpg")
    await m.message.answer_photo(photo=photo2)
    await m.message.answer_photo(photo=photo, caption="🌙Tungi Rasmlar", reply_markup=menu_ortga)

@dp.callback_query(F.data=="Fa")
async def Faollik(m:types.CallbackQuery):
    photo = FSInputFile("5.jpg")
    photo2 = FSInputFile("6.jpg")
    await m.message.answer_photo(photo=photo)
    await m.message.answer_photo(photo=photo2, caption="Faollik", reply_markup=menu_ortga)

@dp.callback_query(F.data=="Tab")
async def Tabiat(m:types.CallbackQuery):
    photo1 = FSInputFile("7.jpg")
    photo3 = FSInputFile("8.jpg")
    await m.message.answer_photo(photo=photo1)
    await m.message.answer_photo(photo=photo3, caption="Tabiat Rasmi", reply_markup=menu_ortga)

@dp.callback_query(F.data=="To")
async def Tog(m:types.CallbackQuery):
    photo1 = FSInputFile("14.jpg")
    photo2 = FSInputFile("15.jpg")
    await m.message.answer_photo(photo=photo1)
    await m.message.answer_photo(photo=photo2, caption="⛰ Tog'", reply_markup=menu_ortga)

@dp.callback_query(F.data=="Uy")
async def Uy(m:types.CallbackQuery):
    photo1 = FSInputFile("Uy.jpg")
    photo2 = FSInputFile("Uy2.jpg")
    await m.message.answer_photo(photo=photo1)
    await m.message.answer_photo(photo=photo2, caption="🏠 Uy Rasmi", reply_markup=menu_ortga)

@dp.callback_query(F.data=="Ba")
async def Bassen(m:types.CallbackQuery):
    photo1 = FSInputFile("Basen1.jpg")
    photo2 = FSInputFile("Basen2.jpg")
    await m.message.answer_photo(photo=photo1)
    await m.message.answer_photo(photo=photo2)
    await m.message.answer("Yuqoridagilar basseyn rasmlari", reply_markup=menu_ortga)

@dp.callback_query(F.data=="Re")
async def reklama(m:types.CallbackQuery):
    await m.message.answer("Siz Botga Reklama Joylasayiz Buladi Uning uchun adming bilan bog'laning +998992746047")
    await m.message.answer("❗Muhim Eslatma Reklamayiz Tekshiruvdan Utadi")

@dp.callback_query(F.data=="Or")
async def orqaga_qaytish(m:types.CallbackQuery):
    menu = types.InlineKeyboardMarkup(
        inline_keyboard=[
            [
                types.InlineKeyboardButton(text="🌙 Tungi Muhit", callback_data="Tu"),
                types.InlineKeyboardButton(text="⚡ Faollik", callback_data="Fa"),
            ],
            [
                types.InlineKeyboardButton(text="🌿 Tabiat", callback_data="Tab"),
                types.InlineKeyboardButton(text="⛰ Tog'", callback_data="To")
            ],
            [
                types.InlineKeyboardButton(text="🏠 Uy Rasmi", callback_data="Uy"),
                types.InlineKeyboardButton(text="🌊 Basseyn", callback_data="Ba"),
            ],
        ],
    )

    xabar_matni = "Rasmlardi Tanlang Asosiy Bulim qaytish uchun /start bosing"
    await m.message.answer(text=xabar_matni,reply_markup=menu)
@dp.callback_query(F.data=="Haq")
async def Haqimizda(m:types.CallbackQuery):
    await m.message.answer("Bu dam olish maskni telegram boti bizda yotoqxona qozon bor tog' yon bag'rida joylangan")
@dp.callback_query(F.data=="Ad1")
async def Admin(m:types.CallbackQuery):
    await m.message.answer("Kichkina Admin Raqami +998992746047")          

@dp.callback_query(F.data=="Ak")
async def kattat_admin(m:types.CallbackQuery):
    await m.message.answer("Katta Admin Raqami +998996802659")
if __name__=="__main__":
    print("Bot Ishga tushdi...!!!!!!")
    asyncio.run(dp.start_polling(bot))