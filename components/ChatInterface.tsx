"use client";

import React, { useState, useRef, useEffect } from 'react';

interface ChatInterfaceProps {
    chatLog?: any[];
    onSendMessage?: (text: string) => void;
    disabled?: boolean;
    isThinking?: boolean;
    isSearching?: boolean;
    isDarkMode?: boolean;
    isFullScreen?: boolean;
    onToggleFullScreen?: () => void;
    backendOnline?: boolean | null;
    modelReaction?: string | null; // phản ứng khi click vào model
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({
    chatLog = [],
    onSendMessage,
    disabled,
    isThinking,
    isSearching = false,
    isDarkMode = false,
    isFullScreen = false,
    onToggleFullScreen,
    backendOnline = null,
    modelReaction = null,
}) => {
    const [input, setInput] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const isRecordingRef = useRef(false);
    const isStartingRef = useRef(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const messageEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatLog, isThinking, isSearching]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || !onSendMessage) return;
        onSendMessage(input.trim());
        setInput('');
    };

    const toggleRecording = async () => {
        if (isStartingRef.current) return;
        if (isRecordingRef.current) {
            mediaRecorderRef.current?.stop();
            isRecordingRef.current = false;
            setIsRecording(false);
            return;
        }
        isStartingRef.current = true;
        try {
            // getUserMedia chỉ hoạt động trên localhost hoặc HTTPS
            if (!navigator.mediaDevices?.getUserMedia) {
                alert('🎤 Mic chỉ hoạt động trên localhost hoặc kết nối HTTPS.\n\nTruy cập qua http://localhost:3000 hoặc dùng HTTPS để dùng chức năng này.');
                isStartingRef.current = false;
                return;
            }
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            // Chọn format tốt nhất trình duyệt hỗ trợ
            const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                ? 'audio/webm;codecs=opus'
                : MediaRecorder.isTypeSupported('audio/webm')
                    ? 'audio/webm'
                    : MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
                        ? 'audio/ogg;codecs=opus'
                        : '';

            const mediaRecorder = mimeType
                ? new MediaRecorder(stream, { mimeType })
                : new MediaRecorder(stream);

            console.log('[Mic] Using mimeType:', mediaRecorder.mimeType);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            mediaRecorder.onstop = async () => {
                stream.getTracks().forEach(t => t.stop());
                const totalSize = audioChunksRef.current.reduce((s, b) => s + b.size, 0);
                console.log('[Mic] Recorded chunks:', audioChunksRef.current.length, 'Total bytes:', totalSize);

                if (totalSize === 0) {
                    console.warn('[Mic] No audio data captured!');
                    return;
                }

                const ext = mediaRecorder.mimeType.includes('ogg') ? 'ogg' : 'webm';
                const blob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType });
                const formData = new FormData();
                formData.append('audio', blob, `recording.${ext}`);

                try {
                    const apiBase = process.env.NEXT_PUBLIC_API_BASE
                        || (typeof window !== 'undefined' ? `http://${window.location.hostname}:8080` : 'http://localhost:8080');
                    console.log('[Mic] Sending to:', `${apiBase}/api/transcribe`);
                    const res = await fetch(`${apiBase}/api/transcribe`, { method: 'POST', body: formData });
                    console.log('[Mic] Transcribe status:', res.status);
                    if (res.ok) {
                        const data = await res.json();
                        console.log('[Mic] Transcribed text:', data.text);
                        if (data.text?.trim()) {
                            setInput(data.text.trim());
                        } else {
                            console.warn('[Mic] Empty transcription result');
                        }
                    } else {
                        const errText = await res.text();
                        console.error('[Mic] Transcribe error response:', res.status, errText);
                    }
                } catch (err) {
                    console.error('[Mic] Fetch error:', err);
                }
            };

            // timeslice 100ms → ondataavailable được gọi liên tục, không mất data
            mediaRecorder.start(100);
            isRecordingRef.current = true;
            setIsRecording(true);
        } catch (err) {
            console.error('[Mic] Start error:', err);
        } finally {
            isStartingRef.current = false;
        }
    };


    // Hold M to record
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'KeyM' && !e.repeat && !isRecordingRef.current) toggleRecording();
        };
        const onKeyUp = (e: KeyboardEvent) => {
            if (e.code === 'KeyM' && isRecordingRef.current) toggleRecording();
        };
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
        };
    }, []);

    // ── STYLE VARIABLES ──
    const subText = 'text-gray-300';
    const assistantBg = 'bg-white/10 border-white/10 text-gray-100 backdrop-blur-sm';
    const userBg = 'bg-purple-600/90 text-white backdrop-blur-sm';
    const inputBg = 'bg-white/10 border-white/20 text-white placeholder-white/40 backdrop-blur-md';

    return (
        <div className="flex flex-col h-full text-gray-100">
            {/* ── HEADER ── */}
            <div className="px-4 py-3 border-b flex justify-between items-center backdrop-blur-xl border-white/10 bg-black/30">
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full animate-pulse ${backendOnline === false ? 'bg-red-500' : 'bg-green-500'}`} />
                    <h2 className="font-bold text-xs tracking-wider uppercase opacity-70">Live Chat</h2>
                </div>

                {onToggleFullScreen && (
                    <button
                        onClick={onToggleFullScreen}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold
                            bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white
                            transition-all duration-200 active:scale-95"
                        title={isFullScreen ? 'Thu nhỏ lại' : 'Mở toàn màn hình'}
                    >
                        {isFullScreen
                            ? <><span className="text-sm">⊠</span><span>Thu nhỏ</span></>
                            : <><span className="text-sm">⊞</span><span>Mở rộng</span></>
                        }
                    </button>
                )}
            </div>

            {/* ── MESSAGES ── */}
            <div className="grow overflow-y-auto p-4 space-y-4 bg-transparent">

                {/* Welcome message */}
                <div className="flex flex-col gap-1 max-w-[85%] w-fit mr-auto">
                    <span className={`text-[10px] font-bold ml-2 uppercase opacity-50 ${subText}`}>Hiyori ✨</span>
                    <div className={`p-4 rounded-2xl rounded-tl-none shadow-sm border text-sm leading-relaxed ${assistantBg}`}>
                        <p className="font-semibold mb-1">Yahhoo~! こんにちは! (◕‿◕✿)</p>
                        <p className="opacity-90 mb-2">
                            Mình là <span className="font-bold text-purple-300">Hiyori</span> — VTuber đồng hành của bạn!
                            Hỏi mình bất cứ điều gì nhé, mình luôn ở đây~ 💜
                        </p>
                        <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-white/10">
                            {['💬 Trò chuyện', '🌐 Tìm kiếm web', '🎵 Nghe giọng mình', '🎮 Hỏi về game'].map(tag => (
                                <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/25 border border-purple-400/30 opacity-80">{tag}</span>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ── HIYORI: CHECKING (backendOnline = null) ── */}
                {backendOnline === null && (
                    <div className="flex flex-col gap-1 max-w-[85%] w-fit mr-auto">
                        <span className={`text-[10px] font-bold ml-2 uppercase opacity-50 ${subText}`}>Hiyori 🔄</span>
                        <div className={`flex items-center gap-2 p-3 rounded-2xl rounded-tl-none border text-xs ${assistantBg}`}>
                            <span className="animate-spin inline-block text-sm">⟳</span>
                            <span className="opacity-80">Đang kiểm tra kết nối với server...</span>
                        </div>
                    </div>
                )}

                {/* ── HIYORI: OFFLINE WARNING (backendOnline = false) ── */}
                {backendOnline === false && (
                    <div className="flex flex-col gap-1 max-w-[90%] w-fit mr-auto">
                        <span className={`text-[10px] font-bold ml-2 uppercase opacity-50 ${subText}`}>Hiyori ⚠️</span>
                        <div className="p-4 rounded-2xl rounded-tl-none shadow-sm border text-sm leading-relaxed bg-orange-950/60 border-orange-500/30 backdrop-blur-sm">
                            <p className="font-bold text-orange-200 mb-2">
                                Ara ara... mình đang không liên lạc được với server! (´◕ᴥ◕`)
                            </p>
                            <p className="text-orange-100/80 text-xs leading-relaxed mb-3">
                                Server backend của mình được chạy trực tiếp trên <strong>laptop cá nhân</strong> qua
                                <strong> Cloudflare Tunnel</strong>. Có thể chủ nhân đang tắt máy,
                                mất điện, hoặc mất internet rồi~ 😢
                            </p>
                            <div className="flex flex-wrap gap-2 text-[11px] text-orange-200/70">
                                <span>💭 Chat với mình: không khả dụng</span>
                                <span>🎤 Giọng nói (TTS): không khả dụng</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── CHAT LOG ── */}
                {chatLog.map((msg, index) => (
                    <div key={index} className={`flex flex-col gap-1 max-w-[85%] w-fit ${msg.role === 'assistant' ? 'mr-auto items-start' : 'ml-auto items-end'}`}>
                        <span className={`text-[10px] font-bold px-2 opacity-50 uppercase ${subText}`}>
                            {msg.role === 'assistant' ? 'Hiyori' : 'You'}
                        </span>
                        <div className={`p-3 rounded-2xl shadow-sm text-sm leading-relaxed border ${msg.role === 'assistant'
                            ? `${assistantBg} rounded-tl-none`
                            : `${userBg} rounded-tr-none border-transparent`
                            }`}>
                            <p className="break-words m-0">{msg.content}</p>
                        </div>
                    </div>
                ))}


                {/* ── SEARCHING INDICATOR ── */}
                {isSearching && (
                    <div className={`flex gap-2 items-center p-3 rounded-2xl rounded-tl-none border max-w-[85%] w-fit mr-auto text-xs ${assistantBg}`}>
                        <span className="animate-spin text-sm">🔍</span>
                        <span className={`${subText} opacity-80`}>Searching the web...</span>
                    </div>
                )}

                {/* ── THINKING INDICATOR ── */}
                {isThinking && !isSearching && (
                    <div className={`flex gap-2 p-3 rounded-full animate-pulse border max-w-[80px] w-fit mr-auto justify-center ${assistantBg}`}>
                        <div className="w-1.5 h-1.5 rounded-full bg-current opacity-40 animate-bounce" />
                        <div className="w-1.5 h-1.5 rounded-full bg-current opacity-60 animate-bounce delay-150" />
                        <div className="w-1.5 h-1.5 rounded-full bg-current opacity-80 animate-bounce delay-300" />
                    </div>
                )}

                <div ref={messageEndRef} />
            </div>

            {/* ── INPUT ── */}
            <div className="p-4 border-t backdrop-blur-xl border-white/10 bg-black/30">
                <form className="relative flex items-center gap-2" onSubmit={handleSubmit}>
                    <div className="relative grow">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder={disabled ? 'Chọn chat để bắt đầu...' : (isRecording ? 'Listening...' : 'Nói chuyện với mình đi...')}
                            disabled={disabled}
                            className={`w-full border-2 p-3 pl-4 pr-10 rounded-full text-sm outline-none transition-all focus:border-purple-400 ${inputBg}`}
                        />
                        {isRecording && (
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex gap-1">
                                <div className="w-1 h-3 bg-red-500 animate-[voice-bar-1_0.6s_ease-in-out_infinite]" />
                                <div className="w-1 h-5 bg-red-500 animate-[voice-bar-2_0.6s_ease-in-out_infinite_0.1s]" />
                            </div>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={toggleRecording}
                        disabled={disabled}
                        className={`w-11 h-11 flex items-center justify-center rounded-full transition-all shadow-sm active:scale-95 backdrop-blur-md
                            ${isRecording
                                ? 'bg-red-500/80 text-white animate-pulse'
                                : 'bg-white/20 hover:bg-white/30 text-white border border-white/20'
                            }`}
                    >
                        {isRecording ? '⏹' : '🎤'}
                    </button>

                    <button
                        type="submit"
                        disabled={disabled || !input.trim()}
                        className="h-11 px-5 rounded-full bg-purple-600 text-white font-bold text-sm shadow-sm hover:bg-purple-700 active:translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        SEND
                    </button>
                </form>
                <p className={`text-[9px] text-center mt-2 opacity-40 font-bold uppercase tracking-widest ${subText}`}>
                    Hold [M] to talk • Enter to send
                </p>
            </div>
        </div>
    );
};

export default ChatInterface;
