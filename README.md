# CA Practice PRO

A modern, AI-powered exam simulation platform designed for **CA Foundation** students preparing for ICAI exams. Practice with real ICAI question papers in a timed, exam-like environment and get your descriptive answers evaluated instantly by Google Gemini AI.

## ✨ Features

- 📝 **Real ICAI Question Papers** — Accounting, Business Law, Business Economics, Quantitative Aptitude, and MTP papers
- ⏱️ **Timed Exam Simulation** — Full 3-hour exam environment with question navigation palette
- 📸 **Upload Handwritten Answers** — Snap and upload your answer sheets (images/PDFs) per question
- 🤖 **AI-Powered Evaluation** — Google Gemini AI evaluates your answers against official marking schemes and provides detailed feedback, scores, and missed points
- 📊 **Instant Results** — Get question-wise scores, feedback, and the official answer for comparison
- 🎯 **MCQ & Descriptive Support** — Handles both multiple-choice and long-answer question formats

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite |
| Styling | Tailwind CSS |
| AI Evaluation | Google Gemini 2.5 Flash API |
| Data Extraction | Custom Node.js scripts + Gemini API |

## 🚀 Getting Started

1.  **Clone the repo**
    ```bash
    git clone https://github.com/Kushal1805/ca-exam-platform.git
    cd ca-exam-platform
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Set up your Gemini API key**
    - Copy `.env.template` to `.env.local`
    - Add your key: `VITE_GEMINI_API_KEY=your_key_here`

4.  **Start development server**
    ```bash
    npm run dev
    ```

## 📄 License

This project is for educational purposes only. Question papers and answer keys are sourced from ICAI's publicly available resources.
