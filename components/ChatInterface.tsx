"use client";

import React, { useState, useRef, useEffect } from 'react';

interface ChatInterfaceProps {
    chatLog?: any[];
    onSendMessage?: (text: string) => void;
    disabled?: boolean;
    isThinking?: boolean;
    isDarkMode?: boolean;
    isFullScreen?: boolean;
    onToggleFullScreen?: () => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({
    chatLog = [],
    onSendMessage,
    disabled,
    isThinking,
    isDarkMode = false,
    isFullScreen = false,
    onToggleFullScreen
}) => {
    const [input, setInput] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    // Sử dụng Ref để tránh sự cố Race Condition
    const isRecordingRef = useRef(false);
    const isStartingRef = useRef(false);
    const micAccessGrantedRef = useRef(false);

    const recognitionRef = useRef<any>(null);
    const messageEndRef = useRef<HTMLDivElement>(null);
    const isPushToTalkRef = useRef(false);

    // Hàm cập nhật trạng thái an toàn
    const setRecordingState = (state: boolean) => {
        setIsRecording(state);
        isRecordingRef.current = state;
        if (state) isStartingRef.current = false;
    };

    useEffect(() => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition && !recognitionRef.current) {
            const recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = true;
            recognition.lang = 'en-US';

            recognition.onresult = (event: any) => {
                let interimTranscript = '';
                let finalTranscript = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript;
                    else interimTranscript += event.results[i][0].transcript;
                }
                if (finalTranscript) {
                    setInput('');
                    if (onSendMessage) onSendMessage(finalTranscript);
                    setRecordingState(false);
                } else if (interimTranscript) {
                    setInput(interimTranscript);
                }
            };

            recognition.onstart = () => {
                setRecordingState(true);
            };

            recognition.onerror = (event: any) => {
                if (event.error === 'audio-capture' || event.error === 'not-allowed') {
                    console.warn('Microphone Error:', event.error);
                    micAccessGrantedRef.current = false;
                    alert("Không thể bắt được âm thanh (audio-capture).\n\n- Kiểm tra xem Mic có bị lỏng không.\n- Kiểm tra xem có ứng dụng khác đang chiếm Mic không.\n- Trên Linux, thử tắt PulseAudio/Pipewire rồi bật lại.");
                }

                if (event.error !== 'no-speech' && event.error !== 'aborted' && event.error !== 'audio-capture') {
                    console.warn('Speech recognition error:', event.error);
                }

                setRecordingState(false);
                isStartingRef.current = false;
            };

            recognition.onend = () => {
                setRecordingState(false);
                isStartingRef.current = false;
            };

            recognitionRef.current = recognition;
        }
    }, [onSendMessage]);

    const startRecording = () => {
        if (!recognitionRef.current || isRecordingRef.current || isStartingRef.current) return;

        const executeStart = () => {
            try {
                isStartingRef.current = true;
                setInput('');
                recognitionRef.current.start();
            } catch (err) {
                console.error("Error starting speech recognition:", err);
                isStartingRef.current = false;
                setRecordingState(false);
            }
        };

        if (!micAccessGrantedRef.current) {
            isStartingRef.current = true;
            navigator.mediaDevices.getUserMedia({ audio: true })
                .then((stream) => {
                    stream.getTracks().forEach(t => t.stop());
                    micAccessGrantedRef.current = true;
                    executeStart();
                })
                .catch((err) => {
                    console.error("Mic access denied:", err);
                    alert("Lỗi truy cập Microphone. Vui lòng cấp quyền và thử lại.");
                    isStartingRef.current = false;
                });
            return;
        }

        executeStart();
    };

    const stopRecording = () => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
        }
    };

    const toggleRecording = () => {
        if (!recognitionRef.current) return;
        isRecordingRef.current ? stopRecording() : startRecording();
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const isInputFocused = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName || '');
            if (isInputFocused) return;

            if (e.key.toLowerCase() === 'm' && !e.repeat) {
                if (!isRecordingRef.current) {
                    isPushToTalkRef.current = true;
                    startRecording();
                }
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key.toLowerCase() === 'm') {
                if (isPushToTalkRef.current) {
                    stopRecording();
                    isPushToTalkRef.current = false;
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    useEffect(() => {
        messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatLog, isThinking]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (input.trim() && onSendMessage && !disabled) {
            onSendMessage(input);
            setInput('');
        }
    };

    const baseText = isDarkMode ? 'text-gray-200' : 'text-gray-800';
    const subText = isDarkMode ? 'text-gray-400' : 'text-gray-500';
    const assistantBg = isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-100 border-gray-200';
    const userBg = 'bg-blue-600 text-white';
    const inputBg = isDarkMode ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-500' : 'bg-white border-gray-300 text-gray-800 placeholder-gray-400';

    return (
        <div className={`flex flex-col h-full ${baseText}`}>
            {/* Header */}
            <div className={`px-4 py-3 border-b flex justify-between items-center ${isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}`}>
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <h2 className="font-bold text-xs tracking-wider uppercase opacity-70">Live Chat</h2>
                </div>

                {/* Full Screen Toggle Button */}
                {onToggleFullScreen && (
                    <button
                        onClick={onToggleFullScreen}
                        className={`p-1.5 rounded-md transition-all hover:bg-gray-100 dark:hover:bg-gray-700 opacity-60 hover:opacity-100 font-bold`}
                        title={isFullScreen ? "Exit Full Screen" : "Full Screen"}
                    >
                        {isFullScreen ? '↙ Thu nhỏ' : '⛶ Toàn màn hình'}
                    </button>
                )}
            </div>

            {/* Messages */}
            <div className="grow overflow-y-auto p-4 space-y-4 bg-transparent">
                <div className="flex flex-col gap-1 max-w-[85%] w-fit mr-auto">
                    <span className={`text-[10px] font-bold ml-2 uppercase opacity-50 ${subText}`}>Hiyori</span>
                    <div className={`p-3 rounded-2xl rounded-tl-none shadow-sm border text-sm leading-relaxed ${assistantBg} ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                        <p>Chào bạn! Mình có thể giúp gì cho bạn hôm nay? ฅ^•ﻌ•^ฅ</p>
                    </div>
                </div>

                {chatLog.map((msg, index) => (
                    <div key={index} className={`flex flex-col gap-1 max-w-[85%] w-fit ${msg.role === 'assistant' ? 'mr-auto items-start' : 'ml-auto items-end'}`}>
                        <span className={`text-[10px] font-bold px-2 opacity-50 uppercase ${subText}`}>
                            {msg.role === 'assistant' ? 'Assistant' : 'You'}
                        </span>
                        <div className={`p-3 rounded-2xl shadow-sm text-sm leading-relaxed border ${msg.role === 'assistant'
                            ? `${assistantBg} rounded-tl-none ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`
                            : `${userBg} rounded-tr-none border-transparent`
                            }`}>
                            <p className="break-words m-0">{msg.content}</p>
                        </div>
                    </div>
                ))}

                {isThinking && (
                    <div className={`flex gap-2 p-3 rounded-full animate-pulse border max-w-[80px] w-fit mr-auto justify-center ${assistantBg}`}>
                        <div className="w-1.5 h-1.5 rounded-full bg-current opacity-40 animate-bounce" />
                        <div className="w-1.5 h-1.5 rounded-full bg-current opacity-60 animate-bounce delay-150" />
                        <div className="w-1.5 h-1.5 rounded-full bg-current opacity-80 animate-bounce delay-300" />
                    </div>
                )}
                <div ref={messageEndRef} />
            </div>

            {/* Input */}
            <div className={`p-4 ${isDarkMode ? 'bg-gray-800' : 'bg-white'} border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                <form className="relative flex items-center gap-2" onSubmit={handleSubmit}>
                    <div className="relative grow">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder={disabled ? "Chọn chat để bắt đầu..." : (isRecording ? "Listening..." : "Nói chuyện với mình đi...")}
                            disabled={disabled}
                            className={`w-full border-2 p-3 pl-4 pr-10 rounded-full text-sm outline-none transition-all focus:border-blue-400 ${inputBg}`}
                        />
                        {isRecording && (
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex gap-1">
                                <div className="w-1 h-3 bg-red-500 animate-voice-bar-1" />
                                <div className="w-1 h-5 bg-red-500 animate-voice-bar-2" />
                            </div>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={toggleRecording}
                        disabled={disabled}
                        className={`w-11 h-11 flex items-center justify-center rounded-full transition-all shadow-sm active:scale-95 ${isRecording
                            ? 'bg-red-500 text-white animate-pulse'
                            : isDarkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                    >
                        {isRecording ? '⏹' : '🎤'}
                    </button>

                    <button
                        type="submit"
                        disabled={disabled || !input.trim()}
                        className="h-11 px-5 rounded-full bg-blue-600 text-white font-bold text-sm shadow-sm hover:bg-blue-700 active:translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        SEND
                    </button>
                </form>
                <p className={`text-[9px] text-center mt-2 opacity-40 font-bold uppercase tracking-widest ${subText}`}>
                    Hold [M] to talk • Enter to send
                </p>
            </div>

            <style jsx>{`
                @keyframes voice-bar-1 { 0%, 100% { height: 8px; } 50% { height: 16px; } }
                @keyframes voice-bar-2 { 0%, 100% { height: 12px; } 50% { height: 24px; } }
                .animate-voice-bar-1 { animation: voice-bar-1 0.6s ease-in-out infinite; }
                .animate-voice-bar-2 { animation: voice-bar-2 0.6s ease-in-out infinite 0.1s; }
            `}</style>
        </div>
    );
};

export default ChatInterface;
