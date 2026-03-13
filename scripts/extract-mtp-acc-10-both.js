import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import fs from "fs";
import dotenv from "dotenv";

// Load environment variables from .env.local
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
    console.log(`Uploaded file ${file.displayName} as: ${file.name}`);
    return file;
}

async function run() {
    try {
        console.log("Uploading Question Paper...");
        const questionFileResult = await uploadToGemini('../public/Papers/Question paper/MTP ACC-10 Question.pdf', 'application/pdf');

        console.log("Uploading Answer Key...");
        const answerFileResult = await uploadToGemini('../public/Papers/Answer keys/MTP ACC-10 Answer key.pdf', 'application/pdf');

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const prompt = `
You are an expert CA educational content extractor. I have provided you with TWO PDFs:
1. The Question Paper for an Accounting exam.
2. The Answer Key / Marking Scheme for that same exam.

Your task is to extract ALL Questions from the Question Paper, AND match them with their corresponding Marking Scheme from the Answer Key.

OUTPUT REQUIREMENTS:
- Return ONLY a raw JSON array.
- Do NOT wrap in \`\`\`json or \`\`\` blocks. Just start with [ and end with ].
- ONLY extract the "Accounting" or "Accounts" section. If there is a "Business Law" or "Law" section, IGNORE IT COMPLETELY.

For EVERY individual sub-question (like 1a, 1b, 1c, 2(a), 2(b)(i), etc.), I want a SEPARATE object in the JSON array.
If a question has subparts, do NOT group them. So if Question 1 has part (a), (b), (c), create three objects with IDs "q1a", "q1b", "q1c".
If Question 5 has part (b) which has (i) and (ii), create IDs "q5b_i" and "q5b_ii".

Each object must follow exactly this structure:
{
  "id": "q1a", // The exact question number and sub-part identifier (e.g. q1a, q3b, q4a_i)
  "text": "The FULL, EXACT text of Question 1(a) copied identically from the Question Paper. DO NOT summarize.",
  "marks": 6, // The number of marks allotted to this sub-question (usually found in brackets like [6 Marks]).
  "markingScheme": [
      "Step 1: The first point from the Answer Key for this specific sub-question.",
      "Step 2: The second point from the Answer Key..."
  ] // The exact marking scheme points text extracted from the Answer Key for this sub-question.
}

CRITICAL: 
- The "text" field MUST contain the FULL question text from the Question Paper. Do NOT summarize or abbreviate. 
- The "markingScheme" MUST be an array of strings, where each string is a paragraph or point from the Answer Key corresponding to this sub-question.
        `;

        console.log("Sending prompt to Gemini with both PDFs...");
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

        const responseText = result.response.text();

        let cleanedJsonText = responseText.trim();
        if (cleanedJsonText.startsWith('\`\`\`json')) {
            cleanedJsonText = cleanedJsonText.replace(/^\`\`\`json\n/, '').replace(/\n\`\`\`$/, '');
        } else if (cleanedJsonText.startsWith('\`\`\`')) {
            cleanedJsonText = cleanedJsonText.replace(/^\`\`\`\n/, '').replace(/\n\`\`\`$/, '');
        }

        // Validate JSON
        const parsedJson = JSON.parse(cleanedJsonText);

        // Save to file
        fs.writeFileSync('../extracted_data/MTP_ACC_10_FULL.json', JSON.stringify(parsedJson, null, 2), 'utf8');
        console.log("Successfully saved full extracted data to ../extracted_data/MTP_ACC_10_FULL.json");

    } catch (error) {
        console.error("Error during extraction:", error);
    }
}

run();
