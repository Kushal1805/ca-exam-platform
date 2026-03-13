import fs from 'fs';

const rawData = JSON.parse(fs.readFileSync('Accounting.json', 'utf8'));

// Format questions
const formattedQuestions = rawData.map(q => {
    // Flatten marking scheme objects into an array of strings
    let flatMarkingScheme = [];
    if (Array.isArray(q.markingScheme)) {
        if (typeof q.markingScheme[0] === 'object') {
            q.markingScheme.forEach(part => {
                flatMarkingScheme.push(`Part ${part.part || ''} (${part.marks || 0} Marks):`);
                if (Array.isArray(part.details)) {
                    flatMarkingScheme.push(...part.details);
                } else if (typeof part.details === 'string') {
                    flatMarkingScheme.push(part.details);
                }
            });
        } else {
            flatMarkingScheme = q.markingScheme;
        }
    }

    return {
        id: q.id,
        text: q.text,
        marks: q.marks,
        markingScheme: flatMarkingScheme
    };
});

const newTest = {
    id: "icai-accounting-2025",
    subject: "Accounts",
    title: "ICAI Accounting Recent Exam Paper",
    marks: 120, // Sum of the marks
    durationMinutes: 180,
    questions: formattedQuestions
};

// Also keep the old tests
import { mockTests as oldTests } from './src/data/mockTests.js';

const combinedTests = [...oldTests, newTest];

const newMockTestsFileContent = `export const mockTests = ${JSON.stringify(combinedTests, null, 2)};`;

fs.writeFileSync('./src/data/mockTests.js', newMockTestsFileContent);
console.log("Updated mockTests.js with new Accounting paper!");
