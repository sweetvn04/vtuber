"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";

// --- COMPONENTS ---
import ChatInterface from "@/components/ChatInterface";
import VtuberModelDisplay from "@/components/VtuberModelDisplay";
import UserCamera from "@/components/UserCamera";
import ChatHistorySidebar from "@/components/ChatHistorySidebar";

// Xóa dòng này đi hoặc comment lại
// const API_BASE = "http://localhost:8080";

// --- HELPERS ---
const getApiBase = () => {
    if (typeof window !== 'undefined') {
        // Tự động lấy Hostname hiện tại (localhost hoặc IP LAN)
        return `http://${window.location.hostname}:8080`;
    }
    return "http://localhost:8080";
};

const getWsBase = () => {
    if (typeof window !== 'undefined') {
        return `ws://${window.location.hostname}:8080`;
    }
    return "ws://localhost:8080";
};

function base64ToBlob(base64: string, type: string) {
    const binStr = atob(base64);
    const len = binStr.length;
    const arr = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        arr[i] = binStr.charCodeAt(i);
    }
    return new Blob([arr], { type: type });
}

export default function Home() {
    const [sessions, setSessions] = useState<any[]>([]);
    const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
    const [chatLog, setChatLog] = useState<any[]>([]);
    const [status, setStatus] = useState("Disconnected");
    const [isWebcamOn, setIsWebcamOn] = useState(false);
    const [scanData, setScanData] = useState<any>(null);
    const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null);
    const [isThinking, setIsThinking] = useState(false);

    const ws = useRef<WebSocket | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const fetchSessions = useCallback(async () => {
        const url = `${getApiBase()}/api/chat/sessions`;
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`Status ${res.status}`);
            const data = await res.json();
            setSessions(data);
        } catch (e: any) {
            console.error("Lỗi tải sessions:", e);
            // Chỉ hiện alert nếu đang không phải localhost để đỡ phiền dev, hoặc hiện log
            // Ở đây ta add log vào UI thông qua prop (nhưng ChatHistorySidebar nằm ngoài log control)
            // Tạm thời alert 1 lần nếu cần thiết
            console.log(`Failed to fetch sessions from ${url}: ${e.message}`);
        }
    }, []);

    const handleNewChat = useCallback(async () => {
        const title = window.prompt("Tên cuộc trò chuyện mới:", `Chat ${new Date().toLocaleTimeString()}`);
        if (!title) return;
        const url = `${getApiBase()}/api/chat/session/create`;
        try {
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title }),
            });
            if (!res.ok) throw new Error(`Status ${res.status}`);
            const data = await res.json();
            await fetchSessions();
            setSelectedSessionId(data.id);
        } catch (e: any) {
            window.alert(`Lỗi tạo session (${url}): ${e.message}. Kiểm tra xem Backend có đang chạy và Firewall có mở port 8080 không.`);
        }
    }, [fetchSessions]);

    const handleDeleteSession = useCallback(async (id: string) => {
        if (!window.confirm("Bạn có chắc chắn muốn xóa cuộc trò chuyện này?")) return;

        try {
            const res = await fetch(`${getApiBase()}/api/chat/session/${id}`, {
                method: "DELETE",
            });

            if (res.ok) {
                await fetchSessions(); // Tải lại danh sách sau khi xóa
                if (selectedSessionId === id) {
                    setSelectedSessionId(null);
                    setChatLog([]);
                }
            } else {
                alert("Lỗi khi xóa session");
            }
        } catch (e) {
            console.error("Lỗi xóa session:", e);
        }
    }, [selectedSessionId, fetchSessions]);

    useEffect(() => {
        if (!selectedSessionId) return;

        const loadHistory = async () => {
            try {
                const res = await fetch(`${getApiBase()}/api/chat/session/${selectedSessionId}`);
                const data = await res.json();
                setChatLog(data.history || []);
            } catch (e) {
                console.error("Lỗi tải lịch sử", e);
            }
        };
        loadHistory();

        if (ws.current) ws.current.close();
        // Tự động dùng IP tương ứng với Frontend
        const wsUrl = `${getWsBase()}/ws/chat/${selectedSessionId}`;
        ws.current = new WebSocket(wsUrl);

        ws.current.onopen = () => setStatus("Connected");
        ws.current.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === "AI_RESPONSE_TEXT") {
                    setChatLog(prev => [...prev, { role: "assistant", content: data.payload }]);
                    setIsThinking(false); // <--- DỪNG NGHĨ KHI CÓ PHẢN HỒI
                } else if (data.type === "AUDIO") {
                    // Chuyển Base64 sang Blob URL để phát
                    const audioBlob = base64ToBlob(data.payload, 'audio/wav');
                    const audioUrl = URL.createObjectURL(audioBlob);
                    setCurrentAudioUrl(audioUrl); // Biến này sẽ được truyền vào VtuberModelDisplay
                } else if (data.type === "SCAN_UPDATE") {
                    setScanData(data.payload);
                }
            } catch (err) {
                console.error("WS Error", err);
            }
        };

        return () => ws.current?.close();
    }, [selectedSessionId]);

    const handleSendMessage = useCallback((text: string) => {
        if (!ws.current || ws.current.readyState !== WebSocket.OPEN) return;
        ws.current.send(JSON.stringify({ type: "TEXT_MESSAGE", user_id: "12345678900923", payload: text }));
        setChatLog(prev => [...prev, { role: "user", content: text }]);
        setIsThinking(true);
    }, []);

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
        const startCamera = async () => {
            if (isWebcamOn && videoRef.current) {
                try {
                    stream = await navigator.mediaDevices.getUserMedia({ video: true });
                    videoRef.current.srcObject = stream;
                } catch (e) {
                    setIsWebcamOn(false);
                }
            }
        };
        if (isWebcamOn) startCamera();
        else if (videoRef.current) videoRef.current.srcObject = null;
        return () => stream?.getTracks().forEach(t => t.stop());
    }, [isWebcamOn]);

    const [showChatOnMobile, setShowChatOnMobile] = useState(true);
    const [isDarkMode, setIsDarkMode] = useState(true); // Default ON
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false); // State cho Mobile Menu

    const toggleTheme = () => setIsDarkMode(!isDarkMode);

    useEffect(() => { fetchSessions(); }, [fetchSessions]);

    const [isChatFullScreen, setIsChatFullScreen] = useState(false);

    // --- KEYBOARD HANDLING (MOBILE) ---
    // Sử dụng visualViewport để tính lại chiều cao khi bàn phím ảo hiện lên
    const [viewportHeight, setViewportHeight] = useState<string>('100dvh');

    useEffect(() => {
        const handleResize = () => {
            if (window.visualViewport) {
                // Cập nhật chiều cao bằng phần màn hình thực tế nhìn thấy được
                // Flexbox sẽ tự động đẩy Input lên sát bàn phím
                setViewportHeight(`${window.visualViewport.height}px`);

                // Nếu đang dùng PC (không có cảm ứng), visualViewport.height == window.innerHeight
                // Logic này an toàn cho cả 2
            }
        };

        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', handleResize);
            window.visualViewport.addEventListener('scroll', handleResize);
            handleResize(); // Gọi ngay
        }

        return () => {
            if (window.visualViewport) {
                window.visualViewport.removeEventListener('resize', handleResize);
                window.visualViewport.removeEventListener('scroll', handleResize);
            }
        };
    }, []); // Chạy 1 lần duy nhất lúc mount

    return (
        <div
            className={`flex w-full overflow-hidden transition-colors duration-300 ${isDarkMode ? 'bg-gray-900 text-gray-100' : 'bg-gray-50 text-slate-800'}`}
            style={{ height: viewportHeight }} // Áp dụng cho toàn bộ App
        >

            {/* ... (Giữ nguyên phần MENU BUTTON và SIDEBAR) */}
            {/* MOBILE ONLY: MENU BUTTON (Top Left) */}
            <button
                className={`lg:hidden absolute top-4 left-4 z-50 p-2 rounded-full shadow-md ${isDarkMode ? 'bg-gray-700 text-white' : 'bg-white text-gray-700'}`}
                onClick={() => setIsMobileMenuOpen(true)}
            >
                ☰
            </button>

            {/* MOBILE ONLY: BACKDROP OVERLAY */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* 1. SIDEBAR (Responsive Wrapper) */}
            <div className={`
                fixed inset-y-0 left-0 z-50 w-72 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 lg:w-64 lg:block border-r
                ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
                ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}
            `}>
                <div className="h-full relative">
                    {/* Mobile Close Button (Left Side) */}
                    <button
                        className="lg:hidden absolute top-5 left-4 z-50 text-xl font-bold opacity-60 hover:opacity-100"
                        onClick={() => setIsMobileMenuOpen(false)}
                    >
                        ✕
                    </button>

                    <ChatHistorySidebar
                        sessions={sessions}
                        selectedSessionId={selectedSessionId}
                        onSelectChat={(chat: any) => {
                            setSelectedSessionId(chat.id);
                            setIsMobileMenuOpen(false); // Đóng menu khi chọn chat
                        }}
                        onNewChat={() => {
                            handleNewChat();
                            setIsMobileMenuOpen(false);
                        }}
                        onDeleteSession={handleDeleteSession}
                        isDarkMode={isDarkMode}
                    />
                </div>
            </div>

            {/* MAIN CONTENT WRAPPER */}
            <div className="flex-1 flex flex-col lg:flex-row relative min-w-0">

                {/* THEME TOGGLE BUTTON (Floating) */}
                {/* Mobile: Bên trái (cạnh nút Menu). Desktop: Góc phải. */}
                {/* Ẩn trên mobile khi menu đang mở để tránh đè lên sidebar */}
                <button
                    onClick={toggleTheme}
                    className={`lg:hidden absolute top-4 z-50 p-2 rounded-full shadow-md transition-all duration-300 
                        left-14
                        ${isMobileMenuOpen ? 'hidden' : ''}
                        ${isDarkMode ? 'bg-gray-700 text-yellow-400 hover:bg-gray-600' : 'bg-white text-orange-500 hover:bg-gray-100'}
                    `}
                    title="Toggle Dark Mode"
                >
                    {isDarkMode ? '🌙' : '☀️'}
                </button>

                {/* 2. MODEL AREA */}
                {/* Mobile: Chiếm 40-50% chiều cao màn hình. Desktop: Chiếm phần còn lại (flex-1) */}
                <div className={`relative shrink-0 h-[40vh] lg:h-full lg:flex-1 lg:shrink overflow-hidden transition-colors duration-300 ${isDarkMode ? 'bg-gray-900' : 'bg-gray-100'}`}>
                    {/* Vùng chứa Model */}
                    <div className="w-full h-full">
                        <VtuberModelDisplay
                            status={status}
                            audioUrl={currentAudioUrl}
                            isDarkMode={isDarkMode}
                            toggleTheme={toggleTheme}
                        />
                    </div>
                </div>

                {/* 3. CHAT AREA */}
                {/* Mobile: Chiếm phần còn lại (flex-1). Desktop: Sidebar cố định bên phải. */}
                <div className={`
                    flex flex-col min-h-0 transition-all duration-300 border-t lg:border-t-0 lg:border-l shadow-sm
                    ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}
                    ${isChatFullScreen
                        ? 'absolute inset-0 w-full h-full z-[100]'
                        : 'flex-1 lg:flex-none lg:h-full lg:w-[400px]'
                    }
                `}>
                    <ChatInterface
                        chatLog={chatLog}
                        onSendMessage={handleSendMessage}
                        disabled={!selectedSessionId}
                        isThinking={isThinking}
                        isDarkMode={isDarkMode}
                        isFullScreen={isChatFullScreen}
                        onToggleFullScreen={() => setIsChatFullScreen(!isChatFullScreen)}
                    />
                </div>

            </div>
        </div>
    );
}
