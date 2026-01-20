"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";

// --- COMPONENTS ---
import ChatInterface from "@/components/ChatInterface";
import VtuberModelDisplay from "@/components/VtuberModelDisplay";
import UserCamera from "@/components/UserCamera";
import ChatHistorySidebar from "@/components/ChatHistorySidebar";

const API_BASE = "http://localhost:8080";

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
        try {
            const res = await fetch(`${API_BASE}/api/chat/sessions`);
            const data = await res.json();
            setSessions(data);
        } catch (e) {
            console.error("Lỗi tải sessions:", e);
        }
    }, []);

    const handleNewChat = useCallback(async () => {
        const title = window.prompt("Tên cuộc trò chuyện mới:", `Chat ${new Date().toLocaleTimeString()}`);
        if (!title) return;
        try {
            const res = await fetch(`${API_BASE}/api/chat/session/create`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title }),
            });
            const data = await res.json();
            await fetchSessions();
            setSelectedSessionId(data.id);
        } catch (e) {
            window.alert("Không thể tạo session");
        }
    }, [fetchSessions]);

    const handleDeleteSession = useCallback(async (id: string) => {
        if (!window.confirm("Bạn có chắc chắn muốn xóa cuộc trò chuyện này?")) return;

        try {
            const res = await fetch(`${API_BASE}/api/chat/session/${id}`, {
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
                const res = await fetch(`${API_BASE}/api/chat/session/${selectedSessionId}`);
                const data = await res.json();
                setChatLog(data.history || []);
            } catch (e) {
                console.error("Lỗi tải lịch sử", e);
            }
        };
        loadHistory();

        if (ws.current) ws.current.close();
        const wsUrl = `ws://localhost:8080/ws/chat/${selectedSessionId}`;
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

    useEffect(() => { fetchSessions(); }, [fetchSessions]);

    return (
        <div className="flex w-screen h-screen p-5 gap-5 box-border bg-gradient-to-br from-[#ffecd2] via-[#fcb69f] to-[#ffeaa7] overflow-hidden animate-in fade-in duration-700">
            <canvas ref={canvasRef} className="hidden" />

            <ChatHistorySidebar
                sessions={sessions}
                selectedSessionId={selectedSessionId}
                onSelectChat={(chat: any) => setSelectedSessionId(chat.id)}
                onNewChat={handleNewChat}
                onDeleteSession={handleDeleteSession}
            />

            <div className="flex-1 flex flex-col gap-5 min-w-0 relative z-10">
                {false && (<div className="flex justify-center items-center bg-white rounded-[20px] p-6 shadow-[0_4px_20px_rgba(252,182,159,0.15),0_2px_8px_rgba(0,0,0,0.05)] border border-white/80 transition-all duration-300 hover:shadow-[0_8px_30px_rgba(252,182,159,0.2),0_4px_12px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 animate-in slide-in-from-bottom-5 duration-700 delay-100">
                    <UserCamera
                        videoRef={videoRef}
                        isOn={isWebcamOn}
                        onToggle={() => setIsWebcamOn(!isWebcamOn)}
                        scanData={scanData}
                    />
                </div>)}
                <div className="flex-grow min-h-0 bg-white rounded-[20px] shadow-[0_4_20px_rgba(252,182,159,0.15),0_2px_8px_rgba(0,0,0,0.05)] border border-white/80 overflow-hidden animate-in slide-in-from-bottom-5 duration-700 delay-200">
                    <ChatInterface
                        chatLog={chatLog}
                        onSendMessage={handleSendMessage}
                        disabled={!selectedSessionId}
                        isThinking={isThinking} // <--- TRUYỀN XUỐNG ĐÂY
                    />
                </div>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center bg-white rounded-[20px] p-6 shadow-[0_4px_20px_rgba(252,182,159,0.15),0_2px_8px_rgba(0,0,0,0.05)] border border-white/80 min-w-0 relative overflow-hidden z-10 animate-in slide-in-from-bottom-5 duration-700 delay-300">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#ffecd2] via-[#fcb69f] to-[#ffeaa7]" />
                <VtuberModelDisplay status={status} audioUrl={currentAudioUrl} />
            </div>

            {/* Decorative background blobs */}
            <div className="fixed w-[300px] h-[300px] rounded-full opacity-10 pointer-events-none z-0 bg-[radial-gradient(circle,#fcb69f_0%,transparent_70%)] top-[-100px] right-[-100px] animate-pulse" />
            <div className="fixed w-[400px] h-[400px] rounded-full opacity-10 pointer-events-none z-0 bg-[radial-gradient(circle,#ffeaa7_0%,transparent_70%)] bottom-[-150px] left-[-150px] animate-pulse" />
        </div>
    );
}
