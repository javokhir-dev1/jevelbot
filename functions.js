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

export const renderProjectsMessage = async (ctx) => {
    const projects = await UserProject.findAll({
        where: { telegram_id: String(ctx.from.id) }
    });

    if (projects.length === 0) {
        return await ctx.editMessageText("Sizda hali loyihalar mavjud emas. 📂");
    }

    const projectList = projects.map((p, index) =>
        `${index + 1}. <b>Nomi:</b> <code>${p.project_name}</code> | <b>Holati:</b> ${p.status}`
    ).join('\n');

    const buttons = projects.map(p => [
        Markup.button.callback(`❌ O'chirish: ${p.project_name}`, `delete_project_${p.id}`)
    ]);

    await ctx.editMessageText(
        `<b>Sizning loyihalaringiz:</b>\n\n${projectList}`,
        {
            parse_mode: "HTML",
            ...Markup.inlineKeyboard(buttons)
        }
    );
};

export const deleteProjectCompletely = async (projectId) => {
    try {
        // 1. DB dan olish
        const project = await UserProject.findOne({
            where: { id: projectId }
        });

        if (!project) {
            return {
                success: false,
                message: "Project topilmadi"
            };
        }

        const containerId = project.container_id;

        // 2. Container o‘chirish
        if (containerId) {
            spawn("docker", ["rm", "-f", containerId]);
            console.log(`[DELETE] Container o‘chirildi: ${containerId}`);
        }

        // 3. DB delete
        await UserProject.destroy({
            where: { id: projectId }
        });

        console.log(`[DELETE] DB dan o‘chirildi: ${projectId}`);

        return {
            success: true,
            message: "Project muvaffaqiyatli o‘chirildi",
            projectId
        };

    } catch (err) {
        console.error("[DELETE ERROR]:", err);

        return {
            success: false,
            message: err.message || "Unknown error",
            error: err
        };
    }
};

export const runPythonInDocker = async (
    projectPath,
    pythonFile,
    projectid,
    ctx,
    projectname,
    statusMsg
) => {
    try {
        const absolutePath = path.resolve(projectPath);
        const dockerfilePath = path.join(absolutePath, "Dockerfile");

        let errorSent = false;
        let hasError = false;
        let containerId = "";

        const removeContainer = (id) => {
            if (!id) return;
            spawn("docker", ["rm", "-f", id]);
        };

        const sendErrorToTelegram = async (errorLog) => {
            if (errorSent) return;
            errorSent = true;
            hasError = true;

            const safeLog = errorLog
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .slice(0, 3000);

            const message =
                `❌ <b>[${projectname}] xatolik:</b>\n\n` +
                `<pre><code>${safeLog}</code></pre>\n\n` +
                `⚠️ <b>Kodingizda xatolik aniqlandi.</b>\n` +
                `Uni to‘g‘irlab qayta urinib ko‘ring.`;

            // yangi message (user albatta ko‘radi)
            await ctx.reply(message, { parse_mode: "HTML" })
                .catch(() => { });

            // eski statusni ham update qilamiz
            await ctx.telegram.editMessageText(
                ctx.chat.id,
                statusMsg.message_id,
                null,
                "❌ Loyiha xatolik bilan to‘xtadi!"
            ).catch(() => { });

            // container o‘chirish
            removeContainer(containerId);

            // DB update
            await UserProject.update(
                { status: "crashed" },
                { where: { project_id: projectid } }
            ).catch(() => { });
        };

        // 🧹 eski containerni o‘chirish
        spawn("docker", ["rm", "-f", `${projectid}_container`]);

        // 1. Dockerfile
        const dockerfileContent = `
FROM python:3.10-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN useradd -m appuser
COPY . .
USER appuser
ENV PYTHONUNBUFFERED=1
CMD ["python", "-u", "${pythonFile}"]
`.trim();

        fs2.writeFileSync(dockerfilePath, dockerfileContent);

        // 2. BUILD
        const build = spawn("docker", ["build", "-t", projectid, absolutePath]);

        let buildError = "";

        build.stderr.on("data", (d) => {
            buildError += d.toString();
        });

        build.on("close", async (code) => {
            if (code !== 0) {
                return ctx.telegram.editMessageText(
                    ctx.chat.id,
                    statusMsg.message_id,
                    null,
                    `❌ Build xato:\n${buildError.slice(0, 1000)}`
                );
            }

            // 3. RUN
            const run = spawn("docker", [
                "run",
                "-d",

                "--cpus=0.1",

                "--memory=256m",
                "--memory-swap=256m",

                "--pids-limit=50",

                "--name",
                `${projectid}_container`,

                projectid
            ]);

            let runError = "";

            run.stdout.on("data", (d) => {
                containerId += d.toString();
            });

            run.stderr.on("data", (d) => {
                runError += d.toString();
            });

            run.on("close", async (runCode) => {
                if (runCode !== 0) {
                    return ctx.telegram.editMessageText(
                        ctx.chat.id,
                        statusMsg.message_id,
                        null,
                        `❌ Run xato:\n${runError}`
                    );
                }

                containerId = containerId.trim();

                // 🟡 DB starting
                await UserProject.create({
                    telegram_id: String(ctx.from.id),
                    project_id: projectid,
                    project_name: projectname,
                    container_id: containerId,
                    status: "starting"
                }).catch(() => { });

                // 4. LOGS
                const logs = spawn("docker", ["logs", "-f", containerId]);

                const checkError = (log) => {
                    const l = log.toLowerCase();
                    return (
                        l.includes("traceback") ||
                        l.includes("error") ||
                        l.includes("exception")
                    );
                };

                logs.stdout.on("data", (d) => {
                    const log = d.toString();
                    process.stdout.write(log);

                    if (checkError(log)) sendErrorToTelegram(log);
                });

                logs.stderr.on("data", (d) => {
                    const log = d.toString();
                    process.stderr.write(log);

                    if (checkError(log)) sendErrorToTelegram(log);
                });

                // 5. DELAYED SUCCESS
                setTimeout(async () => {
                    if (hasError) return;

                    const inspect = spawn("docker", [
                        "inspect",
                        "-f",
                        "{{.State.Running}}",
                        containerId
                    ]);

                    let status = "";

                    inspect.stdout.on("data", (d) => {
                        status += d.toString();
                    });

                    inspect.on("close", async () => {
                        if (!status.includes("true")) {
                            return sendErrorToTelegram("Container ishlamayapti");
                        }

                        // ✅ SUCCESS
                        await ctx.telegram.editMessageText(
                            ctx.chat.id,
                            statusMsg.message_id,
                            null,
                            "✅ Loyiha muvaffaqiyatli ishga tushdi!"
                        );

                        await UserProject.update(
                            { status: "active" },
                            { where: { project_id: projectid } }
                        ).catch(() => { });
                    });
                }, 5000);

                // 6. CRASH DETECTOR
                const wait = spawn("docker", ["wait", containerId]);

                wait.on("close", async (exitCode) => {
                    if (exitCode !== 0) {
                        const crashLogs = spawn("docker", ["logs", containerId]);
                        let fullLog = "";

                        crashLogs.stdout.on("data", (d) => {
                            fullLog += d.toString();
                        });

                        crashLogs.on("close", async () => {
                            await sendErrorToTelegram(
                                `Exit code ${exitCode}\n\n${fullLog}`
                            );
                        });
                    }
                });
            });
        });

    } catch (err) {
        console.error(err);
        ctx.reply(`❌ Global xatolik: ${err.message}`);
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