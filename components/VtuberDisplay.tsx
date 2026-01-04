"use client"; // This tells Next.js to run this component on the browser

import React, { useEffect, useRef } from 'react';
import * as PIXI from 'pixi.js';
// PIXI global setup will be done inside useEffect

const VtuberDisplay = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const appRef = useRef<PIXI.Application | null>(null);

    useEffect(() => {
        // 1. setup the stage (pixi application)
        const app = new PIXI.Application({
            width: 800,
            height: 600,
            backgroundAlpha: 0, //transparent background
            antialias: true,
        });
        appRef.current = app;

        if (containerRef.current) {
            containerRef.current.appendChild(app.view as HTMLCanvasElement);
        }

        if (typeof window !== 'undefined') {
            (window as any).PIXI = PIXI;
        }

        // 2. Load the model
        const modelUrl = "/models/akari_vts/akari.model3.json";

        async function loadModel() {
            const { Live2DModel } = await import('pixi-live2d-display');
            const model = await Live2DModel.from(modelUrl);

            (app.stage as PIXI.Container).addChild(model as any);

            model.scale.set(0.1);
            model.x = 200;
            model.y = 300;
            model.anchor.set(0.5, 0.5);
        }

        loadModel();
        //3.cleanup: stop the engine when we leave the page
        return () => {
            app.destroy(true, { children: true });
        };
    }, []);

    return (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-blue-400 to-purple-500 rounded-xl overflow-hidden shadow-2xl">
            <div ref={containerRef} />
        </div>
    )
};

export default VtuberDisplay;