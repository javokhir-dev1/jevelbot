import { Markup } from "telegraf";
import { User } from "./models/user.model.js";
import { UserProject } from "./models/userproject.model.js";
import ExcelJS from "exceljs";
import "dotenv/config"
import { bot } from "./bot.js";

const admin = process.env.ADMINID

async function adminFunc(ctx) {
    const users_count = await User.count();
    const projects_count = await UserProject.count();

    await ctx.reply(
        `📊 Admin panel

👤 Userlar: ${users_count}
📁 Loyihalar: ${projects_count}`,
        Markup.inlineKeyboard([
            [
                Markup.button.callback("📥 Userlarni Excel", "export_users"),
                Markup.button.callback("📥 Loyihalarni Excel", "export_projects")
            ]
        ])
    )
}

bot.command("admin", async (ctx) => {
    if (admin == ctx.from.id) {
        adminFunc(ctx)
            .catch((err) => console.log(err))
    }
})

bot.action("export_users", async (ctx) => {
    const users = await User.findAll();

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Users");

    worksheet.columns = [
        { header: "ID", key: "id" },
        { header: "Telegram ID", key: "telegram_id" },
        { header: "Username", key: "username" },
        { header: "Full Name", key: "full_name" }
    ];

    users.forEach(user => {
        worksheet.addRow(user.dataValues);
    });

    const buffer = await workbook.xlsx.writeBuffer();

    await ctx.replyWithDocument({
        source: buffer,
        filename: "users.xlsx"
    });
});

bot.action("export_projects", async (ctx) => {
    const projects = await UserProject.findAll();

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Projects");

    worksheet.columns = [
        { header: "Telegram ID", key: "telegram_id" },
        { header: "Project ID", key: "project_id" },
        { header: "Project Name", key: "project_name" },
        { header: "Container ID", key: "container_id" },
        { header: "Status", key: "status" }
    ];

    projects.forEach(project => {
        worksheet.addRow(project.dataValues);
    });

    const buffer = await workbook.xlsx.writeBuffer();

    await ctx.replyWithDocument({
        source: buffer,
        filename: "projects.xlsx"
    });
});