// src/App.js
import React, { useState } from 'react';
import './App.css';
import ChatInterface from './components/ChatInterface';
import VtuberModelDisplay from './components/VtuberModelDisplay';
import UserCamera from './components/UserCamera';
import ChatHistorySidebar from './components/ChatHistorySidebar';

function App() {
  // State để quản lý chat hiện tại
  const [currentChat, setCurrentChat] = useState(null);

  // Hàm xử lý khi chọn một chat từ lịch sử
  const handleSelectChat = (chat) => {
    console.log('Đã chọn chat:', chat);
    setCurrentChat(chat);
    // TODO: Load tin nhắn của chat này từ localStorage hoặc database
    // và truyền vào ChatInterface
  };

  // Hàm xử lý khi tạo chat mới
  const handleNewChat = () => {
    console.log('Tạo chat mới');
    setCurrentChat(null);
    // TODO: Reset ChatInterface về trạng thái ban đầu
  };

  return (
    <div className="app-container">
      {/* Sidebar lịch sử chat */}
      <ChatHistorySidebar 
        onSelectChat={handleSelectChat}
        onNewChat={handleNewChat}
      />

      {/* Panel bên trái (Camera + Chat) */}
      <div className="left-panel">
        <div className="top-left">
          <UserCamera />
        </div>
        <div className="bottom-left">
          <ChatInterface currentChat={currentChat} />
        </div>
      </div>

      {/* Panel bên phải (VTuber) */}
      <div className="right-panel">
        <VtuberModelDisplay />
      </div>
    </div>
  );
}

export default App;