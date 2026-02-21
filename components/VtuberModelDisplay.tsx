"use client";

import React, { useEffect, useRef, useState } from "react";
import * as PIXI from "pixi.js";

interface VtuberModelDisplayProps {
    status: string;
    audioUrl?: string | null;
    isDarkMode?: boolean;
    toggleTheme?: () => void;
}

const VtuberModelDisplay: React.FC<VtuberModelDisplayProps> = ({ status, audioUrl, isDarkMode, toggleTheme }) => {
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
            currentMouthValue.current = 0.8;
            testMouthIntervalRef.current = window.setInterval(() => {
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

    const currentMouthValue = useRef(0);
    const isPlayingRef = useRef(false);

    const currentVowelRef = useRef("ParamA");
    const lastVowelChangeRef = useRef(0);

    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);

    const addLog = (message: string) => {
        setDebugInfo(prev => [...prev.slice(-10), `${new Date().toLocaleTimeString()}: ${message}`]);
    };

    useEffect(() => {
        if (!audioUrl) return;

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
                if (!audioContextRef.current) {
                    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
                    analyserRef.current = audioContextRef.current.createAnalyser();
                    analyserRef.current.fftSize = 256;
                }

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

                    let sum = 0;
                    for (let i = 0; i < dataArray.length; i++) {
                        sum += dataArray[i];
                    }
                    const average = sum / dataArray.length;

                    let val = (average / 50) * 1.5;
                    if (val > 1.0) val = 1.0;
                    if (val < 0.1) val = 0;

                    currentMouthValue.current = val;

                    if (isPlayingRef.current) {
                        requestAnimationFrame(updateLipSync);
                    }
                };

                updateLipSync();
            } catch (err) {
                addLog(`Lỗi LipSync: ${err}`);
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

    const MODELS = [
        { name: 'Mao Pro', path: 'models/mao/mao_pro_en/runtime/mao_pro.model3.json' },
        { name: 'Hiyori', path: 'models/hiyori/hiyori_free_t08.model3.json' },
    ];

    const [modelIndex, setModelIndex] = useState(0);
    const [isIdleEnabled, setIsIdleEnabled] = useState(true);

    const toggleModel = () => setModelIndex((prev) => (prev + 1) % MODELS.length);
    const toggleIdle = () => setIsIdleEnabled(!isIdleEnabled);

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

                // THÊM DÒNG NÀY ĐỂ FIX LỖI BẢO MẬT CỦA VERCEL
                (PIXI.settings as any).CROSS_ORIGIN = 'anonymous';
                const model = await Live2DModel.from(modelPath, {
                    autoInteract: true,
                    crossOrigin: 'anonymous' // Ép kiểu anonymous cho toàn bộ tài nguyên của model này
                });

                modelRef.current = model;

                // --- ISOLATED LIP SYNC LOGIC ---
                const applyLipSync = (core: any) => {
                    const finalOpen = currentMouthValue.current;
                    if (!core || typeof (core as any).setParameterValueById !== 'function') return;

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
                };

                // --- PATCH MOTION MANAGER ---
                if (model.internalModel.motionManager) {
                    const originalMotionUpdate = model.internalModel.motionManager.update;
                    model.internalModel.motionManager.update = function (...args: any[]) {
                        const result = (originalMotionUpdate as any).apply(this, args);
                        if (isPlayingRef.current || debugSpeakingRef.current) {
                            applyLipSync(model.internalModel.coreModel);
                        }
                        return result;
                    };
                }

                // --- PATCH MODEL UPDATE ---
                const originalUpdate = model.update;
                model.update = function (delta: any) {
                    originalUpdate.apply(this, [delta]);
                    // Fallback
                    if (isPlayingRef.current || debugSpeakingRef.current) {
                        applyLipSync(this.internalModel.coreModel);
                    }
                };

                model.anchor.set(0.5, 1.0);
                pixiApp.current.stage.addChild(model as any);

                const resizeModel = () => {
                    if (!modelRef.current || !pixiApp.current || !containerRef.current) return;
                    const parentW = containerRef.current.clientWidth;
                    const parentH = containerRef.current.clientHeight;
                    pixiApp.current.renderer.resize(parentW, parentH);

                    const originalHeight = model.internalModel.originalHeight;
                    const originalWidth = model.internalModel.originalWidth;

                    let targetScale = (parentH / originalHeight) * 1.7;

                    if (parentW < parentH) {
                        targetScale = (parentH / originalHeight) * 1.6;
                    }

                    const isKeyboardOpen = parentH < 400;

                    if (isKeyboardOpen) {
                        targetScale = (parentW / originalWidth) * 0.2;
                        if (targetScale < 0.2) targetScale = 0.05;
                    }

                    model.scale.set(targetScale);

                    const currentHeight = originalHeight * targetScale;

                    if (isKeyboardOpen) {
                        const eyeLevelRatio = 0.8;
                        model.position.set(parentW * 0.5, (parentH * 0.5) + (currentHeight * eyeLevelRatio));
                    } else {
                        model.position.set(parentW * 0.5, currentHeight + (parentH * 0.05));
                    }
                };

                let resizeTimeout: any;
                const debouncedResize = () => {
                    clearTimeout(resizeTimeout);
                    resizeTimeout = setTimeout(() => {
                        resizeModel();
                    }, 200);
                };

                resizeModel();
                window.addEventListener('resize', debouncedResize);
                (pixiApp.current as any).resizeListener = debouncedResize;

                // --- IDLE SETUP ---
                if (model.internalModel.motionManager) {
                    if (!isIdleEnabled) {
                        model.internalModel.motionManager.stopAllMotions();
                        (model.internalModel.motionManager as any).idleMotionGroup = undefined;
                        addLog("🚫 Idle Animations: DISABLED");
                    } else {
                        addLog("✅ Idle Animations: ENABLED");
                    }
                }

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
                if ((pixiApp.current as any).resizeListener) {
                    window.removeEventListener('resize', (pixiApp.current as any).resizeListener);
                }
                pixiApp.current.destroy(true);
                pixiApp.current = null;
            }
        };
    }, [modelIndex]);

    useEffect(() => {
        const model = modelRef.current;
        if (!model || !model.internalModel || !model.internalModel.motionManager) return;
        const motionManager = model.internalModel.motionManager;

        if (isIdleEnabled) {
            (motionManager as any).idleMotionGroup = 'idle';
            model.interactive = true;
            model.autoInteract = true;
            if (motionManager.isFinished()) {
                motionManager.startRandomMotion('idle', 'low');
            }
        } else {
            motionManager.stopAllMotions();
            (motionManager as any).idleMotionGroup = undefined;
            model.interactive = false;
            model.autoInteract = false;
        }
    }, [isPlaying, isIdleEnabled, internalStatus]);

    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    return (
        <div className="w-full h-full relative overflow-hidden bg-transparent">
            {/* Overlay dưới model — gradient nhẹ từ dưới lên để model nổi bật */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent -z-10" />

            <div ref={containerRef} className="w-full h-full" />

            {internalStatus && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/80 backdrop-blur-lg px-8 py-4 rounded-2xl text-white text-sm font-medium animate-pulse z-50 shadow-2xl border border-white/10">
                    {internalStatus}
                </div>
            )}

            <div className="absolute top-3 right-3 z-30 flex flex-col items-end gap-2">
                <button
                    onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                    className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-md border border-white/20 text-white flex items-center justify-center hover:bg-black/60 transition-all shadow-sm"
                >
                    {isSettingsOpen ? '✕' : '⚙️'}
                </button>

                {isSettingsOpen && (
                    <div className="flex flex-col gap-2 bg-black/80 backdrop-blur-xl p-2 rounded-xl border border-white/10 shadow-xl min-w-[150px] animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="bg-white/5 rounded-lg px-3 py-2 flex items-center gap-2 mb-1 border border-white/5">
                            <div className={`w-2 h-2 rounded-full shadow-lg ${status === 'Connected' ? 'bg-green-400 shadow-green-400/50' : 'bg-red-400'}`} />
                            <span className="text-[10px] text-white/90 font-medium">{status}</span>
                        </div>

                        {toggleTheme && (
                            <button
                                onClick={toggleTheme}
                                className="bg-white/10 hover:bg-white/20 text-white text-[10px] px-3 py-2 rounded-lg text-left flex items-center gap-2 transition-all"
                            >
                                <span>{isDarkMode ? '🌙' : '☀️'}</span>
                                <span className="flex-1">{isDarkMode ? 'Dark Mode' : 'Light Mode'}</span>
                            </button>
                        )}

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
