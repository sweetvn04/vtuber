"use client";

import React from 'react';

interface UserCameraProps {
    videoRef: React.RefObject<HTMLVideoElement | null>;
    isOn: boolean;
    onToggle: () => void;
    scanData?: any;
}

const UserCamera: React.FC<UserCameraProps> = ({ videoRef, isOn, onToggle, scanData }) => {
    return (
        <div className="w-[280px] bg-white rounded-[20px] p-5 box-border flex flex-col gap-4 shadow-[0_4px_20px_rgba(252,182,159,0.15),0_2px_8px_rgba(0,0,0,0.05)] border border-[#fcb69f]/20 transition-all duration-300 hover:shadow-[0_8px_30px_rgba(252,182,159,0.2),0_4px_12px_rgba(0,0,0,0.08)] hover:-translate-y-0.5">
            <h4 className="m-0 text-[#2d3748] text-base font-semibold text-center flex items-center justify-center gap-2">
                <span className="text-lg">📹</span> Camera của bạn
            </h4>

            <div className="w-full h-[180px] bg-gradient-to-br from-[#2d3748] to-[#1a202c] rounded-2xl relative overflow-hidden shadow-inner">
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover rounded-2xl animate-in fade-in zoom-in-95 duration-500 ${isOn ? 'block' : 'hidden'}`}
                />

                {!isOn && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-[#a0aec0] text-sm gap-3 bg-gradient-to-br from-[#2d3748] to-[#1a202c]">
                        <span className="text-5xl opacity-60 animate-pulse">📷</span>
                        <span>Camera đang tắt</span>
                    </div>
                )}

                {isOn && (
                    <div className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-[#48bb78] shadow-[0_0_10px_rgba(72,187,120,0.6)] animate-pulse" />
                )}

                {isOn && scanData && scanData.persons && scanData.persons.length > 0 && (
                    <div className="absolute bottom-3 left-3 right-3 bg-black/50 backdrop-blur-sm rounded-lg p-2 text-white text-[10px] animate-in slide-in-from-bottom-2 duration-300 overflow-hidden">
                        <div className="flex items-center gap-2">
                            <span className="text-sm">👤</span>
                            <div>
                                <div className="font-bold text-[#fcb69f] uppercase tracking-wider">{scanData.persons[0].gender}</div>
                                <div className="opacity-80">Ước tính: {scanData.persons[0].age} tuổi</div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <button
                onClick={onToggle}
                className="w-full p-3 px-4 border-none rounded-2xl bg-gradient-to-br from-[#fcb69f] to-[#ffa07a] text-white font-semibold text-sm cursor-pointer transition-all duration-200 shadow-[0_2px_8px_rgba(252,182,159,0.3)] flex items-center justify-center gap-2 hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(252,182,159,0.4)] active:translate-y-0"
            >
                <span>{isOn ? '🚫' : '📹'}</span>
                {isOn ? 'Tắt Camera' : 'Bật Camera'}
            </button>
        </div>
    );
};

export default UserCamera;
