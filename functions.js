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
import os from "os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


export function logSystemUsage() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    const cpuLoad = os.loadavg()[0]; // 1 min load

    console.log("🖥 SYSTEM STATS:");
    console.log(`RAM: ${(usedMem / 1024 / 1024).toFixed(0)} MB used / ${(totalMem / 1024 / 1024).toFixed(0)} MB total`);
    console.log(`FREE RAM: ${(freeMem / 1024 / 1024).toFixed(0)} MB`);
    console.log(`CPU LOAD (1m): ${cpuLoad}`);
}

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
    const absolutePath = path.resolve(projectPath);
    const dockerfilePath = path.join(absolutePath, "Dockerfile");

    let containerId = "";
    let errorSent = false;
    let hasError = false;
    let errorBuffer = "";

    const updateStatus = async (text) => {
        try {
            await ctx.telegram.editMessageText(
                ctx.chat.id,
                statusMsg.message_id,
                null,
                text
            );
        } catch (_) { }
    };

    const sendError = async (log, stage = "UNKNOWN") => {
        if (errorSent) return;
        errorSent = true;
        hasError = true;

        console.log("[ERROR STAGE]:", stage);
        console.log("[ERROR LOG]:", log);

        const safeLog = log
            .toString()
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .slice(0, 3500);

        await ctx.reply(
            `❌ <b>[${projectname}] xatolik (${stage})</b>\n\n` +
            `<pre>${safeLog}</pre>\n\n` +
            `⚠️ <b>Loyiha xatolik sabab to‘xtadi.</b>\n` +
            `🔁 <b>Xatolarni tuzatib qayta urinib ko‘ring.</b>`,
            { parse_mode: "HTML" }
        ).catch(() => { });

        await updateStatus("❌ Loyiha xatolik bilan to‘xtadi!");

        if (containerId) {
            console.log("[DOCKER REMOVE]:", containerId);
            spawn("docker", ["rm", "-f", containerId]);
        }

        await UserProject.destroy({
            where: { project_id: projectid }
        }).catch(() => { });
    };

    const exec = (cmd, args) =>
        new Promise((resolve) => {
            console.log("[EXEC START]:", cmd, args.join(" "));

            const p = spawn(cmd, args);
            let out = "";
            let err = "";

            p.stdout?.on("data", d => {
                const data = d.toString();
                console.log("[EXEC OUT]:", data);
                out += data;
            });

            p.stderr?.on("data", d => {
                const data = d.toString();
                console.log("[EXEC ERR]:", data);
                err += data;
            });

            p.on("close", code => {
                console.log("[EXEC CLOSE]:", code);
                resolve({ code, out, err });
            });
        });

    try {
        console.log("=== START PROJECT ===");

        await updateStatus("📦 Loyihani tayyorlash...");

        console.log("[DOCKER REMOVE OLD]:", `${projectid}_container`);
        spawn("docker", ["rm", "-f", `${projectid}_container`]);

        await updateStatus("📝 Muhit sozlanmoqda...");

        const dockerfileContent = `
FROM python:3.10-slim
WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt || (echo "PIP ERROR" && exit 1)

COPY . .

RUN useradd -m appuser
USER appuser

ENV PYTHONUNBUFFERED=1

CMD ["python", "-u", "${pythonFile}"]
`.trim();

        console.log("[WRITE DOCKERFILE]:", dockerfilePath);
        fs2.writeFileSync(dockerfilePath, dockerfileContent);

        console.log("[DOCKER BUILD START]");
        const build = spawn("docker", ["build", "-t", projectid, absolutePath]);

        let buildError = "";

        build.stdout.on("data", d => {
            console.log("[BUILD OUT]:", d.toString());
        });

        build.stderr.on("data", d => {
            console.log("[BUILD ERR]:", d.toString());
            buildError += d.toString();
        });

        const buildCode = await new Promise(resolve =>
            build.on("close", resolve)
        );

        console.log("[BUILD DONE CODE]:", buildCode);

        if (buildCode !== 0) {
            await sendError(buildError, "BUILD");
            return;
        }

        await updateStatus("🚀 Muhit ishga tushirilmoqda...");

        console.log("[DOCKER RUN START]");
        const run = await exec("docker", [
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

        console.log("[RUN OUT]:", run.out);
        console.log("[RUN ERR]:", run.err);

        if (run.code !== 0) {
            await sendError(run.err, "RUN");
            return;
        }

        containerId = run.out.trim();
        console.log("[CONTAINER ID]:", containerId);

        await updateStatus("🟡 Muhit ishga tushdi, tekshirilmoqda...");

        await UserProject.create({
            telegram_id: String(ctx.from.id),
            project_id: projectid,
            project_name: projectname,
            container_id: containerId,
            status: "starting"
        }).catch(() => { });

        console.log("[START LOG STREAM]");
        const logs = spawn("docker", ["logs", "-f", containerId]);

        const isError = (text) => {
            const t = text.toLowerCase();

            return (
                // general
                t.includes("error") ||
                t.includes("failed") ||
                t.includes("fatal") ||
                t.includes("panic") ||

                // python
                t.includes("traceback") ||
                t.includes("exception") ||
                t.includes("modulenotfounderror") ||
                t.includes("importerror") ||
                t.includes("syntaxerror") ||
                t.includes("indentationerror") ||
                t.includes("nameerror") ||
                t.includes("typeerror") ||
                t.includes("valueerror") ||
                t.includes("runtimeerror") ||
                t.includes("assertionerror") ||

                t.includes("no such file") ||
                t.includes("can't open file") ||
                t.includes("file not found") ||

                t.includes("oci runtime") ||
                t.includes("container_linux") ||
                t.includes("cannot start container") ||
                t.includes("exec user process") ||

                t.includes("could not find a version") ||
                t.includes("no matching distribution") ||
                t.includes("failed building wheel") ||
                t.includes("resolutionimpossible") ||

                t.includes("killed") ||
                t.includes("out of memory") ||
                t.includes("cannot allocate memory") ||
                t.includes("enospc") ||
                t.includes("disk full") ||

                // network
                t.includes("connection refused") ||
                t.includes("timed out") ||
                t.includes("temporary failure") ||

                // permissions
                t.includes("permission denied") ||
                t.includes("operation not permitted") ||
                t.includes("eacces") ||

                // low-level crash
                t.includes("segmentation fault")
            );
        };

        logs.stdout.on("data", async (d) => {
            const log = d.toString();

            console.log("[CONTAINER STDOUT]:", log);

            errorBuffer += log;

            if (!hasError && isError(errorBuffer)) {
                await sendError(errorBuffer, "RUNTIME");
            }
        });

        logs.stderr.on("data", async (d) => {
            const log = d.toString();

            console.log("[CONTAINER STDERR]:", log);

            errorBuffer += log;

            if (!hasError && isError(errorBuffer)) {
                await sendError(errorBuffer, "RUNTIME");
            }
        });

        setTimeout(async () => {
            if (hasError) return;

            console.log("[CHECK CONTAINER STATUS]");

            const inspect = await exec("docker", [
                "inspect",
                "-f",
                "{{.State.Running}}",
                containerId
            ]);

            console.log("[INSPECT RESULT]:", inspect.out);

            if (!inspect.out.includes("true")) {
                return sendError("Container running emas", "INSPECT");
            }

            await updateStatus("✅ Loyiha muvaffaqiyatli ishga tushirildi. \n\nAgarda hali ishga tushmagan bo'lsa. Iltimos, bir necha daqiqadan so‘ng qayta urinib ko‘ring. Xatolar hozirda tekshirilmoqda.");

            await UserProject.update(
                { status: "active" },
                { where: { project_id: projectid } }
            ).catch(() => { });
        }, 5000);

        const wait = spawn("docker", ["wait", containerId]);

        wait.on("close", async (code) => {
            console.log("[CONTAINER EXIT CODE]:", code);

            if (code !== 0 && !hasError) {
                const crashLogs = await exec("docker", ["logs", containerId]);

                await sendError(
                    `Exit code: ${code}\n\n${crashLogs.out}`,
                    "CRASH"
                );
            }
        });

    } catch (err) {
        console.log("[GLOBAL ERROR]:", err);
        await sendError(err.message, "GLOBAL");
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
