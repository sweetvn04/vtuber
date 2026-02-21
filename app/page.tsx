"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";

// --- COMPONENTS ---
import ChatInterface from "@/components/ChatInterface";
import VtuberModelDisplay from "@/components/VtuberModelDisplay";
import UserCamera from "@/components/UserCamera";
import ChatHistorySidebar from "@/components/ChatHistorySidebar";

// --- HELPERS ---
const getApiBase = () => {
    if (typeof window !== 'undefined') {
        if (process.env.NEXT_PUBLIC_API_BASE) return process.env.NEXT_PUBLIC_API_BASE;
        return `http://${window.location.hostname}:8080`;
    }
    return "http://localhost:8080";
};

const getWsBase = () => {
    if (typeof window !== 'undefined') {
        const apiBase = getApiBase();
        if (apiBase.startsWith("https://")) return apiBase.replace("https://", "wss://");
        return apiBase.replace("http://", "ws://");
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
    const [isChatFullScreen, setIsChatFullScreen] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false); // ẩn mặc định
    const [viewportHeight, setViewportHeight] = useState<string>('100dvh');

    // --- RESIZE STATE ---
    const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT);
    const [chatWidth, setChatWidth] = useState(CHAT_DEFAULT);
    const sidebarResizing = useRef(false);
    const chatResizing = useRef(false);
    const startX = useRef(0);
    const startWidth = useRef(0);

    // Biết đang desktop để chỉ áp dụng maxWidth trên desktop
    const [isDesktop, setIsDesktop] = useState(false);
    useEffect(() => {
        const check = () => setIsDesktop(window.innerWidth >= 1024);
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);

    // --- BACKEND HEALTH CHECK (ping độc lập với session) ---
    useEffect(() => {
        const ping = async () => {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 4000);
            try {
                const res = await fetch(`${getApiBase()}/api/chat/sessions`, {
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
            const res = await fetch(url);
            if (!res.ok) throw new Error(`Status ${res.status}`);
            setSessions(await res.json());
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
            const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }) });
            if (!res.ok) throw new Error(`Status ${res.status}`);
            const data = await res.json();
            await fetchSessions();
            setSelectedSessionId(data.id);
        } catch (e: any) { window.alert(`Lỗi tạo session: ${e.message}`); }
    }, [fetchSessions]);

    const handleDeleteSession = useCallback(async (id: string) => {
        if (!window.confirm("Xóa cuộc trò chuyện này?")) return;
        try {
            const res = await fetch(`${getApiBase()}/api/chat/session/${id}`, { method: "DELETE" });
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
                const res = await fetch(`${getApiBase()}/api/chat/session/${selectedSessionId}`);
                const data = await res.json();
                setChatLog(data.history || []);
            } catch (e) { console.error("Lỗi tải lịch sử", e); }
        };
        loadHistory();

        if (ws.current) ws.current.close();
        ws.current = new WebSocket(`${getWsBase()}/ws/chat/${selectedSessionId}`);
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
            className={`relative flex w-full overflow-hidden transition-colors duration-300
                ${isDarkMode ? 'text-gray-100' : 'text-slate-800'}`}
            style={{
                height: viewportHeight,
                backgroundImage: 'url(/anime_bg.png)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
            }}
        >
            {/* Overlay tối nhẹ để text/UI dễ đọc hơn */}
            <div className={`absolute inset-0 pointer-events-none z-0
                ${isDarkMode ? 'bg-black/45' : 'bg-black/20'}`}
            />


            {/* ── MOBILE: MENU BUTTON ── */}
            <button
                className={`lg:hidden absolute top-4 left-4 z-50 p-2 rounded-full shadow-md
                    ${isDarkMode ? 'bg-gray-700 text-white' : 'bg-white text-gray-700'}`}
                onClick={() => setIsMobileMenuOpen(true)}
            >☰</button>

            {/* ── MOBILE: BACKDROP ── */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* ══════════════════════════════════════
                SIDEBAR
                Mobile  : fixed, slide-in bằng translateX
                Desktop : fixed overlay — KHÔNG chiếm flex flow
                          → kéo rộng sidebar KHÔNG đẩy model
            ══════════════════════════════════════ */}
            <div
                className={`overflow-hidden fixed inset-y-0 left-0 z-[55] backdrop-blur-xl
                    ${isDarkMode ? 'bg-gray-900/60' : 'bg-white/50'}`}
                style={{
                    width: `${sidebarWidth}px`,
                    // Mobile: ẩn/hiện bằng transform translateX
                    // Desktop: ẩn/hiện bằng maxWidth (overflow-hidden sẽ clip)
                    transform: !isDesktop
                        ? (isMobileMenuOpen ? 'translateX(0)' : 'translateX(-100%)')
                        : 'translateX(0)',
                    maxWidth: isDesktop
                        ? (isSidebarOpen ? `${sidebarWidth}px` : '0px')
                        : `${sidebarWidth}px`,
                    transition: isDesktop
                        ? 'max-width 300ms ease-in-out'
                        : 'transform 300ms ease-in-out',
                    boxShadow: isSidebarOpen ? '4px 0 20px rgba(0,0,0,0.18)' : 'none',
                    borderRight: isSidebarOpen
                        ? `1px solid ${isDarkMode ? '#374151' : '#e5e7eb'}`
                        : 'none',
                }}
            >
                {/* Inner: giữ nguyên width để content không méo khi animate */}
                <div className="h-full relative" style={{ width: `${sidebarWidth}px` }}>
                    {/* Mobile close button */}
                    <button
                        className="lg:hidden absolute top-5 left-4 z-50 text-xl font-bold opacity-60 hover:opacity-100"
                        onClick={() => setIsMobileMenuOpen(false)}
                    >✕</button>

                    <ChatHistorySidebar
                        sessions={sessions}
                        selectedSessionId={selectedSessionId}
                        onSelectChat={(chat: any) => { setSelectedSessionId(chat.id); setIsMobileMenuOpen(false); }}
                        onNewChat={() => { handleNewChat(); setIsMobileMenuOpen(false); }}
                        onDeleteSession={handleDeleteSession}
                        isDarkMode={isDarkMode}
                        onToggleDarkMode={toggleTheme}
                        isTtsEnabled={isTtsEnabled}
                        onToggleTts={() => setIsTtsEnabled(prev => !prev)}
                    />
                </div>

                {/* Sidebar resize handle — cạnh phải, chỉ desktop khi mở */}
                {isDesktop && isSidebarOpen && (
                    <div
                        onMouseDown={onSidebarResizeStart}
                        className={`absolute top-0 right-0 w-1.5 h-full cursor-col-resize group z-10
                            ${isDarkMode ? 'hover:bg-blue-500' : 'hover:bg-blue-400'} transition-colors`}
                        title="Kéo để thay đổi chiều rộng sidebar"
                    >
                        <div className={`absolute top-1/2 -translate-y-1/2 w-0.5 h-8 rounded-full
                            opacity-0 group-hover:opacity-100 transition-opacity
                            ${isDarkMode ? 'bg-white' : 'bg-gray-600'}`}
                        />
                    </div>
                )}
            </div>

            {/* ══════════════════════════════════════
                MAIN CONTENT
                Luôn full-width. Sidebar overlay ở trên, không đẩy content.
            ══════════════════════════════════════ */}
            <div className="flex-1 flex flex-col lg:flex-row relative min-w-0 overflow-hidden">

                {/* Toggle button desktop — bám cạnh phải của sidebar */}
                <button
                    onClick={() => setIsSidebarOpen(prev => !prev)}
                    className={`hidden lg:flex items-center justify-center
                        absolute top-1/2 -translate-y-1/2 z-[60]
                        h-14 w-5 rounded-r-lg shadow-lg
                        hover:w-6 active:scale-95
                        ${isDarkMode
                            ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}
                    `}
                    style={{
                        left: isDesktop && isSidebarOpen ? `${sidebarWidth}px` : '0px',
                        transition: 'left 300ms ease-in-out, width 150ms',
                    }}
                    title={isSidebarOpen ? 'Ẩn History' : 'Hiện History'}
                >
                    <span className="text-[10px] font-bold select-none">
                        {isSidebarOpen ? '◀' : '▶'}
                    </span>
                </button>

                {/* ── MODEL AREA — trong suốt để nền xuyên qua ── */}
                <div className="relative shrink-0 h-[40vh] lg:h-full lg:flex-1 lg:shrink overflow-hidden">
                    <div className="w-full h-full">
                        <VtuberModelDisplay
                            status={status}
                            audioUrl={currentAudioUrl}
                            isDarkMode={isDarkMode}
                            toggleTheme={toggleTheme}
                            onModelClick={handleModelClick}
                        />
                    </div>

                    {/* ── SPEECH BUBBLE POPUP khi click model ── */}
                    {modelReaction && (
                        <div className="absolute bottom-[62%] left-1/2 -translate-x-1/2 z-50 pointer-events-none">
                            <div
                                style={{ animation: 'bubbleIn 0.25s ease-out' }}
                                className="relative px-4 py-3 rounded-2xl text-sm font-medium text-white
                                    bg-black/60 backdrop-blur-xl border border-white/20 shadow-2xl
                                    max-w-[220px] text-center leading-snug whitespace-pre-wrap"
                            >
                                {modelReaction}
                                <span className="absolute -bottom-2 left-1/2 -translate-x-1/2
                                    border-l-8 border-r-8 border-t-8
                                    border-l-transparent border-r-transparent border-t-white/20" />
                                <span className="absolute -bottom-[7px] left-1/2 -translate-x-1/2
                                    border-l-[7px] border-r-[7px] border-t-[7px]
                                    border-l-transparent border-r-transparent border-t-black/60" />
                            </div>
                        </div>
                    )}
                </div>

                {/* Chat Resize Handle */}
                <div
                    onMouseDown={onChatResizeStart}
                    className={`hidden lg:flex items-center justify-center w-1.5 flex-shrink-0
                        cursor-col-resize group z-10
                        ${isDarkMode ? 'bg-white/10 hover:bg-blue-500/60' : 'bg-black/10 hover:bg-blue-400/60'}
                        backdrop-blur-sm transition-colors`}
                    title="Kéo để thay đổi chiều rộng chat"
                >
                    <div className={`w-0.5 h-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity
                        ${isDarkMode ? 'bg-white' : 'bg-gray-600'}`}
                    />
                </div>

                {/* ── CHAT AREA ── */}
                <div
                    className={`flex flex-col min-h-0 border-t lg:border-t-0 lg:border-l flex-shrink-0
                        transition-all duration-300 ease-in-out backdrop-blur-xl
                        ${isDarkMode
                            ? 'bg-gray-900/65 border-white/10'
                            : 'bg-white/55 border-white/30'
                        }
                        ${isChatFullScreen
                            ? 'fixed inset-0 z-[100] w-full h-full !border-0'
                            : 'flex-1 lg:flex-none lg:h-full'
                        }`}
                    style={!isChatFullScreen ? { width: `${chatWidth}px` } : {}}
                >
                    <ChatInterface
                        chatLog={chatLog}
                        onSendMessage={handleSendMessage}
                        disabled={!selectedSessionId}
                        isThinking={isThinking}
                        isSearching={isSearching}
                        isDarkMode={isDarkMode}
                        isFullScreen={isChatFullScreen}
                        onToggleFullScreen={() => setIsChatFullScreen(prev => !prev)}
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
