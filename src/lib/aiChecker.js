import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Core Logic for Gemini AI API Call
 */

export async function evaluateAnswersWithGemini(test, answersMap) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("Gemini API Key is not configured. Please add VITE_GEMINI_API_KEY to your .env.local file.");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  // Using gemini-2.5-flash as the latest standard model
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  // Building prompt parts for multimodal input
  const parts = [];

  const systemInstructions = `
You are an expert CA (Chartered Accountant) Examiner evaluating a student's entire exam paper based strictly on ICAI standards.
You will be provided with a compiled list of Questions, their Official Marking Schemes, and the User's uploaded answer images/documents.
Your task is to evaluate all the answers relative to their specific marking schemes, sum up the scores, and return a single cumulative evaluation in pure JSON format precisely matching this structure:
\`\`\`json
{
  "totalScore": "Total Score achieved / Total Maximum Marks (e.g. 14/25)",
  "overallFeedback": "A short 1-2 sentence overall summary of the student's performance.",
  "questionEvaluations": {
    "<INSERT_EXACT_QUESTION_ID_HERE>": {
      "status": "Correct" | "Wrong" | "Partial" | "Empty",
      "marksObtained": 4,
      "feedback": "Specific feedback for this question.",
      "missedPoints": ["Failed to mention Cash Flow Statement as a mandatory component."],
      "officialAnswerExtracted": "The exact wording, step-by-step solution, or a strict comprehensive summary of the answer extracted directly from the Official Answer Key PDF for this specific question (if available). IMPORTANT: If the official answer contains tables or tabular data, you MUST format it exactly using standard Markdown Table syntax (e.g., using | Column | Column |)."
    }
  }
}
\`\`\`
CRITICAL: The keys inside "questionEvaluations" MUST exactly match the "Question ID" provided in the compiled list for each question. Do not invent your own keys like "q1" unless that is the exact Question ID.
The "status" MUST be one of: "Correct", "Wrong", "Partial", or "Empty" (if the user provided no meaningful answer).
Do not include any prefix or suffix text outside the JSON block. Return ONLY the JSON.
`;
  parts.push({ text: systemInstructions });

  parts.push({ text: `Here is the student's exam paper to evaluate:\n` });

  test.questions.forEach((q, index) => {
    let qText = `\n--- Question ID: ${q.id} | Question ${index + 1} (${q.marks} Marks) ---\n` +
      `Q: ${q.text}\n` +
      `Official Marking Scheme: ${q.markingScheme.join(', ')}\n` +
      `User's Answer (Images/Documents follow):\n`;
    parts.push({ text: qText });

    const userAnswers = answersMap[q.id];
    if (typeof userAnswers === 'string') {
      parts.push({ text: `User selected option: ${userAnswers}\n` });
    } else if (userAnswers && userAnswers.length > 0) {
      userAnswers.forEach((file) => {
        parts.push({
          inlineData: {
            data: file.data,
            mimeType: file.mimeType
          }
        });
      });
      parts.push({ text: "\n" });
    } else {
      parts.push({ text: "No answer provided.\n" });
    }
  });

  parts.push({ text: `\nTotal Marks for Exam: ${test.marks}\n` });

  console.log("--- Gemini Payload Parts Size ---", parts.length);
  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts }],
      generationConfig: {
        responseMimeType: "application/json",
      }
    });

    const responseText = result.response.text();

    // Clean up the response to extract just the JSON
    // Sometimes the model wraps it in markdown code blocks like ```json ... ```
    let jsonStr = responseText.trim();
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.substring(7);
      if (jsonStr.endsWith('```')) {
        jsonStr = jsonStr.substring(0, jsonStr.length - 3);
      }
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.substring(3);
      if (jsonStr.endsWith('```')) {
        jsonStr = jsonStr.substring(0, jsonStr.length - 3);
      }
    }

    return JSON.parse(jsonStr.trim());
  } catch (error) {
    console.error("Error communicating with Gemini API:", error);
    throw error;
  }
}
