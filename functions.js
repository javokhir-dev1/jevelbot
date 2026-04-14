import { Markup } from "telegraf";
import unzipper from "unzipper";
import fs from "fs-extra";
import Unrar from "node-unrar-js";
import path from "path";
import fs2 from 'fs';
import { fileURLToPath } from 'url';
import { createExtractorFromData } from 'node-unrar-js';
import { spawn } from "child_process";
import { UserProject } from "./models/userproject.model.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const runPythonInDocker = (projectPath, pythonFile, projectname, telegram_id) => {
    try {
        const absolutePath = path.resolve(projectPath);
        const dockerfilePath = path.join(absolutePath, 'Dockerfile');

        const dockerfileContent = `
FROM python:3.10-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN useradd -m appuser
COPY . .
USER appuser
CMD ["python", "${pythonFile}"]
        `.trim()

        fs2.writeFileSync(dockerfilePath, dockerfileContent);
        console.log("✅ Dockerfile yaratildi");

        console.log("🚀 BUILD (background)...");
        const build = spawn("docker", ["build", "-t", projectname, absolutePath]);

        build.stdout.on("data", (data) => {
            console.log("BUILD:", data.toString());
        });

        build.stderr.on("data", (data) => {
            console.error("BUILD ERROR:", data.toString());
        });

        build.on("close", (code) => {
            console.log("BUILD tugadi:", code);

            if (code === 0) {
                console.log("📦 RUN (background)...");

                const run = spawn("docker", ["run", "-d", projectname]);
                let containerId = "";

                run.stdout.on("data", (data) => {
                    containerId += data.toString();
                });

                run.stderr.on("data", (data) => {
                    console.error("PYTHON ERROR:", data.toString());
                });

                run.on("close", async (code) => {
                    containerId = containerId.trim();
                    await UserProject.create({
                        telegram_id: telegram_id,
                        project_id: projectname,
                        container_id: containerId || "nomalum",
                        status: "active"
                    })
                    console.log("📦 Container ID:", containerId);
                    console.log("Container tugadi:", code);
                });
            }
        });

    } catch (error) {
        console.error("❌ Xatolik:", error);
    }
};

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

export async function flattenDirectory(dir) {
    // 1. Papka ichidagi barcha narsalarni o'qiymiz
    const items = await fs.readdir(dir);

    // Agar papka ichida faqat 1 ta element bo'lsa va u papka bo'lsa
    // Uni yuqoriga (asosiy dir ga) ko'chiradi
    if (items.length === 1) {
        const fullPath = path.join(dir, items[0]);
        const stat = await fs.stat(fullPath);

        if (stat.isDirectory()) {
            const subItems = await fs.readdir(fullPath);
            for (const item of subItems) {
                // Ichki elementlarni asosiy papkaga ko'chirish
                await fs.move(path.join(fullPath, item), path.join(dir, item), { overwrite: true });
            }
            // Bo'shab qolgan ichki papkani o'chirish
            await fs.remove(fullPath);

            // Rekursiv ravishda yana tekshirish (agar ichma-ich papkalar bo'lsa)
            await flattenDirectory(dir);
        }
    }
}

export async function extractZip(filePath, extractPath) {
    return new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
            .pipe(unzipper.Extract({ path: extractPath }))
            .on("close", resolve)
            .on("error", reject);
    });
}

export async function extractRar(filePath, extractPath) {
    const data = fs.readFileSync(filePath);
    const extractor = await createExtractorFromData({ data });

    const extracted = extractor.extract();

    for (const file of extracted.files) {
        const header = file.fileHeader;
        const fullPath = path.join(extractPath, header.name);

        if (header.flags.directory) {
            await fs.ensureDir(fullPath);
            continue;
        }

        if (!file.extraction) continue;

        await fs.ensureDir(path.dirname(fullPath));
        await fs.writeFile(fullPath, Buffer.from(file.extraction));
    }
}