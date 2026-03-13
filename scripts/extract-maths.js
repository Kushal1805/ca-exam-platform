import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import fs from 'fs';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';

const apiKey = process.env.VITE_GEMINI_API_KEY;
const fileManager = new GoogleAIFileManager(apiKey);
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

async function extractMaths() {
    const pdfPath = 'public/Papers/Answer keys/Quantitative Aptitude Answer Key.pdf';
    const outputJson = 'Maths2.json';
    try {
        console.log(`Uploading ${pdfPath}...`);
        const uploadResult = await fileManager.uploadFile(pdfPath, {
            mimeType: 'application/pdf',
            displayName: pdfPath,
        });
        console.log("Upload complete.");

        const prompt = `
You are analyzing an official CA Exam Answer Key document for Quantitative Aptitude.
Your task is to meticulously extract ALL the original Exam Questions, INCLUDING all 4 options (A), (B), (C), (D) for each question, and the final answer key letter.
The provided PDF DOES contain the options (A, B, C, D) alongside the questions. You MUST include them in the 'text' field.
Return the output EXACTLY as a JSON array in this format:
[
  {
    "id": "q1",
    "text": "1. The value of x in logx(4) +logx(16) + logx(64) = 12 is\\n(A) 1\\n(B) 2\\n(C) 3\\n(D) 4",
    "marks": 1,
    "markingScheme": [
      "Option (A)"
    ]
  }
]
Do not return any markdown codeblocks. Return ONLY the JSON array.
CRITICAL: You MUST include the full question text AND the (A) (B) (C) (D) choices precisely as they appear in the uploaded document. If the document has a table or equations, transcribe them clearly.
`;

        console.log("Analyzing Answer Key PDF with Gemini...");
        const result = await model.generateContent([
            {
                fileData: {
                    fileUri: uploadResult.file.uri,
                    mimeType: uploadResult.file.mimeType
                }
            },
            prompt
        ]);
        const responseText = result.response.text();

        let jsonStr = responseText.trim();
        if (jsonStr.startsWith('```json')) jsonStr = jsonStr.substring(7);
        if (jsonStr.startsWith('```')) jsonStr = jsonStr.substring(3);
        if (jsonStr.endsWith('```')) jsonStr = jsonStr.substring(0, jsonStr.length - 3);

        const questions = JSON.parse(jsonStr.trim());
        fs.writeFileSync(outputJson, JSON.stringify(questions, null, 2));
        console.log(`Extracted Questions to ${outputJson} successfully! (${questions.length} questions)`);

        await fileManager.deleteFile(uploadResult.file.name);
    } catch (error) {
        console.error("Error analyzing PDF:", error);
    }
}

extractMaths();
