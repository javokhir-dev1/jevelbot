import { Markup } from "telegraf";
import { bot } from "./bot.js"
import { User } from "./models/user.model.js"
import { checkSubscription } from "./functions.js"
import "dotenv/config"

const channelId = process.env.CHANNELID

import "./admin.js"

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
        text = `<b>Xush kelibsiz! ✨\n\n<a href="tg://user?id=${telegram_id}">${first_name}</a>, Pastdan kerakli bo'limni tanlang 😊</b>`
    } else {
        text = `<b>🏠 Bosh menyu</b>`
    }
    await ctx.replyWithHTML(text, Markup.keyboard
        (
            [
                ["➕ Loyiha qo'shish"],
                ["👨‍💻 Admin bilan aloqa", "📚 Kerakli resurslar"]
            ]
        ).resize()
    )
}

bot.start(async (ctx) => {
    startFunc(ctx)
        .catch((err) => console.log(err))
})

// ON MESSAGE

async function callToSubscription(ctx) {
    await ctx.reply(
        "🌟 **Loyiha rivojiga hissa qo'shing!**\n\nDavom etish uchun Javohirning rasmiy sahifasiga obuna bo'lishingizni so'raymiz.",
        {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.url("📢 Obuna bo'lish", "https://t.me/javokhxirr")],
                [Markup.button.callback("✅ Tekshirish", "check_sub")]
            ])
        }
    );
}

async function onMessageFunc(ctx) {
    const text = ctx.message.text
    const isSubscribed = await checkSubscription(ctx, channelId)
    if (!isSubscribed) {
        return callToSubscription(ctx)
            .catch((err) => console.log(err))
    }

    if (text === "➕ Loyiha qo'shish") {
        ctx.reply("loyiha qo'shish")
    }

    else if (text === "📚 Kerakli resurslar") {
        await ctx.replyWithHTML("<b>Kerakli resursni pastdan tanlang 👇</b>",
            Markup.keyboard(
                [
                    ["🐧 Ubuntu", "💾 Rufus"],
                    ["🔙 Orqaga qaytish"]
                ]
            ).resize()
        )
    }

    else if (text === "👨‍💻 Admin bilan aloqa") {
        ctx.reply("admin bilan aloqa")
    }

    else if (text === "🔙 Orqaga qaytish") {
        await startFunc(ctx)
    }

    else if (text === "🐧 Ubuntu") {
        await ctx.replyWithHTML(
            "<b>🐧 Ubuntu operatsion tizimi</b>\n\n" +
            "Quyidagi tugmani bosish orqali ISO faylni yuklab olishingiz mumkin:",
            Markup.inlineKeyboard([
                [
                    Markup.button.url("📥 Yuklab olish", "https://drive.google.com/file/d/15JR_1Xuzhlq8vkdyExREI3EJClPGQbzj/view?usp=sharing")
                ]
            ])
        )
    }

    else if (text === "💾 Rufus") {
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

bot.action("check_sub", async (ctx) => {
    try {
        const isSubscribed = await checkSubscription(ctx, channelId);

        if (isSubscribed) {
            await ctx.answerCbQuery("Rahmat! Obuna tasdiqlandi.");
            await ctx.editMessageText("Tabriklaymiz, endi botdan foydalanishingiz mumkin! 🎉");
        } else {
            await ctx.answerCbQuery("Siz hali a'zo bo'lmagansiz! ❌", { show_alert: true });
        }
    } catch (err) {
        console.log(err)
    }
})

bot.on("message", async (ctx) => {
    onMessageFunc(ctx)
        .catch((err) => console.log(err))
})