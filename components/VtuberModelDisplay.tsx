"use client";

import React, { useEffect, useRef, useState } from "react";
import * as PIXI from "pixi.js";

interface VtuberModelDisplayProps {
    status: string;
    audioUrl?: string | null;
}

const VtuberModelDisplay: React.FC<VtuberModelDisplayProps> = ({ status, audioUrl }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const pixiApp = useRef<PIXI.Application | null>(null);
    const modelRef = useRef<any>(null);

    const [internalStatus, setInternalStatus] = useState("Đang khởi tạo...");
    const [debugInfo, setDebugInfo] = useState<string[]>([]);
    const [showDebug, setShowDebug] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [debugSpeaking, setDebugSpeaking] = useState(false);

    const debugSpeakingRef = useRef(false);
    const testMouthIntervalRef = useRef<number | null>(null);

    const toggleTestSpeaking = () => {
        const newState = !debugSpeakingRef.current;
        debugSpeakingRef.current = newState;
        setDebugSpeaking(newState);

        if (newState) {
            addLog("🔴 Bắt đầu Test Speak");
            currentMouthValue.current = 0.8; // Khởi tạo mở to
            testMouthIntervalRef.current = window.setInterval(() => {
                // Đổi trạng thái giữa 0 và 0.8 mỗi 0.5s cho rõ ràng
                currentMouthValue.current = (currentMouthValue.current === 0) ? 0.8 : 0;
            }, 500);
        } else {
            addLog("⚪ Dừng Test Speak");
            if (testMouthIntervalRef.current) {
                window.clearInterval(testMouthIntervalRef.current);
                testMouthIntervalRef.current = null;
            }
            currentMouthValue.current = 0;
        }
    };

    const audioObjRef = useRef<HTMLAudioElement | null>(null);
    const mouthIntervalRef = useRef<number | null>(null);

    const currentMouthValue = useRef(0); // Lưu giá trị mở miệng cho vòng lặp Pixi
    const isPlayingRef = useRef(false);   // Ref để tránh lỗi stale closure trong sự kiện Pixi

    // LipSync Realistic Refs
    const currentVowelRef = useRef("ParamA");
    const lastVowelChangeRef = useRef(0);

    // Web Audio API refs for LipSync
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);

    const addLog = (message: string) => {
        setDebugInfo(prev => [...prev.slice(-10), `${new Date().toLocaleTimeString()}: ${message}`]);
    };

    const setMouthOpen = (value: number) => {
        if (!modelRef.current) return;
        try {
            const core = modelRef.current.internalModel.coreModel;
            if (core.setParameterValueById) {
                core.setParameterValueById("ParamMouthOpen", value);
                core.setParameterValueById("ParamMouthOpenY", value);
            }
        } catch (e) {
            // console.error(e);
        }
    };

    useEffect(() => {
        if (!audioUrl) return;

        // Cleanup audio cũ
        if (audioObjRef.current) {
            audioObjRef.current.pause();
            audioObjRef.current.src = "";
        }
        if (mouthIntervalRef.current) {
            window.clearInterval(mouthIntervalRef.current);
            mouthIntervalRef.current = null;
        }

        const audio = new Audio(audioUrl);
        audio.crossOrigin = "anonymous";
        audioObjRef.current = audio;

        audio.onplay = () => {
            setIsPlaying(true);
            isPlayingRef.current = true;

            try {
                // Khởi tạo AudioContext và Analyser nếu chưa có
                if (!audioContextRef.current) {
                    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
                    analyserRef.current = audioContextRef.current.createAnalyser();
                    analyserRef.current.fftSize = 256;
                }

                // Kết nối nguồn audio element vào analyser
                if (analyserRef.current) {
                    const source = audioContextRef.current.createMediaElementSource(audio);
                    source.connect(analyserRef.current);
                    analyserRef.current.connect(audioContextRef.current.destination);
                }

                if (audioContextRef.current.state === 'suspended') {
                    audioContextRef.current.resume();
                }

                const dataArray = new Uint8Array(analyserRef.current?.frequencyBinCount || 0);

                const updateLipSync = () => {
                    const analyser = analyserRef.current;
                    if (!isPlayingRef.current || !analyser) return;

                    analyser.getByteFrequencyData(dataArray);

                    // Tính độ lớn âm thanh (trung bình các tần số)
                    let sum = 0;
                    for (let i = 0; i < dataArray.length; i++) {
                        sum += dataArray[i];
                    }
                    const average = sum / dataArray.length;

                    // Map volume sang độ mở miệng (0.0 - 1.0)
                    // Scale để nhạy hơn với giọng nói (thường average tầm 30-80)
                    let val = (average / 50) * 1.5;
                    if (val > 1.0) val = 1.0;
                    if (val < 0.1) val = 0; // Loại bỏ nhiễu nhẹ

                    currentMouthValue.current = val;

                    if (isPlayingRef.current) {
                        requestAnimationFrame(updateLipSync);
                    }
                };

                updateLipSync();
            } catch (err) {
                addLog(`Lỗi LipSync: ${err}`);
                // Fallback: nhấp nháy miệng đơn giản nếu Web Audio bị lỗi
                mouthIntervalRef.current = window.setInterval(() => {
                    currentMouthValue.current = (currentMouthValue.current === 0) ? 0.6 : 0;
                }, 200);
            }
        };

        const cleanup = () => {
            setIsPlaying(false);
            isPlayingRef.current = false;
            if (mouthIntervalRef.current) {
                window.clearInterval(mouthIntervalRef.current);
                mouthIntervalRef.current = null;
            }
            currentMouthValue.current = 0;
        };

        audio.onended = cleanup;
        audio.onpause = cleanup;
        audio.play().catch(e => addLog(`Lỗi Play: ${e.message}`));

        return () => {
            audio.pause();
            audio.src = "";
            cleanup();
        };
    }, [audioUrl]);

    // Danh sách các model có sẵn
    const MODELS = [
        { name: 'Mao Pro', path: 'models/mao/mao_pro_en/runtime/mao_pro.model3.json' },
        { name: 'Hiyori', path: 'models/hiyori/hiyori_free_t08.model3.json' },
    ];

    const [modelIndex, setModelIndex] = useState(0);
    const [isIdleEnabled, setIsIdleEnabled] = useState(false); // Mặc định tắt Idle cho đỡ loi nhoi

    const toggleModel = () => setModelIndex((prev) => (prev + 1) % MODELS.length);
    const toggleIdle = () => setIsIdleEnabled(!isIdleEnabled);

    // Effect khởi tạo Pixi khi modelIndex thay đổi
    useEffect(() => {
        (window as any).PIXI = PIXI;
        const modelPath = MODELS[modelIndex].path;
        let isMounted = true;

        async function initializePixi() {
            try {
                if (!containerRef.current) return;

                const { Live2DModel } = await import('pixi-live2d-display');

                const w = containerRef.current.clientWidth;
                const h = containerRef.current.clientHeight;

                if (pixiApp.current) pixiApp.current.destroy(true);

                pixiApp.current = new PIXI.Application({
                    width: w,
                    height: h,
                    transparent: true,
                    antialias: true,
                    resolution: window.devicePixelRatio || 1,
                    autoDensity: true,
                });

                containerRef.current.appendChild(pixiApp.current.view as HTMLCanvasElement);

                setInternalStatus('Đang tải model Live2D...');
                const model = await Live2DModel.from(modelPath);

                modelRef.current = model;

                // --- DEBUG PARAMETERS ---
                // In ra danh sách tham số để tìm đúng ID cho miệng
                if (model.internalModel && model.internalModel.coreModel) {
                    const core = model.internalModel.coreModel as any;
                    // Lấy danh sách ID (tùy version Live2D mà cách lấy khác nhau)
                    // Cubism 4 thường dùng getParameterIds() hoặc truy cập trực tiếp _parameterIds
                    let paramIds: string[] = [];

                    if (core._parameterIds) {
                        paramIds = core._parameterIds;
                    } else if (core.getParameterIds) {
                        paramIds = core.getParameterIds();
                    }

                    console.group("🔍 Model Parameters Inspection");
                    const mouthParams = paramIds.filter(id => id.toLowerCase().includes('mouth'));
                    console.log("All Params:", paramIds);
                    console.log("👄 Mouth Params Found:", mouthParams);
                    console.groupEnd();

                    if (mouthParams.length > 0) {
                        addLog(`Tìm thấy Param miệng: ${mouthParams.join(', ')}`);
                    } else {
                        addLog("⚠️ Không tìm thấy Param có chữ 'Mouth'");
                    }
                }

                // --- 1. SET ANCHOR TO BOTTOM CENTER ---
                // Đặt gốc tọa độ ở CHÂN model để dễ căn chỉnh đứng trên sàn
                model.anchor.set(0.5, 1.0);

                // --- 2. ADD TO STAGE ---
                pixiApp.current.stage.addChild(model as any);

                // --- 3. RESPONSIVE SCALING & POSITIONING (FIXED v3) ---
                const resizeModel = () => {
                    if (!modelRef.current || !pixiApp.current || !containerRef.current) return;

                    // Lấy kích thước thực từ thẻ DIV cha (ổn định hơn screen của Pixi)
                    const parentW = containerRef.current.clientWidth;
                    const parentH = containerRef.current.clientHeight;

                    // Cập nhật lại kích thước renderer nếu cần (để tránh bị vỡ hình)
                    pixiApp.current.renderer.resize(parentW, parentH);

                    const originalHeight = model.internalModel.originalHeight;
                    const originalWidth = model.internalModel.originalWidth;

                    // Tính toán Scale ZOOM CẬN CẢNH (Close-up Shot)
                    // Yêu cầu: Hiển thị khoảng 60% thân trên.
                    // => Model Height sẽ lớn hơn Parent Height rất nhiều.
                    // => Tỉ lệ Zoom ~ 1.7 đến 1.8 lần chiều cao màn hình.
                    let targetScale = (parentH / originalHeight) * 1.7;

                    // Logic Mobile: Nếu màn hình hẹp, có thể cần zoom nhỏ lại xíu để không mất 2 bên vai quá nhiều
                    // Nhưng vẫn ưu tiên cận cảnh mặt
                    if (parentW < parentH) {
                        targetScale = (parentH / originalHeight) * 1.4; // Mobile zoom vừa phải hơn chút
                    }

                    model.scale.set(targetScale);

                    // Đặt vị trí:
                    // Mục tiêu: Đỉnh đầu nằm sát mép trên màn hình (hoặc cách 1 chút top margin).
                    // Vì Anchor = (0.5, 1.0) tức là Gốc ở Chân.
                    // Vị trí đỉnh đầu (Top) = position.y - model.height (đã scale).
                    // Muốn Top = 0 + margin (ví dụ 5% parentH).
                    // => position.y = model.height + (parentH * 0.05).

                    // Lấy chiều cao thực tế sau khi scale
                    const currentHeight = originalHeight * targetScale;

                    // Đặt chân model tít xuống dưới để đầu trồi lên trên
                    model.position.set(parentW * 0.5, currentHeight + (parentH * 0.05));
                };

                // Gọi resize ngay lập tức và sau 100ms để đảm bảo layout ổn định
                resizeModel();
                setTimeout(resizeModel, 100);
                setTimeout(resizeModel, 500); // Check lại lần nữa cho chắc

                // Lắng nghe sự kiện resize cửa sổ
                window.addEventListener('resize', resizeModel);

                // --- IDLE ANIMATION CONTROL ---
                if (model.internalModel.motionManager) {
                    if (!isIdleEnabled) {
                        // Tắt hết motion nếu không bật Idle
                        model.internalModel.motionManager.stopAllMotions();
                        (model.internalModel.motionManager as any).groups = {};
                        addLog("🚫 Idle Animations: DISABLED");
                    } else {
                        // Nếu bật Idle, PixiLive2DDisplay sẽ tự động load và play 'idle' group mặc định
                        addLog("✅ Idle Animations: ENABLED");
                    }
                }

                // Sử dụng Ticker để cập nhật LipSync
                pixiApp.current.ticker.add(() => {
                    if (!modelRef.current) return;
                    const core = modelRef.current.internalModel.coreModel;

                    // Danh sách đầy đủ các tham số miệng
                    const ALL_MOUTH_PARAMS = ["ParamMouthOpen", "ParamMouthOpenY", "MouthOpen", "ParamA", "ParamI", "ParamU", "ParamE", "ParamO"];

                    if (isPlayingRef.current || debugSpeakingRef.current) {
                        const finalOpen = currentMouthValue.current;

                        if (core && typeof (core as any).setParameterValueById === 'function') {
                            // --- THUẬT TOÁN LIP-SYNC THỰC TẾ (VOWEL MIXING) ---
                            (core as any).setParameterValueById("ParamMouthOpen", finalOpen);
                            (core as any).setParameterValueById("ParamMouthOpenY", finalOpen);
                            (core as any).setParameterValueById("MouthOpen", finalOpen);

                            if (finalOpen > 0.1) {
                                const now = Date.now();
                                if (now - lastVowelChangeRef.current > 120) {
                                    const rand = Math.random();
                                    if (rand < 0.4) currentVowelRef.current = "ParamA";
                                    else if (rand < 0.7) currentVowelRef.current = "ParamO";
                                    else if (rand < 0.85) currentVowelRef.current = "ParamE";
                                    else currentVowelRef.current = Math.random() > 0.5 ? "ParamI" : "ParamU";
                                    lastVowelChangeRef.current = now;
                                }
                            }

                            const activeVowel = currentVowelRef.current;
                            const vowels = ["ParamA", "ParamI", "ParamU", "ParamE", "ParamO"];

                            vowels.forEach(v => {
                                (core as any).setParameterValueById(v, v === activeVowel ? finalOpen : 0);
                            });

                            (core as any).setParameterValueById("ParamMouthForm", 1.0);
                            (core as any).setParameterValueById("MouthForm", 1.0);
                        }
                    } else {
                        if (core && typeof (core as any).setParameterValueById === 'function') {
                            ALL_MOUTH_PARAMS.forEach(id => {
                                (core as any).setParameterValueById(id, 0);
                            });
                        }
                    }

                    if (core && typeof (core as any).setParameterValueById === 'function' && typeof (core as any).getParameterValueById === 'function') {
                        const breathVal = (core as any).getParameterValueById("ParamBreath");
                        if (typeof breathVal === 'number') (core as any).setParameterValueById("ParamBreath", breathVal * 0.6);
                    }
                });

                if (!isMounted || !pixiApp.current) return;

                setInternalStatus('');
                addLog('✓ Model Ready');

            } catch (err: any) {
                setInternalStatus(`Lỗi: ${err.message}`);
                addLog(`❌ Lỗi: ${err.message}`);
            }
        }

        initializePixi();

        return () => {
            isMounted = false;
            if (testMouthIntervalRef.current) window.clearInterval(testMouthIntervalRef.current);
            if (pixiApp.current) {
                pixiApp.current.destroy(true);
                pixiApp.current = null;
            }
        };
    }, [modelIndex]); // Bỏ isIdleEnabled khỏi dependency để tránh reload model

    // --- EFFECT: QUẢN LÝ IDLE ANIMATION & INTERACTION RIÊNG BIỆT ---
    useEffect(() => {
        const model = modelRef.current;
        if (!model || !model.internalModel || !model.internalModel.motionManager) return;

        const motionManager = model.internalModel.motionManager;

        if (isPlaying) {
            // TRƯỜNG HỢP 1: ĐANG NÓI
            // Ưu tiên cao nhất: Tắt ngay Idle để tập trung LipSync
            motionManager.stopAllMotions();
            (motionManager as any).idleMotionGroup = undefined; // Vô hiệu hóa auto-idle

            // Tắt tương tác chuột khi đang nói để tránh xung đột cử chỉ
            model.interactive = false;
            model.autoInteract = false;

        } else {
            // TRƯỜNG HỢP 2: KHÔNG NÓI (RẢNH)
            if (isIdleEnabled) {
                // Nếu User bật Idle: Kích hoạt lại
                (motionManager as any).idleMotionGroup = 'idle';
                model.interactive = true;
                model.autoInteract = true;

                // Kích hoạt ngay 1 idle motion nếu đang đứng yên
                if (motionManager.isFinished()) {
                    motionManager.startRandomMotion('idle', 'low');
                }
            } else {
                // Nếu User tắt Idle: Freeze hoàn toàn
                motionManager.stopAllMotions();
                (motionManager as any).idleMotionGroup = undefined;
                model.interactive = false;
                model.autoInteract = false;
            }
        }
    }, [isPlaying, isIdleEnabled, internalStatus]); // Chạy lại khi trạng thái thay đổi hoặc model load xong

    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    return (
        <div className="w-full h-full relative overflow-hidden bg-transparent">
            {/* Background decoration */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#667eea] to-[#764ba2] opacity-10 -z-10" />

            <div ref={containerRef} className="w-full h-full" />

            {/* Status Overlay (SPEAKING Indicator ONLY) */}
            <div className="absolute top-3 left-3 pointer-events-none z-20">
                {isPlaying && (
                    <div className="bg-green-500/80 backdrop-blur-md px-3 py-1.5 rounded-lg text-white text-[10px] font-bold animate-bounce border border-green-400/30 shadow-lg">
                        🔊 SPEAKING...
                    </div>
                )}
            </div>

            {internalStatus && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/80 backdrop-blur-lg px-8 py-4 rounded-2xl text-white text-sm font-medium animate-pulse z-50 shadow-2xl border border-white/10">
                    {internalStatus}
                </div>
            )}

            {/* SETTINGS MENU (Top Right) */}
            <div className="absolute top-3 right-3 z-30 flex flex-col items-end gap-2">
                {/* Toggle Button */}
                <button
                    onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                    className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-md border border-white/20 text-white flex items-center justify-center hover:bg-black/60 transition-all shadow-sm"
                >
                    {isSettingsOpen ? '✕' : '⚙️'}
                </button>

                {/* Dropdown Menu */}
                {isSettingsOpen && (
                    <div className="flex flex-col gap-2 bg-black/80 backdrop-blur-xl p-2 rounded-xl border border-white/10 shadow-xl min-w-[150px] animate-in fade-in slide-in-from-top-2 duration-200">

                        {/* Status Item (Moved here) */}
                        <div className="bg-white/5 rounded-lg px-3 py-2 flex items-center gap-2 mb-1 border border-white/5">
                            <div className={`w-2 h-2 rounded-full shadow-lg ${status === 'Connected' ? 'bg-green-400 shadow-green-400/50' : 'bg-red-400'}`} />
                            <span className="text-[10px] text-white/90 font-medium">{status}</span>
                        </div>

                        <button
                            onClick={toggleModel}
                            className="bg-white/10 hover:bg-white/20 text-white text-[10px] px-3 py-2 rounded-lg text-left flex items-center gap-2 transition-all"
                        >
                            <span>🔄</span>
                            <span className="truncate flex-1">{MODELS[modelIndex].name}</span>
                        </button>

                        <button
                            onClick={toggleIdle}
                            className={`text-[10px] px-3 py-2 rounded-lg text-left flex items-center gap-2 transition-all ${isIdleEnabled
                                ? 'bg-green-500/30 hover:bg-green-500/40 text-green-100 border border-green-500/30'
                                : 'bg-white/10 hover:bg-white/20 text-white'
                                }`}
                        >
                            <span>{isIdleEnabled ? '🏃' : '🧍'}</span>
                            <span className="flex-1">Idle Animation</span>
                            <span className="opacity-60 text-[9px]">{isIdleEnabled ? 'ON' : 'OFF'}</span>
                        </button>

                        <button
                            onClick={toggleTestSpeaking}
                            className={`text-[10px] px-3 py-2 rounded-lg text-left flex items-center gap-2 transition-all ${debugSpeaking
                                ? 'bg-red-500/30 hover:bg-red-500/40 text-red-100 border border-red-500/30 animate-pulse'
                                : 'bg-white/10 hover:bg-white/20 text-white'
                                }`}
                        >
                            <span>🎤</span>
                            <span className="flex-1">Test Mic</span>
                        </button>

                        <button
                            onClick={() => setShowDebug(!showDebug)}
                            className="bg-white/10 hover:bg-white/20 text-white text-[10px] px-3 py-2 rounded-lg text-left flex items-center gap-2 transition-all"
                        >
                            <span>🐞</span>
                            <span className="flex-1">{showDebug ? 'Hide Logs' : 'Show Logs'}</span>
                        </button>
                    </div>
                )}
            </div>

            {/* DEBUG LOG PANEL (Overlay) */}
            {showDebug && (
                <div className="absolute top-14 left-3 right-16 max-h-[150px] overflow-y-auto bg-black/80 backdrop-blur-xl rounded-xl p-3 text-[#0f0] font-mono text-[9px] border border-white/10 shadow-2xl z-20 pointer-events-auto">
                    {debugInfo.length === 0 && <div className="opacity-50 italic">No logs yet...</div>}
                    {debugInfo.map((l, i) => (
                        <div key={i} className="mb-0.5 break-words opacity-90 border-b border-white/5 pb-0.5 last:border-0">{l}</div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default VtuberModelDisplay;
