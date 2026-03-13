import fs from 'fs';
import pdf from 'pdf-parse';

async function parse() {
    try {
        const dataBuffer = fs.readFileSync('Accounting.pdf');
        const data = await pdf(dataBuffer);
        fs.writeFileSync('Accounting.txt', data.text);
        console.log("PDF text extracted to Accounting.txt");
    } catch (err) {
        console.error("Error:", err);
    }
}

parse();
