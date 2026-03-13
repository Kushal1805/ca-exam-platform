import fs from 'fs';

const economicsData = JSON.parse(fs.readFileSync('./Economics.json', 'utf8'));

console.log("Testing Regex on Question 1:\n");
const qText = economicsData[0].text;
console.log("RAW TEXT:\n", qText);
console.log("\n--- EXTRACTING ---");

['A', 'B', 'C', 'D'].forEach(option => {
    // Regex logic from Exam.jsx
    const optionRegex = new RegExp(`\\(${option.toLowerCase()}\\)[ \\t]*([\\s\\S]*?)(?=\\n\\s*\\([a-d]\\)|$)`, 'i');
    const match = qText.match(optionRegex);
    const optionText = match ? match[1].trim() : '';
    console.log(`Option ${option} Extracted:`, optionText);
});
