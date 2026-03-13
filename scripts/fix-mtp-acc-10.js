import fs from 'fs';
import { mockTests as existingTests } from '../src/data/mockTests.js';

const rawData = JSON.parse(fs.readFileSync('../extracted_data/MTP_ACC_10.json', 'utf8'));

// Filter out the hallucinated/extra "paper 2" (Business Law) questions
const accQuestionsList = rawData.filter(q => !q.id.includes('paper2'));

// Group questions by their main number (e.g., 'q1a', 'q1b' -> 'q1')
const groupedMap = {};

accQuestionsList.forEach(q => {
    // Extract base ID like 'q1' from 'q1a' or 'q5b_i'
    const match = q.id.match(/^(q\d+)/);
    if (!match) return;

    const baseId = match[1];

    // Determine the subpart letter/number from the ID to format nicely
    let subpartLabel = q.id.replace(baseId, ''); // e.g. 'a', 'b', 'b_i'
    if (subpartLabel) {
        if (subpartLabel.includes('_')) {
            // handle q4a_i -> a(i)
            const parts = subpartLabel.split('_');
            subpartLabel = `(${parts[0]})(${parts[1]})`;
        } else {
            subpartLabel = `(${subpartLabel})`;
        }
    } else {
        subpartLabel = '';
    }

    if (!groupedMap[baseId]) {
        groupedMap[baseId] = {
            id: baseId,
            text: `Question ${baseId.replace('q', '')}`,
            marks: 0,
            markingScheme: []
        };
    }

    // Append marks
    groupedMap[baseId].marks += q.marks || 0;

    // Append text with subpart label
    let questionText = q.text;
    if (questionText.startsWith('Constructed Question: ')) {
        questionText = questionText.replace('Constructed Question: ', '');
    }

    groupedMap[baseId].text += `\n\n--- Part ${subpartLabel} [${q.marks} Marks] ---\n${questionText}`;

    // Append marking scheme
    groupedMap[baseId].markingScheme.push(`\n[Marking for Part ${subpartLabel}]`);
    if (Array.isArray(q.markingScheme)) {
        groupedMap[baseId].markingScheme.push(...q.markingScheme);
    } else {
        groupedMap[baseId].markingScheme.push(q.markingScheme);
    }
});

const formattedQuestions = Object.values(groupedMap);

// Inject back into mockTests
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
console.log(`Successfully grouped MTP ACC-10 into ${formattedQuestions.length} main questions and updated mockTests.js!`);
