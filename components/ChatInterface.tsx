"use client";

import React, { useState, useRef, useEffect } from 'react';

interface Message {
    role: 'user' | 'assistant' | 'system' | 'error';
    content: string;
}

interface ChatInterfaceProps {
    chatLog?: any[];
    onSendMessage?: (text: string) => void;
    disabled?: boolean;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ chatLog = [], onSendMessage, disabled }) => {
    const [input, setInput] = useState('');
    const messageEndRef = useRef<HTMLDivElement>(null);

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
                {chatLog.length === 0 && (
                    <div className="p-3.5 px-4.5 my-4 rounded-2xl max-w-[75%] leading-relaxed text-sm bg-white text-[#2d3748] self-start shadow-[0_2px_8px_rgba(252,182,159,0.15)] border border-[#fcb69f]/20 rounded-bl-sm animate-in slide-in-from-bottom-2 duration-300">
                        <p>Xin chào! Tôi có thể giúp gì cho bạn?</p>
                    </div>
                )}
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
                <div ref={messageEndRef} />
            </div>

            <form className="flex gap-2.5 p-5 px-6 bg-white border-t border-[#fcb69f]/20 items-center" onSubmit={handleSubmit}>
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={disabled ? "Chọn chat để bắt đầu..." : "Nhập tin nhắn..."}
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
                    className="p-3 px-4 border-none rounded-full bg-gradient-to-br from-[#ffeaa7] to-[#fdcb6e] text-[#2d3748] text-lg cursor-pointer transition-all duration-200 shadow-[0_2px_8px_rgba(255,234,167,0.4)] w-12 h-12 flex items-center justify-center hover:scale-110 hover:shadow-[0_4px_12px_rgba(255,234,167,0.5)] active:scale-95"
                >
                    🎤
                </button>
            </form>
        </div>
    );
};

export default ChatInterface;
