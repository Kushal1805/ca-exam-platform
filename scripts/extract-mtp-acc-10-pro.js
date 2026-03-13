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
        const questionFileResult = await uploadToGemini('../public/Papers/Question paper/MTP ACC-10 Question.pdf', 'application/pdf');

        console.log("Uploading Answer Key...");
        const answerFileResult = await uploadToGemini('../public/Papers/Answer keys/MTP ACC-10 Answer key.pdf', 'application/pdf');

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); // Using Flash model with strict prompt

        const prompt = `
You are an expert CA educational content extractor. You MUST extract the Accounting exam questions exactly as they appear in the original Question Paper, preserving EVERY SINGLE newline, tabulation, and formatting nuance.

I have provided TWO PDFs:
1. The Question Paper for an Accounting exam.
2. The Answer Key for that same exam.

Strict Rules for the JSON extraction:
1. Extract ONLY the Accounting section. Ignore Business Law.
2. Output a raw JSON array of objects. Do not use markdown wrappers like \`\`\`json.
3. **DO NOT OVER-FRAGMENT**. Only separate questions down to the letter sub-part (e.g. 1(a), 1(b), 1(c)). Do NOT separate roman numerals (i, ii, iii) into their own objects. If 2(a) has sub-points (i) through (viii), keep them ALL inside the "text" field of "q2a".
4. **ID Format**: Should be exactly like "q1a", "q1b", "q2a", "q2b".
5. **Text Formatting**: The "text" field MUST literally perfectly replicate the exact visual layout of the Question Paper. Use \`\\n\` to preserve spacing and paragraphs! Include the prefix like "1. (a) " or "(b) ". 
6. **Marking Scheme**: Extract the Answer Key points corresponding to the specific sub-part. Use an array of strings.

Example Structure I expect:
[
  {
    "id": "q1a",
    "text": "1. (a) State with reasons, whether the following statements are True or False:\\n(i) Money spent to reduce working expenses is Revenue Expenditure.\\n(ii) Transactions regarding the purchase of fixed assets on credit are recorded in the purchase book.\\n(iii) ...",
    "marks": 12,
    "markingScheme": [
      "Point 1...",
      "Point 2..."
    ]
  },
  {
    "id": "q1b",
    "text": "(b) Differentiate between Book-keeping and Accounting.",
    "marks": 4,
    "markingScheme": [ ... ]
  }
]

Do not abbreviate. Ensure the text has the correct line breaks exactly as in the PDF. Include the 1(a), (b), (c) inside the text!
        `;

        console.log("Sending prompt to Gemini with both PDFs using PRO model...");
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
        fs.writeFileSync('../extracted_data/MTP_ACC_10_FINAL.json', JSON.stringify(parsedJson, null, 2), 'utf8');
        console.log("Successfully saved perfectly formatted extracted data to ../extracted_data/MTP_ACC_10_FINAL.json");

    } catch (error) {
        console.error("Error during extraction:", error);
    }
}

run();
