const fs = require('fs');
const pdf = require('pdf-parse');

const dataBuffer = fs.readFileSync('Accounting.pdf');

const pdfFunction = typeof pdf === 'function' ? pdf : pdf.default;

pdfFunction(dataBuffer).then(function (data) {
    fs.writeFileSync('Accounting.txt', data.text);
    console.log("PDF text extracted to Accounting.txt");
}).catch(function (error) {
    console.error("Error parsing PDF:", error);
});
