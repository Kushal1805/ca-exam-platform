import fs from 'fs';
import { mockTests } from '../src/data/mockTests.js';

const correctedData = JSON.parse(fs.readFileSync('../extracted_data/Accounting_2025_Corrected.json', 'utf8'));

// Update the specific test
const testId = 'icai-accounting-2025';
const testIndex = mockTests.findIndex(t => t.id === testId);

if (testIndex !== -1) {
    correctedData.forEach(correctedQ => {
        const qIndex = mockTests[testIndex].questions.findIndex(q => q.id === correctedQ.id);
        if (qIndex !== -1) {
            mockTests[testIndex].questions[qIndex].markingScheme = correctedQ.markingScheme;
        }
    });

    const fileContent = `export const mockTests = ${JSON.stringify(mockTests, null, 2)};`;
    fs.writeFileSync('../src/data/mockTests.js', fileContent, 'utf8');
    console.log(`Successfully updated marking schemes for ${testId}`);
} else {
    console.error(`Could not find test with ID ${testId}`);
}
