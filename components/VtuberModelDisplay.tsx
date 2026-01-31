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

    useEffect(() => {
        (window as any).PIXI = PIXI;
        const modelPath = 'models/hiyori/hiyori_free_t08.model3.json';
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

                // Vô hiệu hóa các chuyển động Idle và các motion tự động
                if (model.internalModel.motionManager) {
                    model.internalModel.motionManager.stopAllMotions();
                    // Xoá các nhóm motion để model không tự động chạy các chuyển động Idle nữa
                    (model.internalModel.motionManager as any).groups = {};
                }

                // Sử dụng Ticker để ghi đè các tham số SAU KHI model đã tính toán chuyển động mặc định (Motion/Physics)
                pixiApp.current.ticker.add(() => {
                    if (!modelRef.current) return;
                    const core = modelRef.current.internalModel.coreModel;

                    if (isPlayingRef.current || debugSpeakingRef.current) {
                        const finalOpen = currentMouthValue.current;
                        if (core && typeof (core as any).setParameterValueById === 'function') {
                            (core as any).setParameterValueById("ParamMouthOpen", finalOpen);
                            (core as any).setParameterValueById("ParamMouthOpenY", finalOpen);
                            (core as any).setParameterValueById("ParamMouthForm", 1.0); // Cười nhẹ khi nói
                        }
                    } else {
                        // Đảm bảo đóng miệng khi không nói
                        if (core && typeof (core as any).setParameterValueById === 'function') {
                            (core as any).setParameterValueById("ParamMouthOpen", 0);
                            (core as any).setParameterValueById("ParamMouthOpenY", 0);
                        }
                    }

                    // Damping các chuyển động tự động để model tĩnh hơn (chạy liên tục hậu update)
                    if (core && typeof (core as any).setParameterValueById === 'function' && typeof (core as any).getParameterValueById === 'function') {
                        const breathVal = (core as any).getParameterValueById("ParamBreath");
                        if (typeof breathVal === 'number') (core as any).setParameterValueById("ParamBreath", breathVal * 0.6);

                        const bodyX = (core as any).getParameterValueById("ParamBodyAngleX");
                        if (typeof bodyX === 'number') (core as any).setParameterValueById("ParamBodyAngleX", bodyX * 0.5);
                    }
                });

                if (!isMounted || !pixiApp.current) return;

                pixiApp.current.stage.addChild(model as any);

                const scale = Math.min(w / model.width, h / model.height) * 2;
                model.scale.set(scale);
                model.x = w / 2;
                model.y = h / 2;
                model.anchor.set(0.5, 0.2);

                model.interactive = true;
                model.autoInteract = true;

                // Giảm độ nhạy khi quay đầu/nhìn theo chuột để model bớt "loi nhoi"
                if ((model as any).focusHandler) {
                    (model as any).focusHandler.config.factor = 0.5;
                }

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
    }, []);

    return (
        <div className="w-full h-full relative overflow-hidden bg-transparent">
            {/* Background decoration */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#667eea] to-[#764ba2] opacity-10 -z-10" />

            <div ref={containerRef} className="w-full h-full" />

            {/* Status Overlay */}
            <div className="absolute top-3 left-3 flex flex-col gap-1 pointer-events-none">
                <div className="bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-lg text-white text-[10px] flex items-center gap-2 border border-white/10">
                    <div className={`w-2 h-2 rounded-full ${status === 'Connected' ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span>{status}</span>
                </div>
                {isPlaying && (
                    <div className="bg-green-500/80 backdrop-blur-md px-3 py-1.5 rounded-lg text-white text-[10px] font-bold animate-bounce border border-green-400/30">
                        🔊 SPEAKING...
                    </div>
                )}
            </div>

            {internalStatus && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/80 backdrop-blur-lg px-8 py-4 rounded-2xl text-white text-sm font-medium animate-pulse z-50 shadow-2xl border border-white/10">
                    {internalStatus}
                </div>
            )}

            {/* Test Controls */}
            <div className="absolute top-3 right-3 flex gap-2">
                <button
                    onClick={toggleTestSpeaking}
                    className={`px-3 py-1 text-[10px] rounded-full backdrop-blur-sm border transition-all ${debugSpeaking
                        ? 'bg-red-500/50 border-red-400 text-white animate-pulse'
                        : 'bg-black/30 border-white/10 text-white/70 hover:bg-black/50 hover:text-white'
                        }`}
                >
                    {debugSpeaking ? 'Stop Test' : 'Test Speak'}
                </button>
                <button
                    onClick={() => setShowDebug(!showDebug)}
                    className="bg-black/30 hover:bg-black/50 text-white/70 hover:text-white px-3 py-1 text-[10px] rounded-full backdrop-blur-sm border border-white/10 transition-all"
                >
                    {showDebug ? 'Hide Logs' : 'Show Logs'}
                </button>
            </div>

            {showDebug && (
                <div className="absolute top-12 right-3 w-64 max-h-40 overflow-y-auto bg-black/80 backdrop-blur-xl rounded-xl p-3 text-[#0f0] font-mono text-[10px] border border-white/10 shadow-2xl">
                    {debugInfo.map((l, i) => (
                        <div key={i} className="mb-1 opacity-80 hover:opacity-100">{l}</div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default VtuberModelDisplay;
