"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";

// --- COMPONENTS ---
import ChatInterface from "@/components/ChatInterface";
import dynamic from "next/dynamic";
const VtuberModelDisplay = dynamic(() => import("@/components/VtuberModelDisplay"), { ssr: false });
import UserCamera from "@/components/UserCamera";
import ChatHistorySidebar from "@/components/ChatHistorySidebar";

// --- HELPERS ---
const getApiBase = () => {
    if (typeof window !== 'undefined') {
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return `http://${window.location.hostname}:8080`;
        }
        if (process.env.NEXT_PUBLIC_API_BASE) return process.env.NEXT_PUBLIC_API_BASE;
        return `http://${window.location.hostname}:8080`;
    }
    return "http://localhost:8080";
};

const getApiKey = () => process.env.NEXT_PUBLIC_API_KEY || "";

const apiFetch = (url: string, options: RequestInit = {}) => {
    return fetch(url, {
        ...options,
        headers: {
            ...(options.headers || {}),
            "X-API-Key": getApiKey(),
        },
    });
};

const getWsBase = () => {
    if (typeof window !== 'undefined') {
        const apiBase = getApiBase();
        return apiBase.startsWith("https://")
            ? apiBase.replace("https://", "wss://")
            : apiBase.replace("http://", "ws://");
    }
    return "ws://localhost:8080";
};

function base64ToBlob(base64: string, type: string) {
    const binStr = atob(base64);
    const arr = new Uint8Array(binStr.length);
    for (let i = 0; i < binStr.length; i++) arr[i] = binStr.charCodeAt(i);
    return new Blob([arr], { type });
}

// --- RESIZE CONSTANTS ---
const SIDEBAR_MIN = 200;
const SIDEBAR_MAX = 500;
const SIDEBAR_DEFAULT = 256;
const CHAT_MIN = 280;
const CHAT_MAX = 620;
const CHAT_DEFAULT = 380;

