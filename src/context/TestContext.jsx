import React, { createContext, useContext, useState, useEffect } from 'react';

const TestContext = createContext();

export function TestProvider({ children }) {
    const [completedTests, setCompletedTests] = useState(() => {
        const saved = sessionStorage.getItem('ca-exam-completed-tests');
        return saved ? JSON.parse(saved) : [];
    });

    useEffect(() => {
        sessionStorage.setItem('ca-exam-completed-tests', JSON.stringify(completedTests));
    }, [completedTests]);

    const markTestCompleted = (testId) => {
        if (!completedTests.includes(testId)) {
            setCompletedTests(prev => [...prev, testId]);
        }
    };

    const isTestCompleted = (testId) => {
        return completedTests.includes(testId);
    };

    const value = {
        completedTests,
        markTestCompleted,
        isTestCompleted
    };

    return (
        <TestContext.Provider value={value}>
            {children}
        </TestContext.Provider>
    );
}

export function useTestContext() {
    return useContext(TestContext);
}
