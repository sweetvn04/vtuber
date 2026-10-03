"use client";

import React, { useState, useMemo } from 'react';

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
    const [search, setSearch] = useState('');
    const [hoveredId, setHoveredId] = useState<string | null>(null);

    const filtered = useMemo(() => {
        if (!search.trim()) return sessions;
        const q = search.toLowerCase();
        return sessions.filter(s =>
            (s.title || '').toLowerCase().includes(q) ||
            (s.preview || '').toLowerCase().includes(q)
        );
    }, [sessions, search]);

    // Group by date (Today / Yesterday / Older)
    const grouped = useMemo(() => {
        const now = new Date();
        const today = now.toDateString();
        const yesterday = new Date(now.getTime() - 86400000).toDateString();

        const groups: { label: string; items: any[] }[] = [
            { label: 'Hôm nay', items: [] },
            { label: 'Hôm qua', items: [] },
            { label: 'Trước đó', items: [] },
        ];

        for (const s of filtered) {
            const d = new Date(s.created_at || Date.now()).toDateString();
            if (d === today) groups[0].items.push(s);
            else if (d === yesterday) groups[1].items.push(s);
            else groups[2].items.push(s);
        }

        return groups.filter(g => g.items.length > 0);
    }, [filtered]);

    return (
        <div className="flex flex-col h-full select-none"
            style={{ background: 'rgba(15,17,23,0.97)', backdropFilter: 'blur(20px)', borderRight: '1px solid var(--border-subtle)' }}>

            {/* ── HEADER ── */}
            <div className="p-4 shrink-0" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-slate-200">Cuộc trò chuyện</span>
                    <button
                        onClick={onNewChat}
                        className="btn-ghost w-8 h-8 flex items-center justify-center rounded-xl text-lg leading-none text-slate-400 hover:text-white"
                        title="Tạo cuộc trò chuyện mới"
                    >
                        +
                    </button>
                </div>

                {/* Search bar */}
                <div className="relative">
                    <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none"
                        fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                    </svg>
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Tìm kiếm…"
                        className="w-full bg-transparent text-sm text-slate-300 placeholder-slate-500 outline-none pl-8 pr-3 py-1.5 rounded-xl"
                        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
                    />
                </div>
            </div>

            {/* ── SESSION LIST ── */}
            <div className="grow overflow-y-auto p-2">
                {sessions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 gap-3 text-center px-4">
                        <div className="text-3xl opacity-30">💬</div>
                        <p className="text-sm text-slate-500">Chưa có cuộc trò chuyện nào</p>
                        <button
                            onClick={onNewChat}
                            className="btn-primary text-xs px-4 py-2 rounded-xl font-medium"
                        >
                            Tạo chat mới
                        </button>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-32 text-center px-4">
                        <p className="text-sm text-slate-500">Không tìm thấy kết quả</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {grouped.map(group => (
                            <div key={group.label}>
                                <div className="px-2 pb-1 text-xs font-medium text-slate-500 uppercase tracking-wider">
                                    {group.label}
                                </div>
                                <div className="space-y-0.5">
                                    {group.items.map(chat => {
                                        const isSelected = selectedSessionId === chat.id;
                                        const isHovered = hoveredId === chat.id;
                                        return (
                                            <div
                                                key={chat.id}
                                                className={`sidebar-item group relative px-3 py-2.5 cursor-pointer ${isSelected ? 'active' : ''}`}
                                                onClick={() => onSelectChat && onSelectChat(chat)}
                                                onMouseEnter={() => setHoveredId(chat.id)}
                                                onMouseLeave={() => setHoveredId(null)}
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex-1 min-w-0">
                                                        <p className={`text-sm truncate font-medium ${isSelected ? 'text-violet-300' : 'text-slate-200'}`}>
                                                            {chat.title || 'Untitled'}
                                                        </p>
                                                        <p className="text-xs text-slate-500 truncate mt-0.5">
                                                            {chat.preview || 'Chưa có tin nhắn'}
                                                        </p>
                                                    </div>

                                                    {/* Delete button — show on hover or mobile */}
                                                    {(isHovered || isSelected) && onDeleteSession && (
                                                        <button
                                                            className="btn-danger shrink-0 w-6 h-6 flex items-center justify-center rounded-lg text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                                            onClick={e => { e.stopPropagation(); onDeleteSession(chat.id); }}
                                                            title="Xóa"
                                                        >
                                                            ×
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ── FOOTER SETTINGS ── */}
            <div className="shrink-0 p-3 space-y-1" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                {/* TTS Toggle */}
                <button
                    onClick={onToggleTts}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all text-sm group"
                    style={{ background: 'var(--bg-surface)', border: '1px solid transparent' }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'transparent')}
                >
                    <div className="flex items-center gap-2.5">
                        <span className="text-base">{isTtsEnabled ? '🔊' : '🔇'}</span>
                        <span className="text-slate-300 font-medium">Piper TTS</span>
                    </div>
                    <div className={`w-9 h-5 rounded-full relative transition-colors ${isTtsEnabled ? 'bg-violet-600' : 'bg-slate-700'}`}>
                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${isTtsEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </div>
                </button>

                {/* Theme Toggle */}
                <button
                    onClick={onToggleDarkMode}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all text-sm group"
                    style={{ background: 'var(--bg-surface)', border: '1px solid transparent' }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'transparent')}
                >
                    <div className="flex items-center gap-2.5">
                        <span className="text-base">{isDarkMode ? '🌙' : '☀️'}</span>
                        <span className="text-slate-300 font-medium">{isDarkMode ? 'Dark Mode' : 'Light Mode'}</span>
                    </div>
                    <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </button>

                {/* Count */}
                <p className="text-xs text-slate-600 text-center pt-1">
                    {sessions.length} cuộc trò chuyện
                </p>
            </div>
        </div>
    );
};

export default ChatHistorySidebar;
