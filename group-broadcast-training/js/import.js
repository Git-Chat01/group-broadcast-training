/* ============================================
   import.js — Word/Excel 题库导入解析器
   支持 .docx（问卷星导出）和 .xlsx 格式
   ============================================ */

const Importer = {

    /** 解析结果缓存 */
    parsedQuestions: [],

    /**
     * 读取用户选择的文件并解析
     * @param {File} file - 上传的文件对象
     * @returns {Promise<{ok: boolean, questions?: Array, error?: string}>}
     */
    async parseFile(file) {
        const ext = file.name.split(".").pop().toLowerCase();
        if (ext === "docx") {
            return await this.parseDocx(file);
        } else if (ext === "xlsx" || ext === "xls") {
            return await this.parseXlsx(file);
        }
        return { ok: false, error: "不支持的文件格式，请上传 .docx 或 .xlsx 文件" };
    },

    /** 解析 docx 文件 */
    async parseDocx(file) {
        try {
            const zip = await JSZip.loadAsync(file);
            const docXml = await zip.file("word/document.xml").async("string");
            if (!docXml) return { ok: false, error: "无法读取文档内容" };

            // 提取纯文本
            const text = docXml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

            // 按题目编号拆分：匹配 "1." "2." 等题号标记
            const questionBlocks = this.splitQuestions(text);

            // 解析每道题
            const questions = [];
            for (const block of questionBlocks) {
                const q = this.parseBlock(block);
                if (q) questions.push(q);
            }

            // 提取图片
            const imageFiles = [];
            zip.forEach((relativePath, file) => {
                if (relativePath.startsWith("word/media/")) {
                    imageFiles.push({ path: relativePath, file });
                }
            });

            this.parsedQuestions = questions;
            return { ok: true, questions, imageCount: imageFiles.length };
        } catch (e) {
            return { ok: false, error: "文件解析失败：" + e.message };
        }
    },

    /** 解析 xlsx 文件 */
    async parseXlsx(file) {
        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data, { type: "array" });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

            const questions = [];
            for (const row of rows) {
                if (!row || row.length < 3) continue;
                // 预期格式：[题号, 题型, 题干, 选项A, 选项B, ..., 答案, 解析]
                const q = this.parseXlsxRow(row);
                if (q) questions.push(q);
            }

            this.parsedQuestions = questions;
            return { ok: true, questions };
        } catch (e) {
            return { ok: false, error: "Excel 解析失败：" + e.message };
        }
    },

    /** 按题目编号拆分文本块 */
    splitQuestions(text) {
        // 匹配 "数字." 或 "数字、" 的题号模式
        const blocks = [];
        const parts = text.split(/(?=\d+\.\s*)/);
        for (const part of parts) {
            const trimmed = part.trim();
            if (trimmed && /^\d+\./.test(trimmed)) {
                blocks.push(trimmed);
            }
        }
        return blocks;
    },

    /** 解析单道题的文本块 */
    parseBlock(block) {
        // 判断题型
        let type = "single";
        if (/多选/.test(block)) type = "multiple";
        else if (/判断/.test(block)) type = "truefalse";
        else if (/填空/.test(block)) type = "fill";

        // 提取题干（题号后面的第一句话）
        const questionMatch = block.match(/^\d+\.\s*(.+?)(?:\s*[\[（(][单多判填][选断空].*?[\]）)]|\s*\*)/);
        const question = questionMatch ? questionMatch[1].trim() : "";

        // 提取选项：按 "A." "B." 等字母标记拆分
        const options = [];
        const optMatches = block.matchAll(/([A-I])\.\s*(.+?)(?=\s*[A-I]\.\s*|\s*\(?\s*正?确答案|$)/gi);
        for (const m of optMatches) {
            options.push(m[1] + ". " + m[2].trim());
        }

        // 提取正确答案
        let answer = [];
        const answerMatches = block.matchAll(/\(?\s*正确答案\s*\)?/gi);
        // 标记为"正确答案"的选项
        const correctLabels = [];
        const correctRe = /([A-I])\.\s*(.+?)\s*\(?\s*正确答案\s*\)?/gi;
        let cm;
        while ((cm = correctRe.exec(block)) !== null) {
            correctLabels.push(cm[1]);
        }

        // 判断题特殊处理
        if (type === "truefalse") {
            if (/对.*正确答案|正确.*正确答案/.test(block)) answer = [0];
            else if (/错.*正确答案|错误.*正确答案/.test(block)) answer = [1];
            options.length = 0;
            options.push("正确", "错误");
        } else if (type === "fill") {
            // 填空题答案在文本中
            const fillMatch = block.match(/\(正确答案\s*(.+?)\s*\)/);
            answer = fillMatch ? fillMatch[1].trim() : "";
        } else {
            // 选择题：将字母转为索引
            answer = correctLabels.map(label => label.charCodeAt(0) - 65);
        }

        // 提取解析
        const expMatch = block.match(/答案解析[：:]\s*(.+?)(?=\d+\.\s*|$)/);
        const explanation = expMatch ? expMatch[1].trim() : "";

        return {
            id: Date.now() + Math.random(),
            type,
            question: question || block.substring(0, 50) + "...",
            images: [],
            options: type === "fill" ? undefined : options,
            answer,
            explanation
        };
    },

    /** 解析 Excel 的一行数据 */
    parseXlsxRow(row) {
        // 跳过表头行
        if (String(row[0]).includes("题号") || String(row[0]).includes("序号")) return null;

        const typeMap = { "单选": "single", "多选": "multiple", "判断": "truefalse", "填空": "fill" };
        const type = typeMap[String(row[1])] || "single";

        const question = String(row[2] || "");
        const options = [];
        for (let i = 3; i < row.length - 2; i++) {
            if (row[i] && String(row[i]).trim()) {
                options.push(String(row[i]).trim());
            }
        }

        const answerRaw = String(row[row.length - 2] || "");
        let answer;
        if (type === "fill") {
            answer = answerRaw.trim();
        } else if (type === "truefalse") {
            answer = answerRaw.includes("对") || answerRaw.includes("正确") ? [0] : [1];
        } else {
            // 将答案字母转为索引
            answer = answerRaw.split(/[,，、]/).map(a => {
                const idx = a.trim().charCodeAt(0) - 65;
                return idx >= 0 && idx < 26 ? idx : -1;
            }).filter(i => i >= 0);
        }

        const explanation = String(row[row.length - 1] || "");

        return {
            id: Date.now() + Math.random(),
            type,
            question,
            images: [],
            options: type === "fill" ? undefined : options,
            answer,
            explanation
        };
    }
};
