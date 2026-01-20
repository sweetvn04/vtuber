"use client";

import React, { useState } from 'react';

interface ChatItem {
    id: string;
    title: string;
    date: string;
    preview: string;
}

interface ChatHistorySidebarProps {
    onSelectChat?: (chat: any) => void;
    onNewChat?: () => void;
    sessions?: any[];
    selectedSessionId?: string | null;
    onDeleteSession?: (id: string) => void;
}

const ChatHistorySidebar: React.FC<ChatHistorySidebarProps> = ({
    onSelectChat,
    onNewChat,
    sessions = [],
    selectedSessionId,
    onDeleteSession
}) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            {/* Nút toggle sidebar */}
            <button
                className={`fixed top-5 left-5 z-[1001] w-[50px] h-[50px] bg-white border border-white/80 rounded-full shadow-[0_4px_20px_rgba(252,182,159,0.15),0_2px_8px_rgba(0,0,0,0.05)] text-[#fcb69f] text-2xl font-bold flex items-center justify-center cursor-pointer transition-all duration-400 hover:scale-105 hover:rotate-90 hover:shadow-[0_8px_30px_rgba(252,182,159,0.2),0_4px_12px_rgba(0,0,0,0.08)]`}
                onClick={() => setIsOpen(!isOpen)}
            >
                {isOpen ? '✕' : '☰'}
            </button>

            {/* Sidebar chính */}
            <div className={`fixed top-0 left-0 bottom-0 w-[320px] bg-white shadow-[0_4px_30px_rgba(252,182,159,0.25),0_2px_10px_rgba(0,0,0,0.08)] border-r border-white/80 flex flex-col z-[1000] transition-transform duration-400 ease-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>

                {/* Header */}
                <div className="p-6 pt-20 border-b border-[#fcb69f]/20 flex justify-between items-center shrink-0">
                    <h3 className="m-0 text-[#333] text-lg font-semibold">💬 Lịch sử chat</h3>
                    <button
                        className="bg-gradient-to-br from-[#ffeaa7] to-[#fcb69f] color-[#5d4037] border-none rounded-xl px-4 py-2.5 text-sm font-semibold cursor-pointer transition-all duration-300 shadow-[0_2px_8px_rgba(252,182,159,0.3)] hover:shadow-[0_4px_15px_rgba(252,182,159,0.5)] hover:-translate-y-0.5"
                        onClick={onNewChat}
                    >
                        ➕ Chat mới
                    </button>
                </div>

                {/* Danh sách chat */}
                <div className="grow overflow-y-auto p-4 px-6 bg-[#fdfdfd]">
                    {sessions.length === 0 ? (
                        <div className="text-center py-10 px-5 text-[#aaa] text-sm">
                            <p className="m-1">Chưa có lịch sử chat</p>
                            <p className="m-1 text-xs opacity-70">Bắt đầu cuộc trò chuyện đầu tiên!</p>
                        </div>
                    ) : (
                        sessions.map((chat) => (
                            <div
                                key={chat.id}
                                className={`relative p-4 mb-3 rounded-2xl border cursor-pointer transition-all duration-300 group ${selectedSessionId === chat.id
                                    ? 'border-transparent bg-gradient-to-br from-[#ffecd2] to-[#fcb69f] shadow-[0_4px_20px_rgba(252,182,159,0.3)] -translate-y-0.5'
                                    : 'bg-white border-[#f0f0f0] hover:border-[#fcb69f]/50 hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(252,182,159,0.15)]'}`}
                                onClick={() => {
                                    onSelectChat && onSelectChat(chat);
                                    setIsOpen(false);
                                }}
                            >
                                <div className={`font-semibold mb-1 truncate ${selectedSessionId === chat.id ? 'text-[#5d4037]' : 'text-[#333]'}`}>
                                    {chat.title || 'No Title'}
                                </div>
                                <div className={`text-sm truncate mb-2 ${selectedSessionId === chat.id ? 'text-[#7c584e]' : 'text-[#777]'}`}>
                                    {chat.preview || 'Chưa có tin nhắn...'}
                                </div>
                                <div className={`text-[12px] ${selectedSessionId === chat.id ? 'text-[#a1887f]' : 'text-[#aaa]'}`}>
                                    {new Date(chat.created_at || Date.now()).toLocaleDateString()}
                                </div>

                                {/* Nút xóa */}
                                <button
                                    className="absolute top-2.5 right-2.5 bg-transparent border-none cursor-pointer text-base text-[#aaa] opacity-0 group-hover:opacity-100 transition-all duration-200 hover:text-red-500 hover:scale-125"
                                    onClick={(e) => { e.stopPropagation(); onDeleteSession && onDeleteSession(chat.id); }}
                                >
                                    🗑️
                                </button>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 px-6 text-center text-xs text-[#aaa] border-t border-[#fcb69f]/20 shrink-0">
                    <p>Tổng: {sessions.length} cuộc trò chuyện</p>
                </div>
            </div>
        </>
    );
};

export default ChatHistorySidebar;
