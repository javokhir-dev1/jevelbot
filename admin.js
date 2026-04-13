import { bot } from "./bot.js";
import { User } from "./models/user.model.js"

async function adminFunc(ctx) {
    const users_count = await User.count()
    await ctx.reply(`Jami userlar: ${users_count}`)
}

bot.command("admin", async (ctx) => {
    adminFunc(ctx)
        .catch((err) => console.log(err))
})
