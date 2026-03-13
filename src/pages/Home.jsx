import React from 'react';
import { Link } from 'react-router-dom';
import { mockTests } from '../data/mockTests';
import { useTestContext } from '../context/TestContext';
import { Clock, BookOpen, CheckCircle } from 'lucide-react';

export default function Home() {
    const { isTestCompleted } = useTestContext();

    return (
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            <div className="mb-8">
                <h2 className="text-2xl font-bold text-slate-800">Available Mock Tests</h2>
                <p className="text-slate-600 mt-2">Select a test to begin your CA exam practice.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {mockTests.map((test) => {
                    const completed = isTestCompleted(test.id);
                    return (
                        <div key={test.id} className="bg-white overflow-hidden shadow rounded-lg border border-slate-200 flex flex-col hover:shadow-md transition-shadow">
                            <div className="p-5 flex-1">
                                <div className="flex justify-between items-start mb-4">
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                        {test.subject}
                                    </span>
                                    {completed && (
                                        <span className="flex items-center text-green-600 text-sm font-medium">
                                            <CheckCircle className="w-5 h-5 mr-1" />
                                            Completed
                                        </span>
                                    )}
                                </div>
                                <h3 className="text-lg font-medium text-slate-900">{test.title}</h3>
                                <div className="mt-4 flex flex-col gap-2 text-sm text-slate-500">
                                    <div className="flex items-center gap-2">
                                        <Clock className="w-4 h-4" />
                                        <span>{test.durationMinutes} minutes</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <BookOpen className="w-4 h-4" />
                                        <span>{test.marks} marks</span>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-slate-50 px-5 py-3 border-t border-slate-200">
                                <Link
                                    to={`/exam/${test.id}`}
                                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                                >
                                    {completed ? 'Review / Retake Exam' : 'Start Exam'}
                                </Link>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
