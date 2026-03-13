import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Exam from './pages/Exam';
import { TestProvider } from './context/TestContext';

function App() {
    return (
        <TestProvider>
            <div className="min-h-screen bg-slate-50">
                <header className="bg-white shadow">
                    <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex items-center gap-4">
                        <img src="/logo.png" alt="CA Practice PRO Shield" className="h-14 w-auto drop-shadow-sm" />
                        <img src="/logo-text.png" alt="CA Practice PRO" className="h-10 w-auto drop-shadow-sm" />
                    </div>
                </header>
                <main>
                    <Routes>
                        <Route path="/" element={<Home />} />
                        <Route path="/exam/:testId" element={<Exam />} />
                    </Routes>
                </main>
            </div>
        </TestProvider>
    );
}

export default App;
