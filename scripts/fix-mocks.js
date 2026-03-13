import fs from 'fs';

let mockTestsRaw = fs.readFileSync('./src/data/mockTests.js', 'utf8');
// remove the export const mockTests =  and the trailing semicolon
const jsonStr = mockTestsRaw.replace(/^export const mockTests = /, '').replace(/;$/, '');
let tests = JSON.parse(jsonStr);

// Filter out old dummy tests
tests = tests.filter(t => t.id.startsWith('icai-'));

// Update titles and marks
tests.forEach(t => {
    if (t.id === 'icai-accounting-2025') {
        t.title = "Accounting - ICAI 2026";
        t.marks = 100;
    } else if (t.id === 'icai-business-law-2025') {
        t.title = "Business Law - ICAI 2026";
        t.marks = 100;

        // Fix numbering for Business law questions based on ID if the text doesn't start with a number
        t.questions.forEach(q => {
            if (!q.text.match(/^\d+/)) {
                // convert 'q1a' to '1(a)'
                let match = q.id.match(/^q(\d+)([a-z]+)*/);
                if (match) {
                    let num = match[1];
                    let sub = match[2] ? `(${match[2]})` : '';
                    q.text = `${num}${sub}. ${q.text}`;
                }
            }
        });
    }
});

const newContent = `export const mockTests = ${JSON.stringify(tests, null, 2)};`;
fs.writeFileSync('./src/data/mockTests.js', newContent);
console.log("Cleaned and fixed mockTests.js");
