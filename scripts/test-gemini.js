import 'dotenv/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

async function testConnection() {
    const apiKey = process.env.VITE_GEMINI_API_KEY;
    const genAI = new GoogleGenerativeAI(apiKey);

    const models = ["gemini-1.5-flash", "gemini-1.5-flash-latest", "gemini-1.5-pro", "gemini-pro", "models/gemini-1.5-flash"];

    for (const modelName of models) {
        try {
            console.log(\`Testing model: \${modelName}\`);
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent("Say hello world");
      console.log(\`Success with \${modelName}: \${result.response.text()}\`);
      break;
    } catch (err) {
      console.log(\`Failed with \${modelName}: \${err.message}\`);
    }
  }
}

testConnection();
