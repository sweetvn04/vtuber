// src/components/UserCamera.js

import React, { useState, useRef, useEffect } from 'react';
import './UserCamera.css'; // Đảm bảo file CSS này đã được import

const UserCamera = () => {
  // State để theo dõi camera đang bật hay tắt
  const [isCameraOn, setIsCameraOn] = useState(false);
  
  // Ref cho thẻ <video>
  const videoRef = useRef(null);
  
  // Ref để lưu trữ đối tượng MediaStream (luồng video)
  const streamRef = useRef(null);

  // Hàm để bật camera
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream; // Lưu lại luồng
      if (videoRef.current) {
        videoRef.current.srcObject = stream; // Hiển thị video
      }
      setIsCameraOn(true); // Cập nhật state
    } catch (err) {
      console.error("Lỗi khi bật camera:", err);
    }
  };

  // Hàm để tắt camera
  const stopCamera = () => {
    if (streamRef.current) {
      // Dừng tất cả các track (video, audio) trong luồng
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null; // Xóa luồng đã lưu
      if (videoRef.current) {
        videoRef.current.srcObject = null; // Xóa video khỏi thẻ
      }
      setIsCameraOn(false); // Cập nhật state
    }
  };

  // Hàm xử lý việc nhấn nút
  const handleToggleCamera = () => {
    if (isCameraOn) {
      stopCamera();
    } else {
      startCamera();
    }
  };

  // Thêm một useEffect để tự động tắt camera khi component bị unmount (rời đi)
  useEffect(() => {
    // Trả về một "cleanup function"
    return () => {
      stopCamera(); // Đảm bảo camera tắt khi rời trang
    };
  }, []); // [] nghĩa là chỉ chạy 1 lần lúc mount và cleanup lúc unmount

  return (
    <div className="user-camera-container">
      <h4>Camera của bạn</h4>
      
      {/* Chúng ta thêm một div "wrapper" để giữ chỗ cho video,
        kể cả khi video chưa được bật, để tránh làm "nhảy" bố cục.
      */}
      <div className="video-wrapper">
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted 
          className="user-video-feed" 
        />
        {/* Hiển thị thông báo nếu camera tắt */}
        {!isCameraOn && (
          <div className="video-placeholder">Camera đang tắt</div>
        )}
      </div>
      
      <button onClick={handleToggleCamera} className="toggle-camera-btn">
        {isCameraOn ? 'Tắt Camera (Off)' : 'Bật Camera (On)'}
      </button>
    </div>
  );
};

export default UserCamera;