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
}

const ChatHistorySidebar: React.FC<ChatHistorySidebarProps> = ({
    onSelectChat,
    onNewChat,
    sessions = [],
    selectedSessionId,
    onDeleteSession,
    isDarkMode = false
}) => {
    // Không cần state isOpen nữa vì Sidebar được quản lý bởi layout cha (hidden lg:block)

    const baseText = isDarkMode ? 'text-gray-200' : 'text-gray-800';
    const subText = isDarkMode ? 'text-gray-400' : 'text-gray-500';
    const activeBg = isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-blue-50 border-blue-200';
    const hoverBg = isDarkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-50';
    const border = isDarkMode ? 'border-gray-700' : 'border-gray-200';

    return (
        <div className={`flex flex-col h-full ${baseText}`}>
            {/* Header */}
            <div className={`p-4 border-b flex justify-between items-center ${border} ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                <h3 className="font-bold text-sm uppercase tracking-wider opacity-80">History</h3>
                <button
                    className={`p-2 rounded-full transition-colors flex items-center justify-center ${isDarkMode ? 'bg-gray-700 hover:bg-gray-600 text-blue-400' : 'bg-blue-50 hover:bg-blue-100 text-blue-600'}`}
                    onClick={onNewChat}
                    title="New Chat"
                >
                    <span className="text-lg leading-none">+</span>
                </button>
            </div>

            {/* List */}
            <div className={`grow overflow-y-auto p-2 space-y-2 ${isDarkMode ? 'bg-gray-900' : 'bg-white'}`}>
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
                                    ? `${activeBg} shadow-sm`
                                    : `border-transparent ${hoverBg}`
                                }`}
                            onClick={() => onSelectChat && onSelectChat(chat)}
                        >
                            <div className="flex justify-between items-start mb-1">
                                <h4 className={`font-semibold text-sm truncate pr-6 ${selectedSessionId === chat.id ? (isDarkMode ? 'text-blue-300' : 'text-blue-700') : baseText}`}>
                                    {chat.title || 'Untitled Chat'}
                                </h4>
                                {selectedSessionId === chat.id && (
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
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
                                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md text-red-400 hover:bg-red-50 hover:text-red-600 transition-all text-xs"
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

            {/* Footer */}
            <div className={`p-3 text-center text-[10px] ${subText} border-t ${border} ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
                {sessions.length} conversations stored
            </div>
        </div>
    );
};

export default ChatHistorySidebar;
