import fs from 'fs';
import { mockTests as existingTests } from '../src/data/mockTests.js';

const rawData = JSON.parse(fs.readFileSync('../extracted_data/MTP_ACC_10_FINAL.json', 'utf8'));

// Format questions (flatten marking schemes if complex)
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

    // Improve formatting if it's an array of strings
    if (flatMarkingScheme.length && typeof flatMarkingScheme[0] === 'string') {
        flatMarkingScheme = flatMarkingScheme.filter(Boolean);
    }

    return {
        ...q,
        markingScheme: flatMarkingScheme
    };
});

// Inject back into mockTests replacing the previous grouped one
const updatedTests = existingTests.map(test => {
    if (test.id === "icai-mtp-acc-10") {
        return {
            ...test,
            questions: formattedQuestions
        };
    }
    return test;
});

const newMockTestsFileContent = `export const mockTests = ${JSON.stringify(updatedTests, null, 2)};`;

fs.writeFileSync('../src/data/mockTests.js', newMockTestsFileContent, 'utf8');
console.log(`Successfully injected ${formattedQuestions.length} full sub-questions into MTP ACC-10 and updated mockTests.js!`);
