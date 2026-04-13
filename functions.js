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