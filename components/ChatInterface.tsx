"use client";

import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ChatInterfaceProps {
    chatLog?: any[];
    onSendMessage?: (text: string) => void;
    disabled?: boolean;
    isThinking?: boolean;
    isSearching?: boolean;
    isDarkMode?: boolean;
    isFullScreen?: boolean;
    onToggleFullScreen?: () => void;
    backendOnline?: boolean | null;
    modelReaction?: string | null;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({
    chatLog = [],
    onSendMessage,
    disabled,
    isThinking,
    isSearching = false,
    isDarkMode = true,
    isFullScreen = false,
    onToggleFullScreen,
    backendOnline = null,
    modelReaction = null,
}) => {
    const [input, setInput] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const isRecordingRef = useRef(false);
    const isStartingRef = useRef(false);
    const recognitionRef = useRef<any>(null);
    const messageEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatLog, isThinking, isSearching]);

    // Auto-resize textarea
    useEffect(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = Math.min(el.scrollHeight, 160) + 'px';
    }, [input]);

    const handleSubmit = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!input.trim() || !onSendMessage) return;
        onSendMessage(input.trim());
        setInput('');
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    const toggleRecording = () => {
        if (isStartingRef.current) return;
        if (isRecordingRef.current) { recognitionRef.current?.stop(); return; }

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert('🎤 Trình duyệt của bạn không hỗ trợ nhận diện giọng nói.\nHãy dùng Chrome hoặc Edge.');
            return;
        }

        isStartingRef.current = true;
        try {
            const recognition = new SpeechRecognition();
            recognition.lang = 'vi-VN';
            recognition.interimResults = true;
            recognition.continuous = false;
            recognition.maxAlternatives = 1;

            recognition.onstart = () => { isRecordingRef.current = true; isStartingRef.current = false; setIsRecording(true); };
            recognition.onresult = (event: any) => {
                let interim = '', final = '';
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const t = event.results[i][0].transcript;
                    if (event.results[i].isFinal) final += t; else interim += t;
                }
                setInput(final || interim);
            };
            recognition.onerror = (event: any) => {
                if (event.error === 'not-allowed') alert('🎤 Bạn cần cho phép quyền truy cập microphone.');
                isRecordingRef.current = false; setIsRecording(false); isStartingRef.current = false;
            };
            recognition.onend = () => { isRecordingRef.current = false; setIsRecording(false); };

            recognitionRef.current = recognition;
            recognition.start();
        } catch (err) { console.error('[Mic] Start error:', err); isStartingRef.current = false; }
    };

    // Hold M to record
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'KeyM' && !e.repeat && !isRecordingRef.current) toggleRecording();
        };
        const onKeyUp = (e: KeyboardEvent) => {
            if (e.code === 'KeyM' && isRecordingRef.current) toggleRecording();
        };
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); };
    }, []);

    const isOnline = backendOnline !== false;
    const msgContainerClass = isFullScreen ? 'max-w-3xl w-full mx-auto' : 'w-full';

    return (
        <div className="flex flex-col h-full text-slate-200 font-sans select-none"
            style={{ background: 'linear-gradient(180deg, rgba(15,17,23,0.98) 0%, rgba(22,27,39,0.98) 100%)' }}>

            {/* ── HEADER ── */}
            <div className="px-4 py-3 flex justify-between items-center shrink-0"
                style={{ borderBottom: '1px solid var(--border-subtle)', background: 'rgba(15,17,23,0.8)', backdropFilter: 'blur(16px)' }}>
                <div className="flex items-center gap-2.5">
                    <span className={`status-dot ${backendOnline === null ? 'loading' : backendOnline === false ? 'offline' : 'online'}`} />
                    <span className="text-sm font-semibold text-slate-200">Hiyori</span>
                    <span className="text-xs text-slate-500 hidden sm:inline">
                        {backendOnline === null ? 'Connecting…' : backendOnline === false ? 'Offline' : 'Online'}
                    </span>
                </div>

                {onToggleFullScreen && (
                    <button
                        onClick={onToggleFullScreen}
                        className="btn-ghost px-3 py-1.5 text-xs font-medium flex items-center gap-1.5"
                        title={isFullScreen ? 'Split View' : 'Wide Chat'}
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {isFullScreen
                                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25M9 15H4.5M9 15v4.5m0-4.5l-5.25 5.25" />
                                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                            }
                        </svg>
                        <span className="hidden sm:inline">{isFullScreen ? 'Split View' : 'Wide Chat'}</span>
                    </button>
                )}
            </div>

            {/* ── MESSAGES ── */}
            <div className="grow overflow-y-auto py-6 px-4 sm:px-6 select-text">
                <div className={`space-y-5 ${msgContainerClass}`}>

                    {/* Welcome bubble */}
                    <div className="flex gap-3 animate-fade-slide-up">
                        <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-base"
                            style={{ background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', boxShadow: '0 0 12px rgba(139,92,246,0.4)' }}>
                            ✨
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1.5">
                                <span className="text-sm font-semibold text-violet-300">Hiyori</span>
                                <span className="text-xs text-slate-500">AI Companion</span>
                            </div>
                            <div className="glass rounded-2xl rounded-tl-sm p-4 text-sm leading-relaxed prose-chat">
                                <p className="font-semibold text-violet-300 mb-1.5">Yahhoo~! こんにちは! (◕‿◕✿)</p>
                                <p className="text-slate-300 mb-3">
                                    Mình là <strong>Hiyori</strong> — VTuber AI do{' '}
                                    <strong className="text-white">sweetvn</strong> phát triển!
                                    Bạn có thể gõ tiếng Việt hoặc nói tiếng Anh để luyện tập cùng mình nhé~ 💜
                                </p>
                                <div className="flex flex-wrap gap-1.5 pt-3"
                                    style={{ borderTop: '1px solid var(--border-subtle)' }}>
                                    {['💬 Realtime Chat', '🌐 Web Search', '🔊 Piper TTS', '🎮 Live2D'].map(tag => (
                                        <span key={tag} className="text-xs px-2.5 py-1 rounded-full font-mono"
                                            style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)', color: '#c4b5fd' }}>
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Backend checking */}
                    {backendOnline === null && (
                        <div className="flex gap-3">
                            <div className="w-8 h-8" />
                            <div className="glass rounded-xl p-3 flex items-center gap-2.5 text-sm text-slate-400">
                                <div className="w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin shrink-0" />
                                Đang kiểm tra kết nối với backend server…
                            </div>
                        </div>
                    )}

                    {/* Backend offline warning */}
                    {backendOnline === false && (
                        <div className="flex gap-3">
                            <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-base"
                                style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)' }}>
                                ⚠️
                            </div>
                            <div className="flex-1 rounded-2xl rounded-tl-sm p-4 text-sm"
                                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)' }}>
                                <p className="font-semibold text-red-400 mb-1.5">Backend không phản hồi</p>
                                <p className="text-slate-300 mb-2">
                                    Đảm bảo{' '}
                                    <code className="font-mono text-xs px-1.5 py-0.5 rounded"
                                        style={{ background: 'rgba(239,68,68,0.2)', color: '#fca5a5' }}>
                                        python main.py
                                    </code>{' '}
                                    đang chạy tại port 8080.
                                </p>
                                <div className="flex gap-3 text-xs font-mono text-red-300/70">
                                    <span>WebSocket: Disconnected</span>
                                    <span>TTS: Offline</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Chat messages */}
                    {chatLog.map((msg, index) => {
                        const isAssistant = msg.role === 'assistant';
                        return (
                            <div key={index}
                                className={`flex gap-3 animate-fade-slide-up ${isAssistant ? '' : 'flex-row-reverse'}`}>
                                {/* Avatar */}
                                <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-sm font-bold leading-none ${
                                    isAssistant
                                        ? ''
                                        : 'text-white'
                                }`}
                                    style={isAssistant
                                        ? { background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', boxShadow: '0 0 10px rgba(139,92,246,0.35)' }
                                        : { background: 'linear-gradient(135deg, #10b981, #059669)' }
                                    }>
                                    {isAssistant ? '✨' : 'U'}
                                </div>

                                {/* Bubble */}
                                <div className={`flex flex-col gap-1 ${isAssistant ? 'items-start' : 'items-end'} max-w-[80%]`}>
                                    <span className="text-xs text-slate-500 px-1">
                                        {isAssistant ? 'Hiyori' : 'Bạn'}
                                    </span>
                                    <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                                        isAssistant
                                            ? 'rounded-tl-sm glass prose-chat'
                                            : 'rounded-tr-sm text-white'
                                    }`}
                                        style={!isAssistant ? {
                                            background: 'linear-gradient(135deg, #7c3aed, #5b21b6)',
                                            boxShadow: '0 2px 12px rgba(109,40,217,0.3)'
                                        } : {}}>
                                        {isAssistant ? (
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                {msg.content}
                                            </ReactMarkdown>
                                        ) : (
                                            <p className="break-words whitespace-pre-wrap m-0">{msg.content}</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {/* Searching indicator */}
                    {isSearching && (
                        <div className="flex gap-3">
                            <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center"
                                style={{ background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)' }}>
                                🔍
                            </div>
                            <div className="glass rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2.5 text-sm text-cyan-300">
                                <div className="w-3.5 h-3.5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin shrink-0" />
                                Đang tìm kiếm trên web…
                            </div>
                        </div>
                    )}

                    {/* Thinking indicator */}
                    {isThinking && !isSearching && (
                        <div className="flex gap-3">
                            <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center"
                                style={{ background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)' }}>
                                ✨
                            </div>
                            <div className="glass rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-violet-400 thinking-dot" />
                                <div className="w-2 h-2 rounded-full bg-violet-400 thinking-dot" />
                                <div className="w-2 h-2 rounded-full bg-violet-400 thinking-dot" />
                            </div>
                        </div>
                    )}

                    <div ref={messageEndRef} />
                </div>
            </div>

            {/* ── INPUT BAR ── */}
            <div className="p-3 sm:p-4 shrink-0"
                style={{ borderTop: '1px solid var(--border-subtle)', background: 'rgba(15,17,23,0.9)', backdropFilter: 'blur(16px)' }}>
                <div className={`w-full ${isFullScreen ? 'max-w-3xl mx-auto' : ''}`}>
                    <div className="relative glass rounded-2xl input-focus-ring transition-all"
                        style={{ border: '1px solid var(--border-default)' }}>
                        <textarea
                            ref={textareaRef}
                            rows={1}
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={
                                disabled
                                    ? 'Chọn phiên chat để bắt đầu…'
                                    : isRecording
                                    ? '🎤 Đang nghe…'
                                    : 'Nhắn cho Hiyori… (Shift+Enter xuống dòng)'
                            }
                            disabled={disabled}
                            className="w-full bg-transparent text-slate-100 placeholder-slate-500 text-sm font-sans outline-none resize-none px-4 pt-3.5 pb-3"
                            style={{ maxHeight: '160px', minHeight: '52px', lineHeight: '1.6' }}
                        />

                        {/* Recording indicator */}
                        {isRecording && (
                            <div className="absolute left-4 bottom-3 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                                <span className="text-xs text-red-400 font-medium">REC</span>
                            </div>
                        )}

                        {/* Action buttons */}
                        <div className="flex items-center justify-between px-3 pb-2.5 pt-0 gap-2">
                            <div className="flex items-center gap-1.5">
                                {/* Mic button */}
                                <button
                                    type="button"
                                    onClick={toggleRecording}
                                    disabled={disabled}
                                    title="Mic (giữ M)"
                                    className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm transition-all ${
                                        isRecording
                                            ? 'bg-red-500/20 text-red-400 border border-red-500/50 animate-pulse'
                                            : 'btn-ghost text-slate-400 hover:text-slate-200'
                                    }`}
                                >
                                    {isRecording ? '⏹' : '🎤'}
                                </button>
                            </div>

                            <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-600 hidden sm:inline select-none">
                                    Enter ↵ gửi · Shift+Enter xuống dòng
                                </span>
                                <button
                                    type="button"
                                    onClick={() => handleSubmit()}
                                    disabled={disabled || !input.trim()}
                                    className="btn-primary px-4 py-1.5 text-sm font-medium flex items-center gap-1.5 rounded-xl"
                                >
                                    <span>Gửi</span>
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ChatInterface;
