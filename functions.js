import { Markup } from "telegraf";

export async function checkSubscription(ctx, channelId) {
    try {
        const member = await ctx.telegram.getChatMember(channelId, ctx.from.id);
        const status = member.status;

        return ['creator', 'administrator', 'member'].includes(status);
    } catch (error) {
        console.error("Tekshirishda xatolik:", error);
        return false;
    }
}

export async function sendSoftwareInfo(ctx, title, description, downloadUrl) {
    const message = `<b>${title}</b>\n\n${description}\n\n`;
    
    return await ctx.replyWithHTML(
        message,
        Markup.inlineKeyboard([
            [Markup.button.url("📥 Yuklab olish", downloadUrl)]
        ])
    );
};