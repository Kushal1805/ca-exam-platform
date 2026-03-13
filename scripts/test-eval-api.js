import { GoogleGenerativeAI } from "@google/generative-ai";
import { mockTests } from "../src/data/mockTests.js";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config({ path: '../.env.local' });

const apiKey = process.env.VITE_GEMINI_API_KEY;

if (!apiKey) {
    console.error("No API key");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

async function runTest() {
    const test = mockTests.find(t => t.id === 'icai-mtp-acc-10');

    const parts = [];
    const systemInstructions = `... system instructions ...`;
    parts.push({ text: systemInstructions });

    // Mock answerKey file reading
    if (test.answerKeyPath) {
        try {
            const pdfPath = '../public' + test.answerKeyPath;
            const pdfBuffer = fs.readFileSync(pdfPath);
            const base64Data = pdfBuffer.toString('base64');
            parts.push({ text: "\n--- OFFICIAL ANSWER KEY DOCUMENT BEGINS --- \n" });
            parts.push({
                inlineData: {
                    data: base64Data,
                    mimeType: "application/pdf"
                }
            });
            parts.push({ text: "\n--- OFFICIAL ANSWER KEY DOCUMENT ENDS --- \n" });
        } catch (e) { console.error("Could not read pdf", e); }
    }

    test.questions.forEach((q, index) => {
        let qText = `\n--- Question ID: ${q.id} | Question ${index + 1} (${q.marks} Marks) ---\n` +
            `Q: ${q.text}\n` +
            `Official Marking Scheme: ${q.markingScheme.join(', ')}\n`;
        parts.push({ text: qText });
        parts.push({ text: "No answer provided.\n" });
    });

    parts.push({ text: `\nTotal Marks for Exam: ${test.marks}\n` });

    console.log("Sending payload of length:", parts.length);
    try {
        const result = await model.generateContent({
            contents: [{ role: "user", parts }],
            generationConfig: {
                responseMimeType: "application/json",
            }
        });

        let jsonStr = result.response.text().trim();
        console.log("Response starts with:", jsonStr.substring(0, 30));

        console.log("Response text length:", jsonStr.length);
        const parsed = JSON.parse(jsonStr.trim());
        console.log("Success! Parsed JSON correctly. Found question evaluations:", Object.keys(parsed.questionEvaluations || {}).length);
    } catch (e) {
        console.error("API or Parse Error details:", e);
    }
}

runTest();
