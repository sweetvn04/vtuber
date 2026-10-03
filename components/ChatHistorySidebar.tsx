"use client";

import React from 'react';

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
    isDarkMode = true,
    onToggleDarkMode,
    isTtsEnabled = true,
    onToggleTts,
}) => {
    return (
        <div className="flex flex-col h-full text-slate-200 font-sans select-none bg-[#0d111a]/95 backdrop-blur-xl border-r-2 border-slate-800">
            {/* Header */}
            <div className="p-4 pl-12 lg:pl-4 border-b-2 border-slate-800 flex justify-between items-center bg-[#141a26]">
                <div className="flex items-center gap-2">
                    <span className="text-emerald-400 text-sm">📜</span>
                    <h3 className="font-pixel text-xs text-emerald-400 tracking-wider uppercase">
                        SESSIONS
                    </h3>
                </div>
                <button
                    className="mc-btn px-2.5 py-1 rounded text-[10px] font-pixel uppercase flex items-center gap-1"
                    onClick={onNewChat}
                    title="Tạo cuộc trò chuyện mới"
                >
                    <span>+</span>
                    <span className="hidden sm:inline">NEW</span>
                </button>
            </div>

            {/* Session List */}
            <div className="grow overflow-y-auto p-3 space-y-2.5">
                {sessions.length === 0 ? (
                    <div className="mc-card p-4 rounded text-center my-6">
                        <p className="font-pixel text-[10px] text-slate-400 mb-2">NO DATA</p>
                        <p className="text-xs text-slate-400">Chưa có lịch sử chat.</p>
                        <p className="text-[11px] text-emerald-400 mt-2 font-mono">Bấm [+ NEW] để bắt đầu!</p>
                    </div>
                ) : (
                    sessions.map((chat) => {
                        const isSelected = selectedSessionId === chat.id;
                        return (
                            <div
                                key={chat.id}
                                className={`group relative p-3 rounded transition-all cursor-pointer ${
                                    isSelected
                                        ? 'bg-[#1a2333] border-2 border-emerald-400/90 shadow-[0_0_12px_rgba(76,175,80,0.25)]'
                                        : 'bg-[#141a26]/80 hover:bg-[#182030] border-2 border-slate-800/80 hover:border-slate-700'
                                }`}
                                onClick={() => onSelectChat && onSelectChat(chat)}
                            >
                                <div className="flex justify-between items-start gap-2 mb-1.5">
                                    <h4
                                        className={`font-semibold text-xs truncate font-mono ${
                                            isSelected ? 'text-emerald-300 font-bold' : 'text-slate-200'
                                        }`}
                                    >
                                        {chat.title || 'Untitled Chat'}
                                    </h4>
                                    {isSelected && (
                                        <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 mt-1 animate-ping" />
                                    )}
                                </div>

                                <p className="text-[11px] truncate text-slate-400 mb-2 font-sans">
                                    {chat.preview || 'No messages yet...'}
                                </p>

                                <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 pt-1 border-t border-slate-800/60">
                                    <span className="text-slate-400">
                                        📅 {new Date(chat.created_at || Date.now()).toLocaleDateString()}
                                    </span>

                                    <button
                                        className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 px-1.5 py-0.5 rounded bg-red-950/60 hover:bg-red-800 text-red-300 hover:text-white border border-red-700/50 transition-all text-[10px] font-pixel"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDeleteSession && onDeleteSession(chat.id);
                                        }}
                                        title="Xóa cuộc trò chuyện này"
                                    >
                                        DEL
                                    </button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* System Control Settings */}
            <div className="border-t-2 border-slate-800 bg-[#12161f] p-3 space-y-2">
                <div className="font-pixel text-[9px] text-emerald-400/80 uppercase tracking-widest px-1">
                    CONTROLS
                </div>

                {/* TTS Voice Toggle */}
                <div className="flex items-center justify-between px-2 py-1.5 rounded mc-card">
                    <div className="flex items-center gap-2">
                        <span className="text-sm">{isTtsEnabled ? '🔊' : '🔇'}</span>
                        <span className="text-xs font-mono text-slate-300">PIPER TTS</span>
                    </div>
                    <button
                        onClick={onToggleTts}
                        className={`${
                            isTtsEnabled ? 'mc-btn' : 'mc-btn-stone'
                        } px-2.5 py-1 rounded text-[9px] font-pixel uppercase`}
                        title={isTtsEnabled ? 'Tắt giọng nói' : 'Bật giọng nói'}
                    >
                        {isTtsEnabled ? 'ON' : 'OFF'}
                    </button>
                </div>

                {/* Dark Mode Toggle */}
                <div className="flex items-center justify-between px-2 py-1.5 rounded mc-card">
                    <div className="flex items-center gap-2">
                        <span className="text-sm">{isDarkMode ? '🌙' : '☀️'}</span>
                        <span className="text-xs font-mono text-slate-300">THEME</span>
                    </div>
                    <button
                        onClick={onToggleDarkMode}
                        className="mc-btn-stone px-2.5 py-1 rounded text-[9px] font-pixel uppercase"
                        title="Đổi giao diện"
                    >
                        {isDarkMode ? 'DARK' : 'LIGHT'}
                    </button>
                </div>

                {/* Footer Count */}
                <div className="pt-1 text-[9px] text-center font-pixel text-slate-400">
                    <span className="text-emerald-400">{sessions.length}</span> LOGS STORED
                </div>
            </div>
        </div>
    );
};

export default ChatHistorySidebar;
