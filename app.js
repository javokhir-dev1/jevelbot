import { Markup } from "telegraf";
import { bot } from "./bot.js"
import { User } from "./models/user.model.js"

// START

async function startFunc(ctx) {
    const { id: telegram_id, username, first_name, last_name } = ctx.from;
    const full_name = [first_name, last_name].filter(Boolean).join(' ');

    const [user, created] = await User.findOrCreate({
        where: { telegram_id: String(telegram_id) },
        defaults: { username, full_name }
    });
    let text = ""
    if (created) {
        text = `<b>Xush kelibsiz! ✨\n\nMen **Jevel bot**man. Sizga xizmat ko'rsatishdan mamnunman, ${first_name}!</b>`
    } else {
        text = `<b>Qayta ko'rishganimizdan xursandman! 😊</b>`
    }
    await ctx.replyWithHTML(text, Markup.keyboard
        (
            [
                ["💾 Rufus", "🐧 Ubuntu"],
            ]
        ).resize()
    )
}

bot.start(async (ctx) => {
    startFunc(ctx)
        .catch((err) => console.log(err))
})

// ADMIN

async function adminFunc(ctx) {
    const users_count = await User.count()
    await ctx.reply(`Jami userlar: ${users_count}`)
}

bot.command("admin", async (ctx) => {
    adminFunc(ctx)
        .catch((err) => console.log(err))
})

// ON MESSAGE

async function onMessageFunc(ctx) {
    const text = ctx.message.text
    if (text === "🐧 Ubuntu") {
        await ctx.replyWithHTML(
            "<b>🐧 Ubuntu operatsion tizimi</b>\n\n" +
            "Quyidagi tugmani bosish orqali ISO faylni yuklab olishingiz mumkin:",
            Markup.inlineKeyboard([
                [
                    Markup.button.url("📥 Yuklab olish", "https://drive.google.com/file/d/15JR_1Xuzhlq8vkdyExREI3EJClPGQbzj/view?usp=sharing")
                ]
            ])
        )
    } else if (text === "💾 Rufus") {
        await ctx.replyWithHTML(
            "<b>💾 Rufus Dasturi</b>\n\n" +
            "Ushbu dastur yordamida yuklanuvchi (bootable) USB fleshkalar yaratishingiz mumkin.\n\n",
            Markup.inlineKeyboard([
                [
                    Markup.button.url("📥 Yuklab olish", "https://drive.google.com/file/d/1y7uHKUUUJ4ZJeGwPLYLU_P0d9klhdY03/view?usp=sharing")
                ]
            ])
        );
    }
}

bot.on("message", async (ctx) => {
    onMessageFunc(ctx)
        .catch((err) => console.log(err))
})