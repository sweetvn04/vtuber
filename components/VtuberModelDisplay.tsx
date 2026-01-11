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

    const audioObjRef = useRef<HTMLAudioElement | null>(null);
    const mouthIntervalRef = useRef<number | null>(null);

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

        if (audioObjRef.current) {
            audioObjRef.current.pause();
            audioObjRef.current = null;
        }
        if (mouthIntervalRef.current) {
            window.clearInterval(mouthIntervalRef.current);
        }

        const audio = new Audio(audioUrl);
        audioObjRef.current = audio;

        audio.onplay = () => {
            setIsPlaying(true);
            mouthIntervalRef.current = window.setInterval(() => {
                setMouthOpen(Math.random());
            }, 100);
        };

        const cleanup = () => {
            setIsPlaying(false);
            if (mouthIntervalRef.current) {
                window.clearInterval(mouthIntervalRef.current);
                mouthIntervalRef.current = null;
            }
            setMouthOpen(0);
        };

        audio.onended = cleanup;
        audio.onpause = cleanup;
        audio.play().catch(e => addLog(`Lỗi Play: ${e.message}`));
    }, [audioUrl]);

    useEffect(() => {
        (window as any).PIXI = PIXI;
        // const modelPath = '/models/akari_vts/akari.model3.json';
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

                if (!isMounted || !pixiApp.current) return;

                pixiApp.current.stage.addChild(model as any);

                const scale = Math.min(w / model.width, h / model.height) * 2;
                model.scale.set(scale);
                model.x = w / 2;
                model.y = h / 2;
                model.anchor.set(0.5, 0.2);

                // Bật tương tác chuột cho model
                model.interactive = true;
                // Lệnh này giúp model tự động "đảo mắt" và quay đầu theo vị trí chuột
                model.autoInteract = true;

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

            {/* Debug Controls */}
            <button
                onClick={() => setShowDebug(!showDebug)}
                className="absolute top-3 right-3 bg-black/30 hover:bg-black/50 text-white/70 hover:text-white px-3 py-1 text-[10px] rounded-full backdrop-blur-sm border border-white/10 transition-all"
            >
                {showDebug ? 'Hide Logs' : 'Show Logs'}
            </button>

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
