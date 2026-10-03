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
            className="relative flex flex-col w-full overflow-hidden text-slate-200 select-none"
            style={{
                height: viewportHeight,
                backgroundImage: 'url(/anime_bg.png)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
            }}
        >
            {/* Dark Cyber Overlay */}
            <div className="absolute inset-0 pointer-events-none z-0 bg-[#0d111a]/70 backdrop-blur-[2px]" />

            {/* ── TOP NAVBAR (Standard ChatGPT / Gemini Header) ── */}
            <header className="relative z-50 w-full bg-[#0d111a]/95 backdrop-blur-md border-b-2 border-slate-800 h-14 px-3 sm:px-4 flex items-center justify-between shrink-0">
                {/* Left Brand & Sidebar Controls */}
                <div className="flex items-center gap-2 sm:gap-3">
                    <button
                        className="mc-btn-stone px-2.5 py-1.5 rounded text-xs font-pixel flex items-center gap-1.5"
                        onClick={() =>
                            isDesktop
                                ? setIsSidebarOpen((prev) => !prev)
                                : setIsMobileMenuOpen((prev) => !prev)
                        }
                        title={isSidebarOpen ? "Đóng danh sách chat" : "Mở danh sách chat"}
                    >
                        <span>☰</span>
                    </button>

                    <button
                        onClick={handleNewChat}
                        className="mc-btn px-2.5 py-1.5 rounded text-[10px] font-pixel uppercase flex items-center gap-1"
                        title="Tạo cuộc trò chuyện mới"
                    >
                        <span>+</span>
                        <span className="hidden sm:inline">NEW</span>
                    </button>

                    <div className="font-pixel text-xs sm:text-sm text-emerald-400 flex items-center gap-1.5 ml-1">
                        <span className="text-white">⛏️</span> sweetvn<span className="text-slate-500">/</span>hiyori.ai<span className="animate-pulse">_</span>
                    </div>
                </div>

                {/* Center: Layout View Mode Switcher (Split vs Wide Chat) */}
                <div className="hidden md:flex items-center bg-[#141a26] border-2 border-slate-700/80 rounded p-0.5">
                    <button
                        onClick={() => setIsChatExpanded(false)}
                        className={`px-3 py-1 rounded text-[10px] font-pixel uppercase transition-all flex items-center gap-1.5 ${
                            !isChatExpanded
                                ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/50 shadow-sm'
                                : 'text-slate-400 hover:text-slate-200'
                        }`}
                        title="Chế độ chia đôi màn hình: Model Live2D + Chat"
                    >
                        <span>◫</span>
                        <span>SPLIT VIEW</span>
                    </button>

                    <button
                        onClick={() => {
                            setIsChatExpanded(true);
                            setIsPipModelVisible(true);
                        }}
                        className={`px-3 py-1 rounded text-[10px] font-pixel uppercase transition-all flex items-center gap-1.5 ${
                            isChatExpanded
                                ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/50 shadow-sm'
                                : 'text-slate-400 hover:text-slate-200'
                        }`}
                        title="Chế độ mở rộng Chat (Chuẩn ChatGPT/Gemini)"
                    >
                        <span>⊞</span>
                        <span>WIDE CHAT</span>
                    </button>
                </div>

                {/* Right controls */}
                <div className="flex items-center gap-2 sm:gap-3">
                    {/* Floating Model restore button when minimized */}
                    {isChatExpanded && !isPipModelVisible && (
                        <button
                            onClick={() => setIsPipModelVisible(true)}
                            className="mc-btn-stone px-2.5 py-1 rounded text-[10px] font-pixel text-emerald-400 flex items-center gap-1"
                            title="Hiện lại model Hiyori"
                        >
                            <span>✨</span>
                            <span className="hidden sm:inline">SHOW MODEL</span>
                        </button>
                    )}

                    {/* Server status badge */}
                    <div className="mc-card px-2.5 py-1 rounded text-[10px] font-pixel flex items-center gap-1.5">
                        <span
                            className={`w-2 h-2 rounded-full ${
                                backendOnline === false
                                    ? 'bg-red-500 animate-pulse'
                                    : 'bg-emerald-400 animate-ping'
                            }`}
                        />
                        <span className={backendOnline === false ? 'text-red-400' : 'text-emerald-400'}>
                            {backendOnline === false ? 'OFFLINE' : 'ONLINE'}
                        </span>
                    </div>

                    {/* Quick TTS toggle */}
                    <button
                        onClick={() => setIsTtsEnabled((prev) => !prev)}
                        className={`hidden sm:flex ${
                            isTtsEnabled ? 'mc-btn' : 'mc-btn-stone'
                        } px-2.5 py-1 rounded text-[10px] font-pixel items-center gap-1`}
                        title={isTtsEnabled ? 'Tắt Piper TTS' : 'Bật Piper TTS'}
                    >
                        <span>{isTtsEnabled ? '🔊' : '🔇'}</span>
                        <span>{isTtsEnabled ? 'TTS ON' : 'TTS OFF'}</span>
                    </button>
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
                            className="absolute top-4 right-4 z-50 text-sm font-pixel text-slate-400 hover:text-white"
                            onClick={() => setIsMobileMenuOpen(false)}
                        >
                            ✕
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

                {/* ── LIVE2D MODEL STAGE (Full Stage in Split Mode, Floating PiP in Wide Chat Mode) ── */}
                <div
                    className={
                        isChatExpanded
                            ? `fixed bottom-24 right-6 z-40 w-52 h-72 rounded-xl overflow-hidden mc-card border-2 border-emerald-400 shadow-[0_8px_32px_rgba(0,0,0,0.8)] transition-all duration-300 ${
                                  isPipModelVisible
                                      ? 'scale-100 opacity-100'
                                      : 'scale-75 opacity-0 pointer-events-none'
                              }`
                            : `relative shrink-0 h-[38vh] lg:h-full lg:flex-1 lg:shrink overflow-hidden flex flex-col transition-all duration-300`
                    }
                >
                    {/* Mini PiP Header when chat is expanded */}
                    {isChatExpanded && (
                        <div className="absolute top-0 left-0 right-0 z-30 bg-[#141a26]/90 border-b border-slate-700/80 px-2.5 py-1.5 flex justify-between items-center text-[9px] font-pixel text-emerald-400 select-none">
                            <div className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                <span>HIYORI PiP</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <button
                                    onClick={() => setIsChatExpanded(false)}
                                    className="hover:text-white px-1 text-[11px]"
                                    title="Quay lại Chia đôi màn hình (Split View)"
                                >
                                    ◫
                                </button>
                                <button
                                    onClick={() => setIsPipModelVisible(false)}
                                    className="hover:text-red-400 px-1 text-[11px]"
                                    title="Thu nhỏ model"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Live2D Canvas - ALWAYS MOUNTED & RUNNING */}
                    <div className="w-full h-full relative">
                        <VtuberModelDisplay
                            status={status}
                            audioUrl={currentAudioUrl}
                            isDarkMode={isDarkMode}
                            toggleTheme={toggleTheme}
                            onModelClick={handleModelClick}
                        />

                        {/* Top-left HUD badge (chỉ hiện khi ở Stage lớn) */}
                        {!isChatExpanded && (
                            <div className="absolute top-3 left-4 z-20 mc-card p-2 px-3 rounded flex items-center gap-2 pointer-events-none text-[10px] font-mono select-none">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                <span className="font-pixel text-emerald-400">HIYORI</span>
                                <span className="text-slate-400 hidden sm:inline">| CUBISM ENGINE</span>
                            </div>
                        )}

                        {/* Bottom-left EXP Bar (chỉ hiện khi ở Stage lớn) */}
                        {!isChatExpanded && (
                            <div className="absolute bottom-4 left-4 z-20 mc-card p-3 rounded pointer-events-none hidden sm:block max-w-xs text-[10px] font-mono select-none">
                                <div className="flex justify-between items-center text-[9px] font-pixel text-slate-400 mb-1.5">
                                    <span className="text-emerald-400">AI CORE STATS</span>
                                    <span className="text-[#4deeea]">LVL 3.59</span>
                                </div>
                                <div className="w-40 bg-slate-950 h-2.5 rounded-xs border border-slate-700 p-0.5 overflow-hidden">
                                    <div className="exp-bar h-full w-full rounded-xs"></div>
                                </div>
                                <div className="text-[9px] text-slate-400 mt-1.5 font-mono">
                                    Voice: Piper TTS • LLM: Gemini
                                </div>
                            </div>
                        )}

                        {/* Speech Bubble Popup */}
                        {modelReaction && (
                            <div className="absolute bottom-[62%] left-1/2 -translate-x-1/2 z-50 pointer-events-none">
                                <div
                                    style={{ animation: 'bubbleIn 0.25s ease-out' }}
                                    className="mc-card p-3 px-4 rounded text-xs font-mono text-emerald-200 border-2 border-emerald-400 shadow-[0_0_16px_rgba(76,175,80,0.5)] max-w-[240px] text-center leading-snug whitespace-pre-wrap"
                                >
                                    <div className="font-pixel text-[8px] text-emerald-400 mb-1">HIYORI:</div>
                                    {modelReaction}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── DRAG RESIZE HANDLE (chỉ có trong Split View trên desktop) ── */}
                {!isChatExpanded && (
                    <div
                        onMouseDown={onChatResizeStart}
                        className="hidden lg:flex items-center justify-center w-2 flex-shrink-0 cursor-col-resize group z-10 bg-slate-900/60 hover:bg-emerald-500/80 border-x border-slate-800 transition-colors select-none"
                        title="Kéo để thay đổi chiều rộng chat"
                    >
                        <div className="w-0.5 h-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity bg-emerald-400" />
                    </div>
                )}

                {/* ── CHAT INTERFACE PANE (Standard ChatGPT / Gemini Flex container) ── */}
                <div
                    className={`flex flex-col min-h-0 border-t-2 lg:border-t-0 ${
                        !isChatExpanded ? 'lg:border-l-2 border-slate-800' : ''
                    } flex-shrink-0 transition-[width,flex] duration-300 ease-in-out bg-[#0d111a]/85 backdrop-blur-xl ${
                        isChatExpanded ? 'flex-1 w-full h-full' : 'flex-1 lg:flex-none lg:h-full'
                    }`}
                    style={!isChatExpanded && isDesktop ? { width: `${chatWidth}px` } : {}}
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