export default function Home() {
    // --- CHAT STATE ---
    const [sessions, setSessions] = useState<any[]>([]);
    const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
    const [chatLog, setChatLog] = useState<any[]>([]);
    const [status, setStatus] = useState("Disconnected");
    const [isWebcamOn, setIsWebcamOn] = useState(false);
    const [scanData, setScanData] = useState<any>(null);
    const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null);
    const [isThinking, setIsThinking] = useState(false);
    const [isTtsEnabled, setIsTtsEnabled] = useState(true);
    const [isSearching, setIsSearching] = useState(false);
    // null = chưa kiểm tra, true = online, false = offline
    const [backendOnline, setBackendOnline] = useState<boolean | null>(null);

    // --- UI STATE ---
    const [isDarkMode, setIsDarkMode] = useState(true);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isChatExpanded, setIsChatExpanded] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isPipModelVisible, setIsPipModelVisible] = useState(true);
    const [viewportHeight, setViewportHeight] = useState<string>('100dvh');

    // --- RESIZE STATE ---
    const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT);
    const [chatWidth, setChatWidth] = useState(480);
    const sidebarResizing = useRef(false);
    const chatResizing = useRef(false);
    const startX = useRef(0);
    const startWidth = useRef(0);

    // Biết đang desktop để chỉ áp dụng maxWidth trên desktop
    const [isDesktop, setIsDesktop] = useState(false);
    useEffect(() => {
        const check = () => {
            const desk = window.innerWidth >= 1024;
            setIsDesktop(desk);
            if (!desk) setIsSidebarOpen(false);
        };
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);

    // Tự động trigger resize cho PixiJS Canvas sau khi panel transition kết thúc
    useEffect(() => {
        const timer = setTimeout(() => {
            window.dispatchEvent(new Event('resize'));
        }, 320);
        return () => clearTimeout(timer);
    }, [isSidebarOpen, isChatExpanded, isPipModelVisible]);

    // --- BACKEND HEALTH CHECK (ping độc lập với session) ---
    useEffect(() => {
        const ping = async () => {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 4000);
            try {
                const res = await apiFetch(`${getApiBase()}/api/chat/sessions`, {
                    signal: controller.signal,
                });
                clearTimeout(timer);
                setBackendOnline(res.ok);
            } catch {
                clearTimeout(timer);
                setBackendOnline(false);
            }
        };
        ping();
        const interval = setInterval(ping, 8000);
        return () => clearInterval(interval);
    }, []);

    const ws = useRef<WebSocket | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const toggleTheme = () => setIsDarkMode(p => !p);

    // --- MODEL CLICK REACTION ---
    const [modelReaction, setModelReaction] = useState<string | null>(null);
    const MODEL_REACTIONS = [
        'Kyaa~!! (*≧•≦*)',
        'Hế hế~ có gì thế bạn? (´•ω•`)',
        'Click vào đâu đó :)?? ♥',
        'Định làm gì mình đó ( ﾟvﾟ)',
        '*blush* Sao lại nhìn mình thế... 💕',
        'Ehe~ có cần gì Hiyori không? ✨',
        'Wah! 😱 Bạn làm mình giật mình!',
        'Mou~ đừng có phá mình (ノ￣Д￣)ノ...',
    ];
    const handleModelClick = () => {
        const text = MODEL_REACTIONS[Math.floor(Math.random() * MODEL_REACTIONS.length)];
        setModelReaction(text);
        setTimeout(() => setModelReaction(null), 5000);
    };

    // --- RESIZE HANDLERS ---
    const onSidebarResizeStart = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        sidebarResizing.current = true;
        startX.current = e.clientX;
        startWidth.current = sidebarWidth;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    }, [sidebarWidth]);

    const onChatResizeStart = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        chatResizing.current = true;
        startX.current = e.clientX;
        startWidth.current = chatWidth;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    }, [chatWidth]);

    useEffect(() => {
        const onMove = (e: MouseEvent) => {
            if (sidebarResizing.current) {
                const delta = e.clientX - startX.current;
                setSidebarWidth(Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, startWidth.current + delta)));
            }
            if (chatResizing.current) {
                const delta = startX.current - e.clientX;
                setChatWidth(Math.min(CHAT_MAX, Math.max(CHAT_MIN, startWidth.current + delta)));
            }
        };
        const onUp = () => {
            sidebarResizing.current = false;
            chatResizing.current = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        return () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
    }, []);

    // --- VIEWPORT HEIGHT (mobile keyboard) ---
    useEffect(() => {
        const handleResize = () => {
            if (window.visualViewport) setViewportHeight(`${window.visualViewport.height}px`);
        };
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', handleResize);
            window.visualViewport.addEventListener('scroll', handleResize);
            handleResize();
        }
        return () => {
            if (window.visualViewport) {
                window.visualViewport.removeEventListener('resize', handleResize);
                window.visualViewport.removeEventListener('scroll', handleResize);
            }
        };
    }, []);

    // --- DATA FETCHING ---
    const fetchSessions = useCallback(async () => {
        const url = `${getApiBase()}/api/chat/sessions`;
        try {
            const res = await apiFetch(url);
            if (!res.ok) throw new Error(`Status ${res.status}`);
            const data = await res.json();
            setSessions(data);

            // AUTO SELECT or AUTO CREATE session for portfolio visitors
            if (data.length > 0) {
                setSelectedSessionId(prev => prev || data[0].id);
            } else {
                try {
                    const createUrl = `${getApiBase()}/api/chat/session/create`;
                    const createRes = await apiFetch(createUrl, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ title: "Cuộc trò chuyện mới" })
                    });
                    if (createRes.ok) {
                        const newSession = await createRes.json();
                        setSessions([newSession]);
                        setSelectedSessionId(newSession.id);
                    }
                } catch (err) {
                    console.error("Auto create failed", err);
                }
            }
        } catch (e: any) {
            console.log(`Failed to fetch sessions: ${e.message}`);
        }
    }, []);

    useEffect(() => { fetchSessions(); }, [fetchSessions]);

    const handleNewChat = useCallback(async () => {
        const title = window.prompt("Tên cuộc trò chuyện mới:", `Chat ${new Date().toLocaleTimeString()}`);
        if (!title) return;
        const url = `${getApiBase()}/api/chat/session/create`;
        try {
            const res = await apiFetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }) });
            if (!res.ok) throw new Error(`Status ${res.status}`);
            const data = await res.json();
            await fetchSessions();
            setSelectedSessionId(data.id);
        } catch (e: any) { window.alert(`Lỗi tạo session: ${e.message}`); }
    }, [fetchSessions]);

    const handleDeleteSession = useCallback(async (id: string) => {
        if (!window.confirm("Xóa cuộc trò chuyện này?")) return;
        try {
            const res = await apiFetch(`${getApiBase()}/api/chat/session/${id}`, { method: "DELETE" });
            if (res.ok) {
                await fetchSessions();
                if (selectedSessionId === id) { setSelectedSessionId(null); setChatLog([]); }
            }
        } catch (e) { console.error("Lỗi xóa session:", e); }
    }, [selectedSessionId, fetchSessions]);

    // --- WEBSOCKET ---
    useEffect(() => {
        if (!selectedSessionId) return;
        const loadHistory = async () => {
            try {
                const res = await apiFetch(`${getApiBase()}/api/chat/session/${selectedSessionId}`);
                const data = await res.json();
                setChatLog(data.history || []);
            } catch (e) { console.error("Lỗi tải lịch sử", e); }
        };
        loadHistory();

        if (ws.current) ws.current.close();
        ws.current = new WebSocket(`${getWsBase()}/ws/chat/${selectedSessionId}?api_key=${getApiKey()}`);
        ws.current.onopen = () => setStatus("Connected");
        ws.current.onclose = () => setStatus("Disconnected");
        ws.current.onerror = () => setStatus("Disconnected");
        ws.current.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === "AI_RESPONSE_TEXT") {
                    setChatLog(prev => [...prev, { role: "assistant", content: data.payload }]);
                    setIsThinking(false);
                    setIsSearching(false);
                } else if (data.type === "STATUS") {
                    if (data.payload === "searching") setIsSearching(true);
                } else if (data.type === "AUDIO") {
                    setCurrentAudioUrl(URL.createObjectURL(base64ToBlob(data.payload, 'audio/wav')));
                } else if (data.type === "SCAN_UPDATE") {
                    setScanData(data.payload);
                }
            } catch (err) { console.error("WS Error", err); }
        };
        return () => ws.current?.close();
    }, [selectedSessionId]);

    const handleSendMessage = useCallback((text: string) => {
        if (!ws.current || ws.current.readyState !== WebSocket.OPEN) return;
        ws.current.send(JSON.stringify({ type: "TEXT_MESSAGE", user_id: "12345678900923", payload: text, tts_enabled: isTtsEnabled }));
        setChatLog(prev => [...prev, { role: "user", content: text }]);
        setIsThinking(true);
        setIsSearching(false);
    }, [isTtsEnabled]);

    // --- WEBCAM ---
    useEffect(() => {
        if (!isWebcamOn) return;
        const interval = setInterval(() => {
            if (ws.current?.readyState === WebSocket.OPEN && videoRef.current && canvasRef.current) {
                const canvas = canvasRef.current;
                const video = videoRef.current;
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                canvas.getContext("2d")?.drawImage(video, 0, 0);
                ws.current.send(JSON.stringify({ type: "SCAN_FRAME", payload: canvas.toDataURL("image/jpeg", 0.5) }));
            }
        }, 2000);
        return () => clearInterval(interval);
    }, [isWebcamOn]);

    useEffect(() => {
        let stream: MediaStream | null = null;
        if (isWebcamOn && videoRef.current) {
            navigator.mediaDevices.getUserMedia({ video: true })
                .then(s => { stream = s; if (videoRef.current) videoRef.current.srcObject = s; })
                .catch(() => setIsWebcamOn(false));
        } else if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        return () => stream?.getTracks().forEach(t => t.stop());
    }, [isWebcamOn]);

    // ============================================================
    // RENDER
    // ============================================================
    return (
        <div
            className="relative flex flex-col w-full overflow-hidden text-slate-200 select-none bg-gradient-main"
            style={{ height: viewportHeight }}
        >
            {/* ── TOP NAVBAR ── */}
            <header className="relative z-50 w-full h-14 px-4 flex items-center justify-between shrink-0"
                style={{ background: 'rgba(15,17,23,0.9)', backdropFilter: 'blur(20px)', borderBottom: '1px solid var(--border-subtle)' }}>

                {/* Left: hamburger + branding */}
                <div className="flex items-center gap-2 sm:gap-3">
                    <button
                        className="btn-ghost w-9 h-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-white"
                        onClick={() =>
                            isDesktop
                                ? setIsSidebarOpen(prev => !prev)
                                : setIsMobileMenuOpen(prev => !prev)
                        }
                        title={isSidebarOpen ? 'Đóng sidebar' : 'Mở sidebar'}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
                        </svg>
                    </button>

                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm"
                            style={{ background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', boxShadow: '0 0 10px rgba(139,92,246,0.4)' }}>
                            ✨
                        </div>
                        <span className="font-semibold text-sm text-slate-200 hidden sm:inline">
                            Hiyori<span className="text-slate-500">.ai</span>
                        </span>
                    </div>

                    <button
                        onClick={handleNewChat}
                        className="btn-ghost px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 rounded-xl"
                        title="Tạo cuộc trò chuyện mới"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                        <span className="hidden sm:inline">Mới</span>
                    </button>
                </div>

                {/* Center: Layout switcher */}
                <div className="hidden md:flex items-center gap-1 p-1 rounded-xl"
                    style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                    <button
                        onClick={() => setIsChatExpanded(false)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                            !isChatExpanded
                                ? 'bg-violet-600/30 text-violet-300 shadow-sm'
                                : 'text-slate-400 hover:text-slate-200'
                        }`}
                        title="Split View: Live2D + Chat"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9" />
                        </svg>
                        Split
                    </button>
                    <button
                        onClick={() => { setIsChatExpanded(true); setIsPipModelVisible(true); }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                            isChatExpanded
                                ? 'bg-violet-600/30 text-violet-300 shadow-sm'
                                : 'text-slate-400 hover:text-slate-200'
                        }`}
                        title="Wide Chat"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                        </svg>
                        Chat
                    </button>
                </div>

                {/* Right controls */}
                <div className="flex items-center gap-2">
                    {isChatExpanded && !isPipModelVisible && (
                        <button
                            onClick={() => setIsPipModelVisible(true)}
                            className="btn-ghost px-3 py-1.5 text-xs font-medium rounded-xl flex items-center gap-1.5"
                        >
                            <span>✨</span>
                            <span className="hidden sm:inline">Hiyori</span>
                        </button>
                    )}

                    {/* TTS toggle */}
                    <button
                        onClick={() => setIsTtsEnabled(prev => !prev)}
                        className={`hidden sm:flex btn-ghost px-3 py-1.5 text-xs font-medium rounded-xl items-center gap-1.5 ${isTtsEnabled ? 'text-emerald-400' : 'text-slate-400'}`}
                        title={isTtsEnabled ? 'Tắt TTS' : 'Bật TTS'}
                    >
                        <span>{isTtsEnabled ? '🔊' : '🔇'}</span>
                        <span>TTS</span>
                    </button>

                    {/* Backend status */}
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium"
                        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                        <span className={`status-dot ${backendOnline === null ? 'loading' : backendOnline === false ? 'offline' : 'online'}`} />
                        <span className={`hidden sm:inline ${backendOnline === false ? 'text-red-400' : 'text-emerald-400'}`}>
                            {backendOnline === false ? 'Offline' : 'Online'}
                        </span>
                    </div>
                </div>
            </header>

            {/* ── MOBILE DRAWER BACKDROP ── */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* ── WORKSPACE BODY (Standard Flex Layout) ── */}
            <div className="relative flex-1 flex w-full min-h-0 overflow-hidden">
                {/* ── DESKTOP SIDEBAR (Collapsible like ChatGPT / Gemini) ── */}
                <div
                    className={`hidden lg:block h-full transition-[width,opacity] duration-300 ease-in-out shrink-0 overflow-hidden ${
                        isSidebarOpen ? 'w-64 opacity-100' : 'w-0 opacity-0 pointer-events-none'
                    }`}
                >
                    <div className="w-64 h-full">
                        <ChatHistorySidebar
                            sessions={sessions}
                            selectedSessionId={selectedSessionId}
                            onSelectChat={(chat: any) => setSelectedSessionId(chat.id)}
                            onNewChat={handleNewChat}
                            onDeleteSession={handleDeleteSession}
                            isDarkMode={isDarkMode}
                            onToggleDarkMode={toggleTheme}
                            isTtsEnabled={isTtsEnabled}
                            onToggleTts={() => setIsTtsEnabled((prev) => !prev)}
                        />
                    </div>
                </div>

                {/* ── MOBILE SIDEBAR DRAWER ── */}
                <div
                    className={`lg:hidden fixed inset-y-0 left-0 z-[55] w-72 h-full transition-transform duration-300 ease-in-out ${
                        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
                    }`}
                >
                    <div className="w-full h-full relative">
                        <button
                            className="absolute top-4 right-4 z-50 w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-white btn-ghost"
                            onClick={() => setIsMobileMenuOpen(false)}
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                        <ChatHistorySidebar
                            sessions={sessions}
                            selectedSessionId={selectedSessionId}
                            onSelectChat={(chat: any) => {
                                setSelectedSessionId(chat.id);
                                setIsMobileMenuOpen(false);
                            }}
                            onNewChat={() => {
                                handleNewChat();
                                setIsMobileMenuOpen(false);
                            }}
                            onDeleteSession={handleDeleteSession}
                            isDarkMode={isDarkMode}
                            onToggleDarkMode={toggleTheme}
                            isTtsEnabled={isTtsEnabled}
                            onToggleTts={() => setIsTtsEnabled((prev) => !prev)}
                        />
                    </div>
                </div>

                {/* ── LIVE2D MODEL STAGE ── */}
                <div
                    className={
                        isChatExpanded
                            ? `fixed bottom-6 right-6 z-40 w-52 h-72 rounded-2xl overflow-hidden transition-all duration-300 ${
                                  isPipModelVisible
                                      ? 'scale-100 opacity-100'
                                      : 'scale-75 opacity-0 pointer-events-none'
                              }`
                            : `relative shrink-0 h-[38vh] lg:h-full lg:flex-1 lg:shrink overflow-hidden flex flex-col transition-all duration-300`
                    }
                    style={isChatExpanded ? {
                        background: 'rgba(15,17,23,0.9)',
                        border: '1px solid var(--border-default)',
                        boxShadow: '0 8px 40px rgba(0,0,0,0.7), 0 0 0 1px rgba(139,92,246,0.2)'
                    } : undefined}
                >
                    {/* Mini PiP Header */}
                    {isChatExpanded && (
                        <div className="absolute top-0 left-0 right-0 z-30 flex justify-between items-center px-3 py-2 select-none"
                            style={{ background: 'rgba(15,17,23,0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border-subtle)' }}>
                            <div className="flex items-center gap-1.5 text-xs">
                                <span className="status-dot online" />
                                <span className="text-slate-300 font-medium">Hiyori</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setIsChatExpanded(false)}
                                    className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                                    title="Split View"
                                >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9" />
                                    </svg>
                                </button>
                                <button
                                    onClick={() => setIsPipModelVisible(false)}
                                    className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
                                    title="Ẩn"
                                >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Live2D Canvas - ALWAYS MOUNTED */}
                    <div className="w-full h-full relative">
                        <VtuberModelDisplay
                            status={status}
                            audioUrl={currentAudioUrl}
                            isDarkMode={isDarkMode}
                            toggleTheme={toggleTheme}
                            onModelClick={handleModelClick}
                        />

                        {/* Top-left HUD badge */}
                        {!isChatExpanded && (
                            <div className="absolute top-3 left-4 z-20 hud-badge px-3 py-1.5 flex items-center gap-2 pointer-events-none text-xs select-none">
                                <span className="status-dot online" />
                                <span className="font-medium text-slate-200">Hiyori</span>
                                <span className="text-slate-500 hidden sm:inline">· Cubism</span>
                            </div>
                        )}

                        {/* Bottom-left stats bar */}
                        {!isChatExpanded && (
                            <div className="absolute bottom-4 left-4 z-20 hud-badge p-3 pointer-events-none hidden sm:block select-none" style={{ minWidth: '180px' }}>
                                <div className="flex justify-between items-center text-xs text-slate-400 mb-2">
                                    <span className="text-violet-400 font-medium">AI Stats</span>
                                    <span className="text-cyan-400 font-mono text-xs">Gemini</span>
                                </div>
                                <div className="w-full bg-slate-900/80 h-1.5 rounded-full overflow-hidden mb-1.5">
                                    <div className="progress-bar-fill h-full rounded-full" style={{ width: '72%' }} />
                                </div>
                                <div className="text-xs text-slate-500 font-mono">
                                    Piper TTS • Live2D v4
                                </div>
                            </div>
                        )}

                        {/* Speech Bubble Popup */}
                        {modelReaction && (
                            <div className="absolute bottom-[62%] left-1/2 -translate-x-1/2 z-50 pointer-events-none">
                                <div
                                    style={{ animation: 'bubbleIn 0.25s ease-out', background: 'rgba(15,17,23,0.92)', border: '1px solid rgba(139,92,246,0.5)', boxShadow: '0 0 20px rgba(139,92,246,0.3)' }}
                                    className="px-4 py-2.5 rounded-2xl text-sm text-violet-200 max-w-[240px] text-center leading-snug whitespace-pre-wrap backdrop-blur-sm"
                                >
                                    <div className="text-xs text-violet-400 font-medium mb-1">Hiyori ✨</div>
                                    {modelReaction}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── DRAG RESIZE HANDLE ── */}
                {!isChatExpanded && (
                    <div
                        onMouseDown={onChatResizeStart}
                        className="hidden lg:flex items-center justify-center w-1.5 flex-shrink-0 cursor-col-resize group z-10 transition-colors select-none"
                        style={{ background: 'var(--border-subtle)' }}
                        title="Kéo để thay đổi chiều rộng"
                    >
                        <div className="w-0.5 h-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            style={{ background: 'var(--accent-violet)' }} />
                    </div>
                )}

                {/* ── CHAT INTERFACE PANE ── */}
                <div
                    className={`flex flex-col min-h-0 flex-shrink-0 transition-[width,flex] duration-300 ease-in-out ${
                        isChatExpanded ? 'flex-1 w-full h-full' : 'flex-1 lg:flex-none lg:h-full'
                    }`}
                    style={!isChatExpanded && isDesktop ? {
                        width: `${chatWidth}px`,
                        borderLeft: '1px solid var(--border-subtle)'
                    } : undefined}
                >
                    <ChatInterface
                        chatLog={chatLog}
                        onSendMessage={handleSendMessage}
                        disabled={!selectedSessionId}
                        isThinking={isThinking}
                        isSearching={isSearching}
                        isDarkMode={isDarkMode}
                        isFullScreen={isChatExpanded}
                        onToggleFullScreen={() => {
                            setIsChatExpanded((prev) => {
                                const nextState = !prev;
                                if (nextState) setIsPipModelVisible(true);
                                return nextState;
                            });
                        }}
                        backendOnline={backendOnline}
                        modelReaction={modelReaction}
                    />
                </div>
            </div>

            {/* Hidden webcam canvas */}
            <canvas ref={canvasRef} className="hidden" />
        </div>
    );
}

