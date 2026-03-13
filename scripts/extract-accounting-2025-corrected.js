import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config({ path: '../.env.local' });

const apiKey = process.env.VITE_GEMINI_API_KEY;

if (!apiKey) {
    console.error("Error: VITE_GEMINI_API_KEY is not defined in .env.local");
    process.exit(1);
}

const fileManager = new GoogleAIFileManager(apiKey);
const genAI = new GoogleGenerativeAI(apiKey);

async function uploadToGemini(path, mimeType) {
    const uploadResult = await fileManager.uploadFile(path, {
        mimeType,
        displayName: path.split('/').pop(),
    });
    const file = uploadResult.file;
    return file;
}

async function run() {
    try {
        console.log("Uploading Question Paper...");
        const questionFileResult = await uploadToGemini('../public/Papers/Question paper/Accounting.pdf', 'application/pdf');

        console.log("Uploading Corrected Answer Key...");
        const answerFileResult = await uploadToGemini('../public/Papers/Answer keys/Accounting Correct Answer Key.pdf', 'application/pdf');

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const prompt = `
You are an expert CA educational content extractor. You MUST extract the Accounting exam answers exactly as they appear in the original Corrected Answer Key, preserving EVERY SINGLE newline, tabulation, and formatting nuance.

I have provided TWO PDFs:
1. The Question Paper for the Accounting - ICAI 2026 exam.
2. The Corrected Answer Key for that same exam.

Strict Rules for the JSON extraction:
1. Extract the full marking scheme/answer data for ever question in the Question Paper.
2. Output a raw JSON array of objects.
3. **DO NOT OVER-FRAGMENT**. Group the answers exactly like the Question Paper (e.g. q1, q2, q3, q4, q5, q6). Note: If the question has sub-parts a, b, c, keep them together in the marking scheme array for that major question ID.
4. **ID Format**: Should be "q1", "q2", "q3", etc., matching the IDs in my mockTests.js.
5. **Marking Scheme**: The "markingScheme" field should be an array of strings. Each string should contain the actual solved answer text, including step-by-step calculations and details from the Answer Key, formatted with \\n for readability.

Example Structure I expect:
[
  {
    "id": "q1",
    "markingScheme": [
      "(a) State with reasons...\\n(i) False - ...\\n(ii) True - ...",
      "(b) Accounting Standards are...\\nAdvantages: ...\\nLimitations: ...",
      "(c) Journal Entries:\\n(i) Ramsons A/c... Dr ...\\n(ii) ... "
    ]
  }
]
`;

        console.log("Sending prompt to Gemini...");
        const result = await model.generateContent([
            {
                fileData: {
                    mimeType: questionFileResult.mimeType,
                    fileUri: questionFileResult.uri
                }
            },
            {
                fileData: {
                    mimeType: answerFileResult.mimeType,
                    fileUri: answerFileResult.uri
                }
            },
            { text: prompt }
        ]);

        let responseText = result.response.text();

        let cleanedJsonText = responseText.trim();
        if (cleanedJsonText.startsWith('\`\`\`json')) {
            cleanedJsonText = cleanedJsonText.replace(/^\`\`\`json\n/, '').replace(/\n\`\`\`$/, '');
        } else if (cleanedJsonText.startsWith('\`\`\`')) {
            cleanedJsonText = cleanedJsonText.replace(/^\`\`\`\n/, '').replace(/\n\`\`\`$/, '');
        }

        const parsedJson = JSON.parse(cleanedJsonText);
        fs.writeFileSync('../extracted_data/Accounting_2025_Corrected.json', JSON.stringify(parsedJson, null, 2), 'utf8');
        console.log("Successfully saved corrected extracted data to ../extracted_data/Accounting_2025_Corrected.json");

    } catch (error) {
        console.error("Error during extraction:", error);
    }
}

run();
