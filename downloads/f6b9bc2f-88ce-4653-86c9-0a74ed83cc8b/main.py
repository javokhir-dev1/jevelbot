import telebot
# Bot tokenini bu yerga yozing (@BotFather orqali olingan)
API_TOKEN = '8716886307:AAHwQXmHr4iYnJ6sm-PIH9fU3uAlKE1B4X4'

bot = telebot.TeleBot(API_TOKEN)

# /start va /help buyruqlari uchun handler
@bot.message_handler(commands=['start', 'help'])
def send_welcome(message):
    bot.reply_to(message, "Salom! Men oddiy botman. Menga biror narsa yozing.")

# Barcha matnli xabarlarni qaytaruvchi (echo) handler
@bot.message_handler(func=lambda message: True)
def echo_all(message):
    bot.reply_to(message, f"Siz shunday dedingiz: {message.text}")

# Botni ishga tushirish
print("Bot ishga tushdi...")
bot.infinity_polling()