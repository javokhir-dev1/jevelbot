import { Markup } from "telegraf"
import { bot, session } from "./bot.js"
import { User } from "./models/user.model.js"
import { checkSubscription, extractRar, extractZip, sendSoftwareInfo, flattenDirectory, runPythonInDocker, deleteProjectCompletely, renderProjectsMessage } from "./functions.js"
import { fileURLToPath } from "url"
import axios from "axios"
import fs from "fs-extra"
import path from "path"
import { v4 as uuid } from "uuid"

import "dotenv/config"
import "./admin.js"
import { UserProject } from "./models/userproject.model.js"

const channelId = process.env.CHANNELID

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function startFunc(ctx, text2) {
    const { id: telegram_id, username, first_name, last_name } = ctx.from
    const full_name = [first_name, last_name].filter(Boolean).join(' ')

    const [user, created] = await User.findOrCreate({
        where: { telegram_id: String(telegram_id) },
        defaults: { username, full_name }
    })
    let text = ""
    if (created) {
        text = `<b>Xush kelibsiz! ✨\n\n<a href="tg://user?id=${telegram_id}">${first_name}</a>, Pastdan kerakli bo'limni tanlang 😊</b>`
    } else {
        if (text2) {
            text = text2
        } else {
            text = `<b>Qayta ko'rishganimdan hursandman 😊</b>`
        }
    }

    await ctx.replyWithHTML(text, Markup.keyboard
        (
            [
                ["➕ Loyiha qo'shish"],
                ["🚀 Loyihalarim"],
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
    )
}

async function onMessageFunc(ctx) {
    if (!session[ctx.from.id]) session[ctx.from.id] = {}
    const text = ctx.message.text
    const userSession = session[ctx.from.id]

    // Obunani tekshirish
    const isSubscribed = await checkSubscription(ctx, channelId)
    if (!isSubscribed) {
        return callToSubscription(ctx)
            .catch((err) => console.log(err))
    }

    if (userSession["state"] === "waiting_document") {
        const file = ctx.message.document;
        const allowedExtensions = ['zip', 'rar'];
        const fileExtension = file?.file_name?.split('.').pop().toLowerCase();

        if (!file || !allowedExtensions.includes(fileExtension)) {
            return await ctx.replyWithHTML(
                "<b>⚠️ Xatolik: Noto'g'ri format!</b>\n\n" +
                "Iltimos, loyihangizni faqat <b>arxiv (.zip yoki .rar)</b> ko'rinishida yuboring.\n" +
                "Oddiy fayllar yoki boshqa formatlar qabul qilinmaydi.",
                Markup.inlineKeyboard([
                    [Markup.button.callback("❌ Bekor qilish", "cancel_process")]
                ])
            );
        }

        userSession.tempFileId = file.file_id; // Faylni vaqtincha saqlash
        userSession.state = "waiting_project_name"; // Holatni o'zgartirish

        return await ctx.replyWithHTML("<b>✅ Arxiv qabul qilindi.</b>\n\nEndi, loyihangizga nom bering:");
    }

    // 2-QADAM: Loyiha nomini qabul qilish
    else if (userSession["state"] === "waiting_project_name") {
        if (!text) {
            return await ctx.reply("Iltimos, loyiha nomini matn ko'rinishida yozing:");
        }

        userSession.projectName = text; // Nomni saqlash
        userSession.state = "waiting_main_file"; // Holatni o'zgartirish

        return await ctx.replyWithHTML(
            "<b>🚀 Asosiy faylni ko'rsating</b>\n\n" +
            "Ishga tushishi kerak bo'lgan fayl nomini yozing (masalan: <code>main.py</code>):"
        );
    }

    // 3-QADAM: Asosiy faylni qabul qilish va Dockerga yuborish
    else if (userSession["state"] === "waiting_main_file") {
        if (!text) {
            return await ctx.reply("Fayl nomini matn ko'rinishida yozing (masalan: main.py):");
        }

        const mainFile = text;
        const projectName = userSession.projectName;
        const fileId = userSession.tempFileId;

        const statusMsg = await ctx.reply("⏳ Loyiha ishga tushirilmoqda...");

        try {
            const link = await ctx.telegram.getFileLink(fileId);
            const uniqueId = uuid();
            const downloadDir = path.join(__dirname, "downloads", uniqueId);
            await fs.ensureDir(downloadDir);

            const extension = path.extname(link.pathname);
            const filePath = path.join(downloadDir, `file${extension}`);

            const response = await axios({
                url: link.href,
                method: "GET",
                responseType: "stream",
            });

            const writer = fs.createWriteStream(filePath);
            response.data.pipe(writer);

            await new Promise((resolve, reject) => {
                writer.on("finish", resolve);
                writer.on("error", reject);
            });

            console.log("Fayl yuklandi:", filePath);

            if (filePath.endsWith(".zip")) {
                await extractZip(filePath, downloadDir);
            } else if (filePath.endsWith(".rar")) {
                await extractRar(filePath, downloadDir);
            }
            await fs.remove(filePath);

            await flattenDirectory(downloadDir);

            // Docker funksiyasini chaqirish (statusMsg bilan birga)
            await runPythonInDocker(downloadDir, mainFile, uniqueId, ctx, projectName, statusMsg);

        } catch (error) {
            console.error("Xatolik:", error);
            await ctx.reply("❌ Loyihani ishga tushirishda xatolik yuz berdi.");
        }

        // Sessiyani tozalash
        delete userSession.state;
        delete userSession.tempFileId;
        delete userSession.projectName;
        return;
    }

    // --- ASOSIY BUYRUQLAR ---
    if (text === "➕ Loyiha qo'shish") {
        userSession["state"] = "waiting_document"
        await ctx.replyWithHTML(
            "<b>📦 Loyihani yuklash</b>\n\n" +
            "Iltimos, loyihangiz papkasini <b>.zip</b> yoki <b>.rar</b> formatida yuboring.\n\n" +
            "<b>⚠️ Muhim shartlar:</b>\n" +
            "• <code>requirements.txt</code> fayli mavjud bo'lishi shart.\n" +
            "• Asosiy ishga tushuvchi fayl loyihaning <b>ildiz (root)</b> qismida joylashishi kerak."
        );
    }

    else if (text === "🚀 Loyihalarim") {
        const projects = await UserProject.findAll({
            where: { telegram_id: String(ctx.from.id) }
        });

        if (projects.length === 0) {
            return await ctx.reply("Sizda hali loyihalar mavjud emas. 📂");
        }

        const projectList = projects.map((p, index) =>
            `${index + 1}. <b>Nomi:</b> <code>${p.project_name}</code> | <b>Holati:</b> ${p.status}`
        ).join('\n');

        const buttons = projects.map(p => [
            Markup.button.callback(`❌ O'chirish: ${p.project_name}`, `delete_project_${p.id}`)
        ]);

        await ctx.replyWithHTML(
            `<b>Sizning loyihalaringiz:</b>\n\n${projectList}`,
            Markup.inlineKeyboard(buttons)
        );
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
        ctx.replyWithHTML("<b>✨ Savollaringiz yoki takliflaringiz bor bo'lsa? Biz bilan bog'laning: \n\n🧑‍💻 Admin: @javokhir00</b>")
    }

    else if (text === "🔙 Orqaga qaytish") {
        await startFunc(ctx, "🏠 Bosh menyu")
    }

    else if (text === "🐧 Ubuntu") {
        await sendSoftwareInfo(
            ctx,
            "🐧 Ubuntu operatsion tizimi",
            "Quyidagi tugmani bosish orqali ISO faylni yuklab olishingiz mumkin:",
            "https://drive.google.com/file/d/15JR_1Xuzhlq8vkdyExREI3EJClPGQbzj/view?usp=sharing"
        )
    }

    else if (text === "💾 Rufus") {
        await sendSoftwareInfo(
            ctx,
            "💾 Rufus Dasturi",
            "Ushbu dastur yordamida yuklanuvchi (bootable) USB fleshkalar yaratishingiz mumkin.",
            "https://drive.google.com/file/d/1y7uHKUUUJ4ZJeGwPLYLU_P0d9klhdY03/view?usp=sharing"
        )
    }
}

bot.action(/delete_project_(.+)/, async (ctx) => {
    try {
        const project_id = ctx.match[1];

        const result = await deleteProjectCompletely(project_id);

        if (result.success) {
            await ctx.answerCbQuery("✅ O'chirildi", { show_alert: true });

            // 🔥 MUHIM: message refresh
            await renderProjectsMessage(ctx);
        } else {
            await ctx.answerCbQuery("❌ O'chirishda xatolik", { show_alert: true });
        }

    } catch (err) {
        console.log(err);
        await ctx.answerCbQuery("❌ Server xatosi", { show_alert: true });
    }
});

bot.action("cancel_process", async (ctx) => {
    try {
        if (!session[ctx.from.id]) session[ctx.from.id] = {}
        session[ctx.from.id]["state"] = ""
        await ctx.editMessageText("<b>✅ Bekor qilindi</b>", { parse_mode: "HTML" })
    } catch (err) {
        console.log(err)
    }
})

bot.action("check_sub", async (ctx) => {
    try {
        const isSubscribed = await checkSubscription(ctx, channelId)

        if (isSubscribed) {
            await ctx.answerCbQuery("Rahmat! Obuna tasdiqlandi.")
            await ctx.editMessageText("Tabriklaymiz, endi botdan foydalanishingiz mumkin! 🎉")
        } else {
            await ctx.answerCbQuery("Siz hali a'zo bo'lmagansiz! ❌", { show_alert: true })
        }
    } catch (err) {
        console.log(err)
    }
})

bot.on("message", async (ctx) => {
    onMessageFunc(ctx)
        .catch((err) => console.log(err))
})