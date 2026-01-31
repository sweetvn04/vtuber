"use client";

import React, { useState, useRef, useEffect } from 'react';

interface ChatInterfaceProps {
    chatLog?: any[];
    onSendMessage?: (text: string) => void;
    disabled?: boolean;
    isThinking?: boolean;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ chatLog = [], onSendMessage, disabled, isThinking }) => {
    const [input, setInput] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const recognitionRef = useRef<any>(null);
    const messageEndRef = useRef<HTMLDivElement>(null);
    const isPushToTalkRef = useRef(false);

    // --- RECOGNITION LOGIC ---
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
                    if (event.results[i].isFinal) {
                        finalTranscript += event.results[i][0].transcript;
                    } else {
                        interimTranscript += event.results[i][0].transcript;
                    }
                }

                if (finalTranscript) {
                    setInput('');
                    if (onSendMessage) {
                        onSendMessage(finalTranscript);
                    }
                    setIsRecording(false);
                } else if (interimTranscript) {
                    setInput(interimTranscript);
                }
            };

            recognition.onstart = () => {
                setIsRecording(true);
            };

            recognition.onerror = (event: any) => {
                if (event.error !== 'no-speech' && event.error !== 'aborted') {
                    console.warn('Speech recognition:', event.error);
                }
                setIsRecording(false);
            };

            recognition.onend = () => {
                setIsRecording(false);
            };

            recognitionRef.current = recognition;
        }
    }, [onSendMessage]);

    const startRecording = () => {
        if (!recognitionRef.current) return;

        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(() => {
                setInput('');
                setIsRecording(true);
                try {
                    recognitionRef.current.start();
                } catch (err) {
                    setIsRecording(false);
                }
            })
            .catch((err) => {
                console.error("Microphone access denied:", err);
                setIsRecording(false);
            });
    };

    const stopRecording = () => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
            setIsRecording(false);
        }
    };

    const toggleRecording = () => {
        if (!recognitionRef.current) {
            alert("Trình duyệt của bạn không hỗ trợ Speech Recognition.\n\nLưu ý:\n- Hãy sử dụng Chrome hoặc Edge.\n- Đảm bảo truy cập qua 'localhost' hoặc 'https'.");
            return;
        }

        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    };

    // --- KEYBOARD LISTENERS (PUSH TO TALK) ---
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key.toLowerCase() === 'm' &&
                !e.repeat &&
                document.activeElement?.tagName !== 'INPUT' &&
                document.activeElement?.tagName !== 'TEXTAREA') {

                isPushToTalkRef.current = true;
                startRecording();
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key.toLowerCase() === 'm' && isPushToTalkRef.current) {
                isPushToTalkRef.current = false;
                stopRecording();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    // --- AUTO SCROLL ---
    useEffect(() => {
        messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatLog]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (input.trim() && onSendMessage && !disabled) {
            onSendMessage(input);
            setInput('');
        }
    };

    return (
        <div className="flex flex-col h-full bg-gradient-to-br from-[#fff5f5] to-[#ffe8e8] rounded-2xl overflow-hidden">
            <div className="grow overflow-y-auto p-6 block scrollbar-thin scrollbar-thumb-[#fcb69f]/50 scrollbar-track-transparent">
                <div className="p-3.5 px-4.5 my-4 rounded-2xl max-w-[75%] leading-relaxed text-sm bg-white text-[#2d3748] self-start shadow-[0_2px_8px_rgba(252,182,159,0.15)] border border-[#fcb69f]/20 rounded-bl-sm animate-in slide-in-from-bottom-2 duration-300">
                    <p>Hi there! How can I help you today?</p>
                </div>
                {chatLog.map((msg, index) => (
                    <div
                        key={index}
                        className={`p-3.5 px-4.5 my-4 rounded-2xl max-w-[75%] leading-relaxed text-sm animate-in slide-in-from-bottom-2 duration-300 ${msg.role === 'assistant'
                            ? 'bg-white text-[#2d3748] self-start shadow-[0_2px_8px_rgba(252,182,159,0.15)] border border-[#fcb69f]/20 rounded-bl-sm'
                            : 'bg-gradient-to-br from-[#fcb69f] to-[#ffa07a] text-white self-end ml-auto shadow-[0_2px_12px_rgba(252,182,159,0.3)] rounded-br-sm'
                            }`}
                    >
                        <p className="break-words m-0">{msg.content}</p>
                    </div>
                ))}
                {isThinking && (
                    <div className="p-3.5 px-4.5 my-4 rounded-2xl max-w-[75%] leading-relaxed text-sm bg-white text-[#718096] self-start shadow-[0_2px_8px_rgba(252,182,159,0.15)] border border-dashed border-[#fcb69f]/30 rounded-bl-sm animate-pulse flex items-center gap-2">
                        <span>Hiyori is thinking... 💭</span>
                    </div>
                )}
                <div ref={messageEndRef} />
            </div>

            <form className="flex gap-2.5 p-5 px-6 bg-white border-t border-[#fcb69f]/20 items-center" onSubmit={handleSubmit}>
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={disabled ? "Chọn chat để bắt đầu..." : (isRecording ? "Hiyori đang nghe..." : "Nhập tin nhắn (Hoặc giữ phím M để nói)...")}
                    disabled={disabled}
                    className="grow border-2 border-[#fcb69f]/30 p-3 px-4.5 rounded-[24px] bg-[#fff9f5] text-[#2d3748] text-sm transition-all duration-200 outline-none focus:border-[#fcb69f] focus:bg-white focus:shadow-[0_0_0_3px_rgba(252,182,159,0.15)] disabled:opacity-60 disabled:cursor-not-allowed placeholder-[#a0aec0]"
                />
                <button
                    type="submit"
                    disabled={disabled || !input.trim()}
                    className="p-3 px-6 border-none rounded-[24px] bg-gradient-to-br from-[#fcb69f] to-[#ffa07a] text-white font-semibold text-sm cursor-pointer transition-all duration-200 shadow-[0_2px_8px_rgba(252,182,159,0.3)] min-w-[80px] hover:not-disabled:-translate-y-0.5 hover:not-disabled:shadow-[0_4px_12px_rgba(252,182,159,0.4)] active:not-disabled:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                    Gửi
                </button>
                <button
                    type="button"
                    onClick={toggleRecording}
                    disabled={disabled}
                    className={`p-3 px-4 border-none rounded-full text-lg cursor-pointer transition-all duration-200 w-12 h-12 flex items-center justify-center hover:scale-110 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${isRecording
                        ? 'bg-red-500 text-white animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.5)]'
                        : 'bg-gradient-to-br from-[#ffeaa7] to-[#fdcb6e] text-[#2d3748] shadow-[0_2px_8px_rgba(255,234,167,0.4)]'
                        }`}
                    title={isRecording ? "Đang lắng nghe..." : "Nói chuyện với Hiyori (Nhấn hoặc Giữ phím M)"}
                >
                    {isRecording ? '⏹️' : '🎤'}
                </button>
            </form>
        </div>
    );
};

export default ChatInterface;
