import 'dotenv/config';
import fs from 'fs';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';

async function extractQuestions() {
    const apiKey = process.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
        console.error("No API key found in .env.local");
        process.exit(1);
    }

    const fileManager = new GoogleAIFileManager(apiKey);
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    try {
        console.log("Uploading file...");
        const uploadResult = await fileManager.uploadFile('Accounting.pdf', {
            mimeType: 'application/pdf',
            displayName: 'Accounting Exam',
        });
        console.log("Upload complete.");

        const prompt = `
Extract all the questions and their corresponding marking schemes from this exam paper.
Return the output EXACTLY as a JSON array in this format, picking out individual questions as distinct objects:
[
  {
    "id": "q1",
    "text": "Question 1 text...",
    "marks": 5,
    "markingScheme": [
      "Key point 1 expected in the answer",
      "Key point 2 expected in the answer"
    ]
  }
]
Do not return any markdown codeblocks or extra text. Return ONLY the JSON array.
If the marking scheme is not explicitly provided, generate a likely marking scheme based on standard ICAI expectations for the question.
`;

        console.log("Analyzing PDF with Gemini...");
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
        fs.writeFileSync('Accounting.json', JSON.stringify(questions, null, 2));
        console.log("Extracted Questions to Accounting.json successfully!");

        // Cleanup
        await fileManager.deleteFile(uploadResult.file.name);

    } catch (error) {
        console.error("Error analyzing PDF:", error);
    }
}

extractQuestions();
