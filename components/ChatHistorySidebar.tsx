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
    isDarkMode?: boolean;
    onToggleDarkMode?: () => void;
    isTtsEnabled?: boolean;
    onToggleTts?: () => void;
}

const ChatHistorySidebar: React.FC<ChatHistorySidebarProps> = ({
    onSelectChat,
    onNewChat,
    sessions = [],
    selectedSessionId,
    onDeleteSession,
    isDarkMode = false,
    onToggleDarkMode,
    isTtsEnabled = true,
    onToggleTts,
}) => {
    // Không cần state isOpen nữa vì Sidebar được quản lý bởi layout cha (hidden lg:block)

    const baseText = 'text-gray-100';
    const subText = 'text-gray-300';
    const activeBg = 'bg-purple-500/30 border-purple-400/40 backdrop-blur-sm';
    const hoverBg = 'hover:bg-white/10';
    const border = 'border-white/10';

    return (
        <div className={`flex flex-col h-full ${baseText}`}>
            {/* Header */}
            <div className={`p-4 pl-12 lg:pl-4 border-b flex justify-between items-center
                border-white/10 bg-black/20 backdrop-blur-xl`}>
                <h3 className="font-bold text-sm uppercase tracking-wider opacity-80 text-white">History</h3>
                <button
                    className="p-2 rounded-full transition-colors flex items-center justify-center
                        bg-purple-500/30 hover:bg-purple-500/50 text-purple-200 border border-purple-400/30"
                    onClick={onNewChat}
                    title="New Chat"
                >
                    <span className="text-lg leading-none">+</span>
                </button>
            </div>

            {/* List */}
            <div className="grow overflow-y-auto p-2 space-y-2 bg-transparent">
                {sessions.length === 0 ? (
                    <div className={`text-center py-10 px-4 text-xs ${subText}`}>
                        <p>No chat history yet.</p>
                        <p className="mt-1 opacity-70">Start a new conversation!</p>
                    </div>
                ) : (
                    sessions.map((chat) => (
                        <div
                            key={chat.id}
                            className={`group relative p-3 rounded-xl border transition-all cursor-pointer ${selectedSessionId === chat.id
                                    ? activeBg
                                    : `border-transparent ${hoverBg}`
                                }`}
                            onClick={() => onSelectChat && onSelectChat(chat)}
                        >
                            <div className="flex justify-between items-start mb-1">
                                <h4 className={`font-semibold text-sm truncate pr-6 ${selectedSessionId === chat.id ? 'text-purple-200' : baseText
                                    }`}>
                                    {chat.title || 'Untitled Chat'}
                                </h4>
                                {selectedSessionId === chat.id && (
                                    <div className="w-1.5 h-1.5 rounded-full bg-purple-400 mt-1.5 shrink-0" />
                                )}
                            </div>

                            <p className={`text-xs truncate ${subText} opacity-80 mb-2`}>
                                {chat.preview || 'No messages yet...'}
                            </p>

                            <div className="flex justify-between items-center">
                                <span className={`text-[10px] ${subText} opacity-60`}>
                                    {new Date(chat.created_at || Date.now()).toLocaleDateString()}
                                </span>

                                <button
                                    className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 p-1.5 rounded-md text-red-300 hover:bg-red-500/20 hover:text-red-200 transition-all text-xs"
                                    onClick={(e) => { e.stopPropagation(); onDeleteSession && onDeleteSession(chat.id); }}
                                    title="Delete chat"
                                >
                                    🗑️
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Settings */}
            <div className="border-t border-white/10 bg-black/20 backdrop-blur-xl">
                <div className={`px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest opacity-50 ${subText}`}>Settings</div>

                {/* Dark Mode Toggle */}
                <div className="flex items-center justify-between px-4 py-2.5">
                    <div className="flex items-center gap-2">
                        <span className="text-base">{isDarkMode ? '🌙' : '☀️'}</span>
                        <span className={`text-xs font-medium ${subText}`}>Dark Mode</span>
                    </div>
                    <button
                        onClick={onToggleDarkMode}
                        className={`relative w-10 h-5 rounded-full transition-colors duration-300 focus:outline-none
                            ${isDarkMode ? 'bg-blue-500/70' : 'bg-white/30'}`}
                        title="Toggle Dark Mode"
                    >
                        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-300
                            ${isDarkMode ? 'translate-x-5' : 'translate-x-0'}`}
                        />
                    </button>
                </div>

                {/* TTS Voice Toggle */}
                <div className="flex items-center justify-between px-4 py-2.5">
                    <div className="flex items-center gap-2">
                        <span className="text-base">{isTtsEnabled ? '🔊' : '🔇'}</span>
                        <span className={`text-xs font-medium ${subText}`}>Voice (TTS)</span>
                    </div>
                    <button
                        onClick={onToggleTts}
                        className={`relative w-10 h-5 rounded-full transition-colors duration-300 focus:outline-none
                            ${isTtsEnabled ? 'bg-purple-500/70' : 'bg-white/20'}`}
                        title={isTtsEnabled ? 'Tắt giọng nói' : 'Bật giọng nói'}
                    >
                        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-300
                            ${isTtsEnabled ? 'translate-x-5' : 'translate-x-0'}`}
                        />
                    </button>
                </div>

                {/* Footer count */}
                <div className={`px-4 pb-3 pt-1 text-[10px] text-center ${subText} opacity-50`}>
                    {sessions.length} conversations stored
                </div>
            </div>
        </div>
    );
};

export default ChatHistorySidebar;
