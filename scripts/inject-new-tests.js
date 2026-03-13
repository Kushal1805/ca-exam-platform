import fs from 'fs';
import { mockTests as oldTests } from './src/data/mockTests.js';

const ecoData = JSON.parse(fs.readFileSync('Economics.json', 'utf8'));
const mathsData = JSON.parse(fs.readFileSync('Maths.json', 'utf8'));

const ecoTest = {
    id: "icai-economics-2026",
    subject: "Business Economics",
    title: "Business Economics - ICAI 2026",
    answerKeyPath: "/Papers/Answer keys/Business Economics Answer Key.pdf",
    marks: 100,
    durationMinutes: 120,
    questions: ecoData
};

const mathsTest = {
    id: "icai-maths-2026",
    subject: "Quantitative Aptitude",
    title: "Quantitative Aptitude - ICAI 2026",
    answerKeyPath: "/Papers/Answer keys/Quantitative Aptitude Answer Key.pdf",
    marks: 100,
    durationMinutes: 120,
    questions: mathsData
};

const combinedTests = [...oldTests, ecoTest, mathsTest];

const newMockTestsFileContent = `export const mockTests = ${JSON.stringify(combinedTests, null, 2)};`;

fs.writeFileSync('./src/data/mockTests.js', newMockTestsFileContent);
console.log("Updated mockTests.js with Business Economics and Quantitative Aptitude papers!");
