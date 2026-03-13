import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { mockTests } from '../data/mockTests';
import { useTestContext } from '../context/TestContext';
import { evaluateAnswersWithGemini } from '../lib/aiChecker';
import { Clock, AlertCircle, ChevronLeft, ChevronRight, Send, CheckCircle, XCircle, MinusCircle, HelpCircle } from 'lucide-react';

export default function Exam() {
    const { testId } = useParams();
    const navigate = useNavigate();
    const { markTestCompleted } = useTestContext();

    const test = mockTests.find(t => t.id === testId);

    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState({});
    const [timeLeft, setTimeLeft] = useState(test ? test.durationMinutes * 60 : 0);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // evaluation holds the parsed JSON response from Gemini
    const [evaluation, setEvaluation] = useState(null);

    // View mode navigation: 'exam' | 'summary' | 'review'
    const [viewMode, setViewMode] = useState('exam');
    const [reviewQuestionId, setReviewQuestionId] = useState(null);

    useEffect(() => {
        if (!test) return;

        const initialAnswers = {};
        test.questions.forEach(q => { initialAnswers[q.id] = ''; });
        setAnswers(initialAnswers);

        const timer = setInterval(() => {
            setTimeLeft(prev => {
                // Only run timer if we are still taking the exam
                if (viewMode !== 'exam') return prev;

                if (prev <= 1) {
                    clearInterval(timer);
                    if (!evaluation && !isSubmitting) {
                        handleSubmit(initialAnswers);
                    }
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [test, viewMode, evaluation, isSubmitting]);

    if (!test) {
        return <div className="p-8 text-center text-red-500">Test not found!</div>;
    }

    const formatTime = (seconds) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        if (h > 0) return `${h}h ${m}m ${s}s`;
        return `${m}m ${s}s`;
    };

    const currentQuestion = test.questions[currentQuestionIndex];
    const isLastQuestion = currentQuestionIndex === test.questions.length - 1;

    const handleAnswerChange = (e) => {
        setAnswers(prev => ({
            ...prev,
            [currentQuestion.id]: e.target.value
        }));
    };

    const handleNext = () => {
        if (!isLastQuestion) setCurrentQuestionIndex(prev => prev + 1);
    };

    const handlePrev = () => {
        if (currentQuestionIndex > 0) setCurrentQuestionIndex(prev => prev - 1);
    };

    const handleSubmit = async (currentAnswersFallback = null) => {
        const finalAnswers = currentAnswersFallback || answers;

        setIsSubmitting(true);
        try {
            const result = await evaluateAnswersWithGemini(test, finalAnswers);
            setEvaluation(result);
            markTestCompleted(test.id);
            setViewMode('summary');
        } catch (error) {
            console.error('Submission error:', error);
            alert('Failed to evaluate answer. Please ensure your Gemini API Key is set in .env.local and try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const getStatusConfig = (status) => {
        switch (status) {
            case 'Correct': return { color: 'text-green-600', bg: 'bg-green-100', border: 'border-green-300', icon: CheckCircle };
            case 'Wrong': return { color: 'text-red-600', bg: 'bg-red-100', border: 'border-red-300', icon: XCircle };
            case 'Partial': return { color: 'text-amber-600', bg: 'bg-amber-100', border: 'border-amber-300', icon: MinusCircle };
            case 'Empty':
            default: return { color: 'text-slate-500', bg: 'bg-slate-100', border: 'border-slate-300', icon: HelpCircle };
        }
    };

    // ------------- RENDER EXAM MODE -------------
    if (viewMode === 'exam') {
        return (
            <div className="max-w-screen-2xl mx-auto h-[calc(100vh-88px)] flex flex-col bg-slate-100">
                {/* Exam Header */}
                <div className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shadow-sm z-10 shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">{test.title}</h2>
                        <span className="text-sm text-slate-500">{test.subject} • {test.marks} marks</span>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="flex gap-2 items-center overflow-x-auto max-w-md p-1">
                            {test.questions.map((q, idx) => (
                                <button
                                    key={q.id}
                                    onClick={() => setCurrentQuestionIndex(idx)}
                                    className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${currentQuestionIndex === idx
                                        ? 'bg-blue-600 text-white'
                                        : answers[q.id]?.trim()
                                            ? 'bg-green-100 text-green-700 border border-green-200'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                >
                                    {idx + 1}
                                </button>
                            ))}
                        </div>

                        <div className={`flex shrink-0 items-center gap-2 px-4 py-2 rounded-full font-mono font-bold ${timeLeft < 300 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'}`}>
                            <Clock className="w-5 h-5" />
                            {formatTime(timeLeft)}
                        </div>
                        <button
                            onClick={() => navigate('/')}
                            className="text-sm shrink-0 text-slate-600 hover:text-slate-900 underline"
                        >
                            Exit Exam
                        </button>
                    </div>
                </div>

                {/* Split Screen Content */}
                <div className="flex flex-1 overflow-hidden">
                    <div className="w-1/2 border-r border-slate-300 bg-white overflow-y-auto p-8 shadow-inner flex flex-col">
                        <div className="flex justify-between items-center mb-6 border-b pb-4">
                            <h3 className="text-lg font-semibold text-slate-800">
                                Question {currentQuestionIndex + 1} of {test.questions.length}
                            </h3>
                            <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-md text-sm font-medium">
                                {currentQuestion.marks} Marks
                            </span>
                        </div>
                        <div className="prose max-w-none text-slate-800 whitespace-pre-wrap flex-1 text-lg">
                            {currentQuestion.text}
                        </div>
                    </div>

                    <div className="w-1/2 bg-slate-50 flex flex-col p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold text-slate-800">Your Answer</h3>
                        </div>

                        <textarea
                            value={answers[currentQuestion.id] || ''}
                            onChange={handleAnswerChange}
                            disabled={isSubmitting}
                            placeholder="Type your descriptive answer for this question here..."
                            className="flex-1 w-full p-6 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none shadow-sm disabled:bg-slate-100 text-base"
                        ></textarea>

                        {/* Navigation & Submit Footer */}
                        <div className="mt-6 flex justify-between items-center">
                            <button
                                onClick={handlePrev}
                                disabled={currentQuestionIndex === 0 || isSubmitting}
                                className="flex items-center gap-2 px-6 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-md font-medium hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                            >
                                <ChevronLeft className="w-4 h-4" /> Previous
                            </button>

                            {!isLastQuestion ? (
                                <button
                                    onClick={handleNext}
                                    disabled={isSubmitting}
                                    className="flex items-center gap-2 px-6 py-2.5 bg-slate-800 text-white rounded-md font-medium hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                                >
                                    Next <ChevronRight className="w-4 h-4" />
                                </button>
                            ) : (
                                <button
                                    onClick={() => handleSubmit(answers)}
                                    disabled={isSubmitting}
                                    className="flex items-center gap-2 px-8 py-2.5 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-md"
                                >
                                    {isSubmitting ? 'Evaluating with Gemini...' : 'Submit Exam for AI Evaluation'}
                                    {!isSubmitting && <Send className="w-4 h-4 ml-1" />}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ------------- RENDER SUMMARY MODE -------------
    if (viewMode === 'summary') {
        const scoreMatch = evaluation.totalScore?.match(/(\d+)\/(\d+)/);
        const scoreVal = scoreMatch ? parseInt(scoreMatch[1]) : 0;
        const maxScoreVal = scoreMatch ? parseInt(scoreMatch[2]) : test.marks;
        const percentage = maxScoreVal > 0 ? Math.round((scoreVal / maxScoreVal) * 100) : 0;

        let gradeColor = 'text-green-600';
        if (percentage < 40) gradeColor = 'text-red-600';
        else if (percentage < 60) gradeColor = 'text-amber-600';

        return (
            <div className="max-w-5xl mx-auto py-12 px-6 h-full overflow-y-auto">
                <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
                    <div className="p-8 text-center bg-slate-50 border-b border-slate-200">
                        <AlertCircle className="w-16 h-16 mx-auto text-blue-500 mb-4" />
                        <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Exam Evaluation Complete</h1>
                        <p className="text-lg text-slate-600 max-w-2xl mx-auto">{evaluation.overallFeedback || "Great effort! Here is the breakdown of your performance."}</p>

                        <div className="mt-8 inline-flex items-center justify-center p-6 bg-white rounded-xl shadow-sm border border-slate-200">
                            <div className="text-center">
                                <span className="block text-sm text-slate-500 font-bold uppercase tracking-widest mb-1">Total Score</span>
                                <span className={`text-6xl font-black ${gradeColor}`}>{evaluation.totalScore || `${scoreVal}/${maxScoreVal}`}</span>
                            </div>
                        </div>
                    </div>

                    <div className="p-8">
                        <h2 className="text-xl font-bold text-slate-800 mb-6">Question Breakdown</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {test.questions.map((q, idx) => {
                                const qEval = evaluation.questionEvaluations?.[q.id] || { status: 'Empty', marksObtained: 0 };
                                const conf = getStatusConfig(qEval.status);
                                const Icon = conf.icon;

                                return (
                                    <button
                                        key={q.id}
                                        onClick={() => {
                                            setReviewQuestionId(q.id);
                                            setViewMode('review');
                                        }}
                                        className={`flex flex-col text-left p-4 rounded-xl border-2 transition-all hover:shadow-md ${conf.bg} ${conf.border}`}
                                    >
                                        <div className="flex justify-between items-start w-full mb-2">
                                            <span className="font-bold text-slate-800">Question {idx + 1}</span>
                                            <Icon className={`w-5 h-5 ${conf.color}`} />
                                        </div>
                                        <div className="mt-auto pt-2 flex justify-between w-full text-sm font-semibold">
                                            <span className={conf.color}>{qEval.status}</span>
                                            <span className="text-slate-700">{qEval.marksObtained} / {q.marks} Marks</span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="p-6 bg-slate-50 border-t border-slate-200 flex justify-center">
                        <button
                            onClick={() => navigate('/')}
                            className="px-8 py-3 bg-slate-800 text-white rounded-lg font-bold hover:bg-slate-700 transition-colors shadow"
                        >
                            Return to Dashboard
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ------------- RENDER REVIEW MODE -------------
    if (viewMode === 'review') {
        const selectedQIndex = test.questions.findIndex(q => q.id === reviewQuestionId);
        const reviewQuestion = test.questions[selectedQIndex];
        const qEval = evaluation.questionEvaluations?.[reviewQuestionId];
        const conf = qEval ? getStatusConfig(qEval.status) : getStatusConfig('Empty');
        const StatusIcon = conf.icon;

        return (
            <div className="max-w-screen-2xl mx-auto h-[calc(100vh-88px)] flex flex-col bg-slate-100">
                {/* Header */}
                <div className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shadow-sm z-10 shrink-0">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setViewMode('summary')}
                            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 font-medium bg-slate-100 px-4 py-2 rounded-lg transition-colors"
                        >
                            <ChevronLeft className="w-4 h-4" /> Back to Summary
                        </button>
                        <h2 className="text-xl font-bold text-slate-800">Reviewing Q{selectedQIndex + 1}</h2>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className={`px-4 py-1.5 rounded-full text-sm font-bold flex items-center gap-2 ${conf.bg} ${conf.color} border ${conf.border}`}>
                            <StatusIcon className="w-4 h-4" />
                            {qEval?.status || 'Unknown'}
                        </span>
                        <span className="px-4 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-bold text-sm">
                            Score: {qEval?.marksObtained || 0} / {reviewQuestion.marks}
                        </span>
                    </div>
                </div>

                {/* Split Screen */}
                <div className="flex flex-1 overflow-hidden">
                    {/* Left: Question & Official Marking Scheme */}
                    <div className="w-1/2 border-r border-slate-300 bg-white overflow-y-auto flex flex-col">
                        <div className="p-8 border-b border-slate-200">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">The Question</h3>
                            <div className="prose max-w-none text-slate-800 whitespace-pre-wrap text-lg">
                                {reviewQuestion.text}
                            </div>
                        </div>
                        <div className="p-8 bg-blue-50/50 flex-1">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-blue-800 mb-4">Official Marking Scheme</h3>
                            <ul className="space-y-3">
                                {reviewQuestion.markingScheme.map((scheme, i) => (
                                    <li key={i} className="flex gap-3 text-slate-700 bg-white p-4 rounded-lg border border-blue-100 shadow-sm leading-relaxed">
                                        <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 font-bold text-sm">{i + 1}</div>
                                        {scheme}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* Right: User Answer & AI Feedback */}
                    <div className="w-1/2 overflow-y-auto flex flex-col bg-slate-50">
                        <div className="p-8 border-b border-slate-200">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">Your Answer</h3>
                            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm min-h-[150px] whitespace-pre-wrap text-slate-700">
                                {answers[reviewQuestion.id] || <span className="text-slate-400 italic">No answer provided.</span>}
                            </div>
                        </div>

                        <div className="p-8 flex-1 flex flex-col gap-6">
                            {qEval?.feedback && (
                                <div className={`p-6 rounded-xl border shadow-sm ${conf.bg} ${conf.border}`}>
                                    <h3 className={`text-sm font-bold uppercase tracking-wider mb-2 ${conf.color}`}>AI Feedback</h3>
                                    <p className="text-slate-800 leading-relaxed text-lg">{qEval.feedback}</p>
                                </div>
                            )}

                            {qEval?.missedPoints && qEval.missedPoints.length > 0 && (
                                <div className="p-6 rounded-xl border shadow-sm bg-red-50 border-red-200">
                                    <h3 className="text-sm font-bold uppercase tracking-wider text-red-700 mb-4">Points Missed</h3>
                                    <ul className="space-y-2 list-disc pl-5 text-red-900">
                                        {qEval.missedPoints.map((mp, i) => (
                                            <li key={i} className="leading-relaxed">{mp}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}
