import fs from 'fs';
import { mockTests as oldTests } from '../src/data/mockTests.js';

const rawData = JSON.parse(fs.readFileSync('extracted_data/MTP_ACC_10.json', 'utf8'));

// Format questions (flatten marking schemes if complex, though the Gemini prompt output simple arrays)
const formattedQuestions = rawData.map(q => {
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
    } else {
        flatMarkingScheme = [q.markingScheme];
    }

    return {
        ...q,
        markingScheme: flatMarkingScheme
    };
});

const newTest = {
    id: "icai-mtp-acc-10",
    subject: "Accounts",
    title: "MTP ACC-10",
    answerKeyPath: "/Papers/Answer keys/MTP ACC-10 Answer key.pdf",
    marks: 100, // Typically Accounting papers are 100 or 120 marks
    durationMinutes: 180,
    questions: formattedQuestions
};

const combinedTests = [...oldTests, newTest];

const newMockTestsFileContent = `export const mockTests = ${JSON.stringify(combinedTests, null, 2)};`;

fs.writeFileSync('src/data/mockTests.js', newMockTestsFileContent);
console.log("Updated mockTests.js with MTP ACC-10 paper!");
