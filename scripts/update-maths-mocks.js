import fs from 'fs';
import { mockTests as existingTests } from './src/data/mockTests.js';

const mathsData = JSON.parse(fs.readFileSync('./Maths2.json', 'utf8'));

// Find and replace the Quantitative Aptitude test in the existing tests array
const updatedTests = existingTests.map(test => {
    if (test.id === "icai-maths-2026") {
        return {
            ...test,
            questions: mathsData // Replace the old option-less questions with the new ones
        };
    }
    return test;
});

const newMockTestsFileContent = `export const mockTests = ${JSON.stringify(updatedTests, null, 2)};`;

fs.writeFileSync('./src/data/mockTests.js', newMockTestsFileContent, 'utf8');
console.log("Successfully updated mockTests.js with Option-Rich Maths Data!");
