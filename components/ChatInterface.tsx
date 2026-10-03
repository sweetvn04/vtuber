"use client";

import React, { useState, useRef, useEffect } from 'react';

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

    useEffect(() => {
        messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatLog, isThinking, isSearching]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || !onSendMessage) return;
        onSendMessage(input.trim());
        setInput('');
    };

    const toggleRecording = () => {
        if (isStartingRef.current) return;

        if (isRecordingRef.current) {
            recognitionRef.current?.stop();
            return;
        }

        const SpeechRecognition =
            (window as any).SpeechRecognition ||
            (window as any).webkitSpeechRecognition;
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

            recognition.onstart = () => {
                isRecordingRef.current = true;
                isStartingRef.current = false;
                setIsRecording(true);
                console.log('[Mic] Web Speech API started');
            };

            recognition.onresult = (event: any) => {
                let interimTranscript = '';
                let finalTranscript = '';
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const t = event.results[i][0].transcript;
                    if (event.results[i].isFinal) finalTranscript += t;
                    else interimTranscript += t;
                }
                setInput(finalTranscript || interimTranscript);
            };

            recognition.onerror = (event: any) => {
                console.error('[Mic] Speech recognition error:', event.error);
                if (event.error === 'not-allowed') {
                    alert('🎤 Bạn cần cho phép quyền truy cập microphone trong trình duyệt.');
                }
                isRecordingRef.current = false;
                setIsRecording(false);
                isStartingRef.current = false;
            };

            recognition.onend = () => {
                isRecordingRef.current = false;
                setIsRecording(false);
                console.log('[Mic] Web Speech API ended');
            };

            recognitionRef.current = recognition;
            recognition.start();
        } catch (err) {
            console.error('[Mic] Start error:', err);
            isStartingRef.current = false;
        }
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
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
        };
    }, []);

    return (
        <div className="flex flex-col h-full text-slate-200 font-sans select-none bg-[#0d111a]/95 backdrop-blur-xl">
            {/* ── HEADER ── */}
            <div className="px-4 py-3 border-b-2 border-slate-800 flex justify-between items-center bg-[#141a26]/90 shrink-0">
                <div className="flex items-center gap-2.5">
                    <span
                        className={`w-2.5 h-2.5 rounded-full ${
                            backendOnline === false
                                ? 'bg-red-500 animate-pulse'
                                : 'bg-emerald-400 shadow-[0_0_8px_#4ade80]'
                        }`}
                    />
                    <div className="font-pixel text-[11px] tracking-wider uppercase text-emerald-400 flex items-center gap-1.5">
                        <span>LIVE CHAT</span>
                        <span className="text-slate-500 font-mono text-[10px]">
                            [{backendOnline === false ? 'OFFLINE' : 'ONLINE'}]
                        </span>
                    </div>
                </div>

                {onToggleFullScreen && (
                    <button
                        onClick={onToggleFullScreen}
                        className="mc-btn-stone px-2.5 py-1 rounded text-[10px] font-pixel uppercase flex items-center gap-1.5"
                        title={isFullScreen ? 'Chuyển sang Chia đôi màn hình (Split View)' : 'Mở rộng khung Chat (Wide Chat)'}
                    >
                        <span>{isFullScreen ? '◫ SPLIT VIEW' : '⊞ EXPAND CHAT'}</span>
                    </button>
                )}
            </div>

            {/* ── MESSAGES CONTAINER (Centered max-w-3xl like ChatGPT/Gemini when expanded) ── */}
            <div className="grow overflow-y-auto p-4 sm:p-6 select-text">
                <div className={`space-y-4 ${isFullScreen ? 'max-w-3xl w-full mx-auto' : 'w-full'}`}>
                    {/* Welcome message */}
                    <div className="flex flex-col gap-1.5 max-w-[90%] mr-auto">
                        <div className="flex items-center gap-1.5 ml-1">
                            <span className="text-xs">✨</span>
                            <span className="font-pixel text-[10px] text-emerald-400">HIYORI.AI</span>
                            <span className="text-[9px] font-mono text-slate-500">[COMPANION]</span>
                        </div>
                        <div className="mc-card p-3.5 sm:p-4 rounded text-xs sm:text-sm leading-relaxed text-slate-200">
                            <p className="font-bold text-emerald-300 font-mono mb-1">
                                Yahhoo~! こんにちは! (◕‿◕✿)
                            </p>
                            <p className="text-xs text-slate-300 mb-2 leading-relaxed">
                                Mình là <strong className="text-emerald-400 font-semibold">Hiyori</strong> — VTuber AI do{' '}
                                <strong className="text-white">sweetvn</strong> phát triển! Bạn có thể gõ tiếng Việt hoặc
                                nói tiếng Anh để luyện tập cùng mình nhé~ 💜
                            </p>
                            <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-800">
                                {['💬 Chat Realtime', '🌐 DuckDuckGo Search', '🔊 Piper TTS', '🎮 Live2D Model'].map(
                                    (tag) => (
                                        <span
                                            key={tag}
                                            className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#1e2738] border border-slate-700 text-slate-300"
                                        >
                                            {tag}
                                        </span>
                                    )
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ── BACKEND CHECKING ── */}
                    {backendOnline === null && (
                        <div className="flex flex-col gap-1 max-w-[85%] mr-auto">
                            <div className="mc-card p-3 rounded text-xs flex items-center gap-2 text-slate-400 font-mono">
                                <span className="animate-spin text-emerald-400">⟳</span>
                                <span>Đang kiểm tra kết nối với server backend...</span>
                            </div>
                        </div>
                    )}

                    {/* ── BACKEND OFFLINE WARNING ── */}
                    {backendOnline === false && (
                        <div className="flex flex-col gap-1 max-w-[92%] mr-auto">
                            <div className="p-3.5 rounded border-2 border-red-500/50 bg-red-950/50 text-red-200 text-xs shadow-lg">
                                <div className="flex items-center gap-2 mb-1.5 font-pixel text-[10px] text-red-400">
                                    <span>⚠️</span>
                                    <span>SERVER CONNECTION LOST</span>
                                </div>
                                <p className="leading-relaxed text-slate-300 mb-2 font-sans">
                                    Server backend hiện không phản hồi. Nếu bạn đang chạy local, hãy đảm bảo{' '}
                                    <code className="bg-black/50 px-1 py-0.5 rounded text-emerald-400 font-mono">
                                        python main.py
                                    </code>{' '}
                                    đang chạy ở cổng 8080!
                                </p>
                                <div className="font-mono text-[10px] text-red-300/80 flex flex-wrap gap-2">
                                    <span>• WebSocket: Disconnected</span>
                                    <span>• TTS Audio: Offline</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── CHAT LOG ── */}
                    {chatLog.map((msg, index) => {
                        const isAssistant = msg.role === 'assistant';
                        return (
                            <div
                                key={index}
                                className={`flex flex-col gap-1.5 ${
                                    isFullScreen ? 'max-w-[80%]' : 'max-w-[88%]'
                                } ${isAssistant ? 'mr-auto items-start' : 'ml-auto items-end'}`}
                            >
                                <div
                                    className={`flex items-center gap-1.5 px-1 font-pixel text-[9px] ${
                                        isAssistant ? 'text-emerald-400' : 'text-[#4deeea]'
                                    }`}
                                >
                                    <span>{isAssistant ? '🤖 HIYORI' : '👤 SWEETVN'}</span>
                                </div>

                                <div
                                    className={`p-3 sm:p-3.5 rounded text-xs sm:text-sm leading-relaxed ${
                                        isAssistant
                                            ? 'mc-card text-slate-100 border-2 border-slate-700/80 shadow-[0_2px_8px_rgba(0,0,0,0.4)]'
                                            : 'bg-[#1b3a28] border-2 border-[#388e3c] text-emerald-100 shadow-[0_2px_8px_rgba(46,125,50,0.3)]'
                                    }`}
                                >
                                    <p className="break-words whitespace-pre-wrap m-0 font-sans">{msg.content}</p>
                                </div>
                            </div>
                        );
                    })}

                    {/* ── SEARCHING INDICATOR ── */}
                    {isSearching && (
                        <div className="mc-card p-3 rounded text-xs flex items-center gap-2 text-cyan-300 font-mono max-w-[85%] mr-auto border-cyan-500/40">
                            <span className="animate-spin text-sm">🔍</span>
                            <span>[DuckDuckGo] Đang tìm kiếm thông tin mới...</span>
                        </div>
                    )}

                    {/* ── THINKING INDICATOR ── */}
                    {isThinking && !isSearching && (
                        <div className="mc-card p-2.5 px-4 rounded max-w-[120px] mr-auto flex items-center justify-center gap-2 border-emerald-500/40">
                            <div className="w-1.5 h-1.5 bg-emerald-400 rounded-xs animate-bounce" />
                            <div className="w-1.5 h-1.5 bg-emerald-400 rounded-xs animate-bounce delay-150" />
                            <div className="w-1.5 h-1.5 bg-emerald-400 rounded-xs animate-bounce delay-300" />
                            <span className="font-pixel text-[8px] text-emerald-400 ml-1">THINK</span>
                        </div>
                    )}

                    <div ref={messageEndRef} />
                </div>
            </div>

            {/* ── INPUT FORM (Centered ChatGPT/Gemini style bar) ── */}
            <div className="p-3 sm:p-4 border-t-2 border-slate-800 bg-[#12161f]/95 select-none shrink-0">
                <div className={`w-full ${isFullScreen ? 'max-w-3xl mx-auto' : ''}`}>
                    <form
                        className="flex items-center gap-2 bg-[#0d111a] border-2 border-slate-700/80 focus-within:border-emerald-400 p-1.5 pl-3.5 pr-2 rounded-xl transition-all shadow-inner"
                        onSubmit={handleSubmit}
                    >
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder={
                                disabled
                                    ? 'Chọn phiên chat để bắt đầu...'
                                    : isRecording
                                    ? 'Listening to microphone...'
                                    : 'Nhắn cho Hiyori (Hỏi đáp, tiếng Anh, tin tức)...'
                            }
                            disabled={disabled}
                            className="w-full bg-transparent text-slate-100 placeholder-slate-500 text-xs sm:text-sm font-mono outline-none"
                        />
                        {isRecording && (
                            <div className="flex items-center gap-1 shrink-0 px-1">
                                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                                <span className="font-pixel text-[8px] text-red-400">REC</span>
                            </div>
                        )}

                        {/* Microphone button */}
                        <button
                            type="button"
                            onClick={toggleRecording}
                            disabled={disabled}
                            className={`px-2.5 py-1.5 rounded font-pixel text-xs transition-all shrink-0 ${
                                isRecording
                                    ? 'bg-red-700 hover:bg-red-600 text-white border-2 border-red-400 animate-pulse'
                                    : 'mc-btn-stone'
                            }`}
                            title="Bật/Tắt Microphone (Giữ phím M)"
                        >
                            {isRecording ? '⏹' : '🎤'}
                        </button>

                        {/* Send button */}
                        <button
                            type="submit"
                            disabled={disabled || !input.trim()}
                            className="mc-btn px-3.5 py-1.5 rounded font-pixel text-xs uppercase flex items-center gap-1 shrink-0"
                        >
                            <span>SEND</span>
                            <span>🏹</span>
                        </button>
                    </form>

                    <div className="flex justify-between items-center text-[9px] font-mono text-slate-500 mt-2 px-1">
                        <span>Hold [M] to talk</span>
                        <span className="hidden sm:inline">Hiyori AI • Piper TTS • Live2D</span>
                        <span>[Enter] to send</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ChatInterface;
