import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import _ from 'lodash';
import { mockTests } from '../data/mockTests';
import { useTestContext } from '../context/TestContext';
import { evaluateAnswersWithGemini } from '../lib/aiChecker';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
    Clock, AlertCircle, ChevronLeft, ChevronRight, Send,
    CheckCircle, XCircle, MinusCircle, HelpCircle,
    Calculator, Sun, Languages, Menu, PlusCircle, Star
} from 'lucide-react';

export default function Exam() {
    const { testId } = useParams();
    const navigate = useNavigate();
    const { markTestCompleted } = useTestContext();

    const test = mockTests.find(t => t.id === testId);

    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState({});
    const [timeLeft, setTimeLeft] = useState(test ? test.durationMinutes * 60 : 0);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Split View Resizing State
    const splitContainerRef = useRef(null);
    const [leftSplitWidth, setLeftSplitWidth] = useState(50);
    const [isDraggingSplit, setIsDraggingSplit] = useState(false);

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isDraggingSplit || !splitContainerRef.current) return;
            const container = splitContainerRef.current.getBoundingClientRect();
            let newWidth = ((e.clientX - container.left) / container.width) * 100;
            if (newWidth < 20) newWidth = 20;
            if (newWidth > 80) newWidth = 80;
            setLeftSplitWidth(newWidth);
        };
        const handleMouseUp = () => setIsDraggingSplit(false);

        if (isDraggingSplit) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            // Prevent text selection while dragging
            document.body.style.userSelect = 'none';
        } else {
            document.body.style.userSelect = '';
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.userSelect = '';
        };
    }, [isDraggingSplit]);

    // evaluation holds the parsed JSON response from Gemini
    const [evaluation, setEvaluation] = useState(null);

    // View mode navigation: 'exam' | 'summary' | 'review'
    const [viewMode, setViewMode] = useState('exam');
    const [reviewQuestionId, setReviewQuestionId] = useState(null);

    // Track Question statuses
    const [visitedQuestions, setVisitedQuestions] = useState(new Set());
    const [markedQuestions, setMarkedQuestions] = useState(new Set());

    // --- NEW GROUPING AND VALIDATION LOGIC ---
    // Extract logical group number from question IDs like "q1a", "q3bii" -> "1", "3"
    // For Accounts, the ids are just "q1", "q2", so it still maps to "1", "2".
    const getGroupFromId = (qId) => {
        const match = qId.match(/^q(\d+)/);
        return match ? match[1] : qId;
    };

    const getSubpartFromId = (qId) => {
        return qId.replace(/^q\d+/, '');
    };

    // Calculate unique groups for the tabs
    const [uniqueGroups, setUniqueGroups] = useState([]);
    const [activeGroup, setActiveGroup] = useState(null);

    useEffect(() => {
        if (!test) return;
        const groups = _.uniq(test.questions.map(q => getGroupFromId(q.id)));
        setUniqueGroups(groups);
        if (groups.length > 0 && !activeGroup) {
            setActiveGroup(groups[0]);
        }
    }, [test]);

    // Update activeGroup automatically if currentQuestionIndex changes
    useEffect(() => {
        if (test && test.questions[currentQuestionIndex]) {
            const currentQ = test.questions[currentQuestionIndex];
            const group = getGroupFromId(currentQ.id);
            if (group !== activeGroup) {
                setActiveGroup(group);
            }
        }
    }, [currentQuestionIndex]);

    // Validation for "Law" Optional Questions (Answer 4 out of remaining 5)
    // Compulsory: Group "1"
    // Optional Pool: "2", "3", "4", "5", "6"
    const isSubjectLaw = test?.subject.toLowerCase().includes('law');
    const isMCQTest = test?.subject.toLowerCase().includes('economics') || test?.subject.toLowerCase().includes('aptitude');

    const checkMaxOptionalGroupsHit = (targetGroup) => {
        if (!isSubjectLaw) return false;
        if (targetGroup === '1') return false; // compulsory

        // Find which optional groups currently have at least one answered question
        const optionalGroupsAttempted = new Set();
        test.questions.forEach(q => {
            const g = getGroupFromId(q.id);
            if (g !== '1' && answers[q.id] && answers[q.id].length > 0) {
                optionalGroupsAttempted.add(g);
            }
        });

        // If target group is already one of the attempted ones, it's fine
        if (optionalGroupsAttempted.has(targetGroup)) return false;

        // Otherwise, if they already attempted 4 optional groups, block this new one
        return optionalGroupsAttempted.size >= 4;
    };
    // ----------------------------------------

    useEffect(() => {
        if (!test) return;

        setAnswers(prev => {
            if (Object.keys(prev).length > 0) return prev;
            const initialAnswers = {};
            test.questions.forEach(q => { initialAnswers[q.id] = isMCQTest ? null : []; });
            return initialAnswers;
        });

        // Mark first question as visited
        setVisitedQuestions(prev => {
            if (prev.size > 0 || test.questions.length === 0) return prev;
            return new Set([test.questions[0].id]);
        });

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

    useEffect(() => {
        if (test && test.questions[currentQuestionIndex]) {
            setVisitedQuestions(prev => new Set(prev).add(test.questions[currentQuestionIndex].id));
        }
    }, [currentQuestionIndex, test]);

    if (!test) {
        return <div className="p-8 text-center text-red-500">Test not found!</div>;
    }

    const formatTime = (seconds) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const currentQuestion = test.questions[currentQuestionIndex];
    const isLastQuestion = currentQuestionIndex === test.questions.length - 1;

    const handleFileUpload = async (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;

        const targetGroup = getGroupFromId(currentQuestion.id);
        const currentAns = answers[currentQuestion.id] || [];

        if (currentAns.length === 0 && checkMaxOptionalGroupsHit(targetGroup)) {
            alert('You have already attempted the maximum number of optional questions (4 out of 5). Please clear a response in another question group before attempting this one.');
            e.target.value = ''; // Reset input
            return;
        }

        const filePromises = files.map(file => {
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    resolve({
                        data: reader.result.split(',')[1],
                        mimeType: file.type,
                        name: file.name,
                        dataUrl: reader.result
                    });
                };
                reader.readAsDataURL(file);
            });
        });

        const uploadedFiles = await Promise.all(filePromises);

        setAnswers(prev => ({
            ...prev,
            [currentQuestion.id]: [...(prev[currentQuestion.id] || []), ...uploadedFiles]
        }));

        e.target.value = ''; // Reset input
    };

    const handleRemoveFile = (indexToRemove) => {
        setAnswers(prev => {
            const currentAns = prev[currentQuestion.id] || [];
            const newAns = currentAns.filter((_, idx) => idx !== indexToRemove);
            return {
                ...prev,
                [currentQuestion.id]: newAns.length > 0 ? newAns : []
            };
        });
    };

    const handleClearResponse = () => {
        setAnswers(prev => ({
            ...prev,
            [currentQuestion.id]: isMCQTest ? null : []
        }));
    };

    const handleMCQSelect = (option) => {
        setAnswers(prev => ({
            ...prev,
            [currentQuestion.id]: option
        }));
    };

    const handleMarkForReview = () => {
        setMarkedQuestions(prev => {
            const newSet = new Set(prev);
            if (newSet.has(currentQuestion.id)) {
                newSet.delete(currentQuestion.id);
            } else {
                newSet.add(currentQuestion.id);
            }
            return newSet;
        });
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

    const getQuestionStatus = (qId) => {
        const isAnswered = answers[qId] && answers[qId].length > 0;
        const isMarked = markedQuestions.has(qId);
        if (isAnswered && isMarked) return 'attempted-marked';
        if (isAnswered) return 'attempted';
        if (isMarked) return 'marked';
        if (visitedQuestions.has(qId)) return 'seen';
        return 'not-seen';
    };

    // ------------- RENDER EXAM MODE (JEE STYLE) -------------
    if (viewMode === 'exam') {
        return (
            <div className="flex flex-col h-screen bg-white font-sans text-sm">
                {/* TOP HEADER */}
                <div className="bg-[#3b5998] text-white flex justify-between items-center px-4 py-2 shrink-0">
                    <div>
                        <h1 className="text-lg font-medium">{test.title}</h1>
                        <div className="text-xs font-mono tracking-wider">{formatTime(timeLeft)}</div>
                    </div>
                    <div className="flex gap-4 items-center">
                        <Calculator className="w-5 h-5 cursor-pointer hover:text-blue-200 transition-colors" />
                        <Sun className="w-5 h-5 cursor-pointer hover:text-blue-200 transition-colors" />
                        <Languages className="w-5 h-5 cursor-pointer hover:text-blue-200 transition-colors" />
                        <button onClick={() => navigate('/')} className="hover:text-blue-200 transition-colors" title="Exit">
                            <Menu className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* SECTIONS TABS */}
                <div className="bg-[#4a69bd] px-4 py-2 shrink-0 flex gap-2 overflow-x-auto">
                    {uniqueGroups.map(group => {
                        const isActive = activeGroup === group;

                        // Check if group is compulsory or optional (display purpose)
                        let badge = null;
                        if (isSubjectLaw) {
                            badge = group === '1' ? '(Compulsory)' : '';
                        }

                        return (
                            <button
                                key={group}
                                onClick={() => {
                                    setActiveGroup(group);
                                    // Optionally, find the first question in that group and jump to it
                                    const firstIdx = test.questions.findIndex(q => getGroupFromId(q.id) === group);
                                    if (firstIdx !== -1) setCurrentQuestionIndex(firstIdx);
                                }}
                                className={`px-4 py-1.5 font-bold rounded shadow-inner whitespace-nowrap transition-colors flex items-center gap-2 ${isActive
                                    ? 'bg-[#3b5998] border border-orange-400 text-orange-400'
                                    : 'bg-[#5b7ad8] border border-transparent text-white hover:bg-[#6c8ceb]'
                                    }`}
                            >
                                Question {group} {badge && <span className="text-[10px] uppercase opacity-80">{badge}</span>}
                            </button>
                        );
                    })}
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* LEFT AREA: QUESTION */}
                    <div className="flex-1 flex flex-col border-r border-slate-300 relative bg-white">
                        {/* Question Info Bar */}
                        <div className="flex justify-between items-center px-4 py-3 border-b border-slate-200 bg-white items-center shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shadow-sm">
                                    {currentQuestionIndex + 1}
                                </div>
                                <div className="flex items-center text-xs text-slate-500 font-medium">
                                    00:00 | <span className="text-green-600 ml-1">+{currentQuestion.marks}</span> <span className="text-red-600 ml-1">-0</span>
                                </div>
                                <div className="bg-blue-50 text-blue-600 px-2 py-0.5 text-xs font-medium rounded border border-blue-100">
                                    {isMCQTest ? 'Multiple Choice' : 'Descriptive Answer'}
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <PlusCircle className="w-5 h-5 text-green-500 cursor-pointer hover:text-green-600 transition-colors" />
                                <Star
                                    onClick={handleMarkForReview}
                                    title="Mark for Review"
                                    className={`w-5 h-5 cursor-pointer transition-colors ${markedQuestions.has(currentQuestion.id) ? 'text-purple-600 fill-current' : 'text-orange-400 hover:text-orange-500'}`}
                                />
                                <AlertCircle className="w-5 h-5 text-red-500 cursor-pointer hover:text-red-600 transition-colors" />
                            </div>
                        </div>

                        {/* Question Content */}
                        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
                            <div className="text-[15px] font-mono text-slate-800 leading-relaxed whitespace-pre-wrap w-full">
                                {currentQuestion.text}
                            </div>
                            <div className="flex-1 flex flex-col mt-4">
                                {isMCQTest ? (
                                    <div className="flex flex-col gap-3">
                                        <h3 className="text-slate-700 font-bold mb-2">Select your answer:</h3>
                                        {['A', 'B', 'C', 'D'].map(option => {
                                            // Extract the option text from the question body specifically avoiding greedy matches across newlines.
                                            // Matches patterns like `(A) Some text` or `(a) Some text`
                                            const optionRegex = new RegExp(`\\(${option.toLowerCase()}\\)[ \\t]*([\\s\\S]*?)(?=\\n\\s*\\([a-d]\\)|$)`, 'i');
                                            const match = currentQuestion.text.match(optionRegex);
                                            const optionText = match ? match[1].trim() : '';

                                            return (
                                                <button
                                                    key={option}
                                                    onClick={() => handleMCQSelect(option)}
                                                    className={`w-full flex items-start gap-4 text-left px-6 py-4 rounded-xl border-2 font-bold text-lg transition-colors ${answers[currentQuestion.id] === option
                                                        ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-sm'
                                                        : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300 hover:bg-slate-50'
                                                        }`}
                                                >
                                                    <span className="shrink-0 w-8 flex justify-center">{option}.</span>
                                                    <span className="font-normal">{optionText || `Option ${option}`}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <>
                                        <div className="w-full min-h-[150px] bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl flex items-center justify-center relative hover:bg-slate-100 transition-colors">
                                            <input
                                                type="file"
                                                multiple
                                                accept="image/*,application/pdf"
                                                onChange={handleFileUpload}
                                                disabled={isSubmitting}
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                            />
                                            <div className="text-center p-6 pointer-events-none">
                                                <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
                                                    <PlusCircle className="w-6 h-6" />
                                                </div>
                                                <h3 className="text-slate-800 font-semibold mb-1">Upload Answer Images or PDFs</h3>
                                                <p className="text-slate-500 text-xs text-center max-w-[200px]">Click or drag & drop files to attach them to this question.</p>
                                            </div>
                                        </div>

                                        {/* Uploaded Files Preview */}
                                        {answers[currentQuestion.id] && Array.isArray(answers[currentQuestion.id]) && answers[currentQuestion.id].length > 0 && (
                                            <div className="mt-4 grid grid-cols-2 lg:grid-cols-3 gap-4">
                                                {answers[currentQuestion.id].map((file, idx) => (
                                                    <div key={idx} className="relative group rounded-lg overflow-hidden border border-slate-200 shadow-sm bg-white aspect-square">
                                                        {file.mimeType.startsWith('image/') ? (
                                                            <img src={file.dataUrl} alt={file.name} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-slate-50">
                                                                <span className="text-2xl mb-2">📄</span>
                                                                <span className="text-xs text-center text-slate-600 truncate w-full" title={file.name}>{file.name}</span>
                                                            </div>
                                                        )}
                                                        <button
                                                            onClick={() => handleRemoveFile(idx)}
                                                            className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 shadow"
                                                        >
                                                            <XCircle className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Footer Buttons */}
                        <div className="border-t border-slate-200 p-3 flex justify-between bg-white shrink-0 items-center">
                            <button
                                onClick={handleClearResponse}
                                className="px-5 py-2.5 bg-orange-50 text-orange-600 border border-orange-200 rounded font-medium hover:bg-orange-100 transition-colors shadow-sm"
                            >
                                Clear Response
                            </button>
                            <div className="flex gap-3">
                                <button
                                    onClick={handlePrev}
                                    disabled={currentQuestionIndex === 0}
                                    className="px-6 py-2.5 bg-blue-50 text-blue-600 border border-blue-200 rounded font-medium hover:bg-blue-100 disabled:opacity-50 transition-colors shadow-sm"
                                >
                                    Previous
                                </button>
                                {isLastQuestion ? (
                                    <button
                                        onClick={() => handleSubmit(answers)}
                                        disabled={isSubmitting}
                                        className="px-6 py-2.5 bg-green-50 text-green-700 border border-green-200 rounded font-medium hover:bg-green-100 transition-colors shadow-sm"
                                    >
                                        {isSubmitting ? 'Evaluating...' : 'Save & Submit'}
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleNext}
                                        className="px-6 py-2.5 bg-green-50 text-green-700 border border-green-200 rounded font-medium hover:bg-green-100 transition-colors shadow-sm"
                                    >
                                        Next
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* RIGHT AREA: QUESTION PALETTE */}
                    <div className="w-[340px] bg-white flex flex-col shrink-0">
                        <div className="flex-1 overflow-y-auto w-full">
                            {/* Legend */}
                            <div className="p-4 grid grid-cols-2 gap-y-4 gap-x-2 text-xs text-slate-700 border-b border-slate-200 w-full">
                                <div className="flex items-center gap-2">
                                    <span className="w-8 h-8 rounded-full bg-[#22c55e] flex shrink-0 shadow-sm border border-black/5"></span>
                                    <span>Attempted</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="w-8 h-8 rounded-full bg-[#9333ea] relative flex shrink-0 justify-center items-center shadow-sm border border-black/5">
                                        <span className="w-2.5 h-2.5 rounded-full bg-[#22c55e] absolute bottom-0 right-0 border border-white"></span>
                                    </span>
                                    <span>Attempted & Marked</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="w-8 h-8 rounded-full bg-[#9333ea] flex shrink-0 shadow-sm border border-black/5"></span>
                                    <span>Marked</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="w-8 h-8 rounded-full bg-[#ef4444] flex shrink-0 shadow-sm border border-black/5"></span>
                                    <span>Seen</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="w-8 h-8 rounded-full bg-[#64748b] flex shrink-0 shadow-sm border border-black/5"></span>
                                    <span>Not Seen</span>
                                </div>
                            </div>

                            {/* Questions Grid */}
                            <div className="p-4">
                                <h3 className="text-[13px] font-semibold text-slate-600 mb-4 uppercase tracking-wider">
                                    Sub-questions for Q{activeGroup}
                                </h3>
                                <div className="flex flex-wrap gap-3">
                                    {test.questions.map((q, idx) => {
                                        // Only show bubbles for the active group
                                        if (getGroupFromId(q.id) !== activeGroup) return null;

                                        const status = getQuestionStatus(q.id);
                                        let style = '';
                                        let extraIcon = null;

                                        switch (status) {
                                            case 'attempted': style = 'bg-[#22c55e] text-white'; break;
                                            case 'attempted-marked':
                                                style = 'bg-[#9333ea] text-white relative';
                                                extraIcon = <span className="w-3 h-3 rounded-full bg-[#22c55e] absolute -bottom-1 -right-1 border-[1.5px] border-white z-10"></span>;
                                                break;
                                            case 'marked': style = 'bg-[#9333ea] text-white'; break;
                                            case 'seen': style = 'bg-[#ef4444] text-white'; break;
                                            case 'not-seen': default: style = 'bg-[#64748b] text-white'; break;
                                        }

                                        let rawSub = getSubpartFromId(q.id);
                                        let label = rawSub
                                            ? rawSub.replace(/_/g, '(') + (rawSub.includes('_') ? ')' : '')
                                            : (idx + 1);
                                        // e.g. 'aiii' -> 'a.iii' for nicer display if needed, but 'a', 'b', 'ci' is fine too
                                        // fallback to absolute index if format is weird

                                        return (
                                            <button
                                                key={q.id}
                                                onClick={() => setCurrentQuestionIndex(idx)}
                                                className={`w-12 h-12 rounded-full flex items-center justify-center text-[15px] font-bold uppercase transition-all hover:scale-105 shadow-sm border border-black/10 relative ${style} ${currentQuestionIndex === idx ? 'ring-4 ring-blue-300 ring-offset-2' : ''}`}
                                            >
                                                {label}
                                                {extraIcon}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Submit Button */}
                        <div className="p-4 border-t border-slate-200 bg-white shrink-0">
                            <button
                                onClick={() => handleSubmit(answers)}
                                disabled={isSubmitting}
                                className="w-full py-3 bg-[#d1fae5] text-[#059669] border border-[#a7f3d0] rounded font-bold hover:bg-[#bbf7d0] transition-colors shadow-sm"
                            >
                                {isSubmitting ? 'Evaluating...' : 'Submit Test'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ------------- RENDER SUMMARY MODE (UNCHANGED) -------------
    if (viewMode === 'summary') {
        let calculatedScore = 0;
        if (evaluation.questionEvaluations) {
            Object.values(evaluation.questionEvaluations).forEach(qEval => {
                calculatedScore += (Number(qEval.marksObtained) || 0);
            });
        }

        const scoreVal = calculatedScore;
        const maxScoreVal = test.marks;
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
                                <span className={`text-6xl font-black ${gradeColor}`}>{scoreVal}/{maxScoreVal}</span>
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
                                            <span className="font-bold text-slate-800">
                                                Question {getGroupFromId(q.id)}{getSubpartFromId(q.id)}
                                            </span>
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

    // ------------- RENDER REVIEW MODE (UNCHANGED) -------------
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
                        <h2 className="text-xl font-bold text-slate-800">
                            Reviewing Q{getGroupFromId(reviewQuestion.id)}{getSubpartFromId(reviewQuestion.id)}
                        </h2>
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
                <div className="flex flex-1 overflow-hidden" ref={splitContainerRef}>
                    {/* Left: Question & Official Marking Scheme */}
                    <div
                        className="border-r border-slate-300 bg-white overflow-y-auto flex flex-col shrink-0"
                        style={{ width: `${leftSplitWidth}%` }}
                    >
                        <div className="p-8 border-b border-slate-200">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">The Question</h3>
                            <div className="text-lg font-mono text-slate-800 whitespace-pre-wrap w-full">
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

                        {qEval?.officialAnswerExtracted && (
                            <div className="p-8 border-t border-slate-200 flex-1 bg-white">
                                <h3 className="text-sm font-bold uppercase tracking-wider text-green-700 mb-4">Extracted Answer from Key</h3>
                                <div className="prose max-w-none prose-slate prose-table:border-collapse prose-th:border prose-th:bg-slate-50 prose-td:border bg-green-50/30 p-5 rounded-lg border border-green-200 shadow-sm overflow-x-auto text-[15px]">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {qEval.officialAnswerExtracted}
                                    </ReactMarkdown>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Draggable Divider */}
                    <div
                        className="w-1.5 hover:w-2 bg-slate-200 hover:bg-blue-400 cursor-col-resize shrink-0 transition-all flex items-center justify-center relative z-20 group"
                        onMouseDown={() => setIsDraggingSplit(true)}
                    >
                        <div className="h-8 w-1 bg-slate-400 group-hover:bg-white rounded-full"></div>
                    </div>

                    {/* Right: User Answer & AI Feedback */}
                    <div className="flex-1 overflow-y-auto flex flex-col bg-slate-50 min-w-0">
                        <div className="p-8 border-b border-slate-200">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">Your Uploaded Answer</h3>
                            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm min-h-[150px] flex gap-4 overflow-x-auto items-center">
                                {isMCQTest ? (
                                    <div className="text-xl font-bold text-slate-700 w-full text-center">
                                        {answers[reviewQuestion.id] ? `Selected Option: ${answers[reviewQuestion.id]}` : <span className="text-slate-400 italic">No answer selected.</span>}
                                    </div>
                                ) : (
                                    answers[reviewQuestion.id] && Array.isArray(answers[reviewQuestion.id]) && answers[reviewQuestion.id].length > 0 ? (
                                        answers[reviewQuestion.id].map((file, idx) => (
                                            <div key={idx} className="shrink-0 w-48 rounded-lg overflow-hidden border border-slate-200 bg-slate-50 flex flex-col items-center justify-center aspect-square relative group">
                                                {file.mimeType.startsWith('image/') ? (
                                                    <a href={file.dataUrl} target="_blank" rel="noopener noreferrer" className="w-full h-full">
                                                        <img src={file.dataUrl} alt={file.name} className="w-full h-full object-cover transition-opacity hover:opacity-80" />
                                                    </a>
                                                ) : (
                                                    <div className="flex flex-col items-center justify-center h-full p-4">
                                                        <span className="text-4xl mb-2">📄</span>
                                                        <span className="text-xs text-center text-slate-600 truncate w-full max-w-[120px]" title={file.name}>{file.name}</span>
                                                    </div>
                                                )}
                                            </div>
                                        ))
                                    ) : (
                                        <span className="text-slate-400 italic">No answer uploaded.</span>
                                    )
                                )}
                            </div>
                        </div>

                        <div className="p-8 flex-1 flex flex-col gap-6">
                            {qEval?.feedback && (
                                <div className={`p-6 rounded-xl border shadow-sm ${conf.bg} ${conf.border}`}>
                                    <h3 className={`text-sm font-bold uppercase tracking-wider mb-2 ${conf.color}`}>AI Feedback</h3>
                                    <div className="prose max-w-none prose-slate prose-table:border-collapse prose-th:border prose-th:bg-slate-50 prose-td:border text-slate-800 leading-relaxed text-lg w-full">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                            {qEval.feedback}
                                        </ReactMarkdown>
                                    </div>
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
