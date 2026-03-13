import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import fs from 'fs';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';

const apiKey = process.env.VITE_GEMINI_API_KEY;
const fileManager = new GoogleAIFileManager(apiKey);
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

async function extractQuestionsFromKey(pdfPath, outputJson) {
    try {
        console.log(`Uploading ${pdfPath}...`);
        const uploadResult = await fileManager.uploadFile(pdfPath, {
            mimeType: 'application/pdf',
            displayName: pdfPath,
        });
        console.log("Upload complete.");

        const prompt = `
You are analyzing an official CA Exam Answer Key document for Accounting (MTP ACC 10).
Your task is to infer and extract all the original Exam Questions based on this answer key, and also extract the official marking scheme / answer details for each question.
Since this is an Answer Key, the question text itself might be missing or partial. You must cleverly reconstruct the question intent, or explicitly write "Constructed Question: [Topic Area]" based on the answer.
Return the output EXACTLY as a JSON array in this format, picking out individual questions as distinct objects:
[
  {
    "id": "q1",
    "text": "1. (a) Reconstructed or extracted question text here. Make sure to preserve tabulations and text spacing perfectly.",
    "marks": 5,
    "markingScheme": [
      "Extracted official answer key point 1",
      "Extracted official answer key point 2"
    ]
  }
]
Do not return any markdown codeblocks or extra text. Return ONLY the JSON array.
If the marks are not explicitly stated next to the question in the key, estimate the marks based on standard ICAI weighting for the length of the answer.
Remember: "id" should be "q1", "q2a", "q2b" etc depending on the grouping format of the paper (e.g. 1(a), 1(b) becomes q1a, q1b).
CRITICAL: Extract all questions present in the document.
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
        console.log(`Extracted Questions to ${outputJson} successfully!`);

        // Cleanup
        await fileManager.deleteFile(uploadResult.file.name);

    } catch (error) {
        console.error("Error analyzing PDF:", error);
    }
}

async function main() {
    await extractQuestionsFromKey('public/Papers/Answer keys/MTP ACC-10 Answer key.pdf', 'extracted_data/MTP_ACC_10.json');
}

main();
