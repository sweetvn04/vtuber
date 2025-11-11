// src/components/ChatHistorySidebar.js
import React, { useState } from 'react';
import './ChatHistorySidebar.css';

const ChatHistorySidebar = ({ onSelectChat, onNewChat }) => {
  // Danh sách lịch sử chat (sau này sẽ lưu vào localStorage hoặc database)
  const [chatHistory, setChatHistory] = useState([
    {
      id: 1,
      title: 'Hỏi về JavaScript',
      date: '2024-11-11',
      preview: 'Em muốn hỏi về array methods...'
    },
    {
      id: 2,
      title: 'Học React Hook',
      date: '2024-11-10',
      preview: 'useState và useEffect khác nhau...'
    },
    {
      id: 3,
      title: 'CSS Flexbox',
      date: '2024-11-09',
      preview: 'Làm sao để căn giữa element...'
    }
  ]);

  // State để mở/đóng sidebar
  const [isOpen, setIsOpen] = useState(false);

  // State để track chat đang được chọn
  const [selectedChatId, setSelectedChatId] = useState(null);

  // Hàm xử lý khi click vào một chat
  const handleSelectChat = (chat) => {
    setSelectedChatId(chat.id);
    if (onSelectChat) {
      onSelectChat(chat); // Gọi callback từ component cha
    }
  };

  // Hàm xử lý tạo chat mới
  const handleNewChat = () => {
    setSelectedChatId(null);
    if (onNewChat) {
      onNewChat(); // Gọi callback từ component cha
    }
  };

  // Hàm xử lý xóa chat
  const handleDeleteChat = (chatId, e) => {
    e.stopPropagation(); // Ngăn không trigger handleSelectChat
    setChatHistory(chatHistory.filter(chat => chat.id !== chatId));
  };

  return (
    <>
      {/* Nút toggle sidebar (dấu 3 gạch) */}
      <button 
        className="sidebar-toggle-btn"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? '✕' : '☰'}
      </button>

      {/* Sidebar chính */}
      <div className={`chat-history-sidebar ${isOpen ? 'open' : 'closed'}`}>
        
        {/* Header với nút New Chat */}
        <div className="sidebar-header">
          <h3>💬 Lịch sử chat</h3>
          <button className="new-chat-btn" onClick={handleNewChat}>
            ➕ Chat mới
          </button>
        </div>

        {/* Danh sách các cuộc trò chuyện */}
        <div className="chat-list">
          {chatHistory.length === 0 ? (
            <div className="empty-state">
              <p>Chưa có lịch sử chat</p>
              <p>Bắt đầu cuộc trò chuyện đầu tiên!</p>
            </div>
          ) : (
            chatHistory.map(chat => (
              <div
                key={chat.id}
                className={`chat-item ${selectedChatId === chat.id ? 'active' : ''}`}
                onClick={() => handleSelectChat(chat)}
              >
                {/* Tiêu đề chat */}
                <div className="chat-item-title">{chat.title}</div>
                
                {/* Preview tin nhắn */}
                <div className="chat-item-preview">{chat.preview}</div>
                
                {/* Ngày tháng */}
                <div className="chat-item-date">{chat.date}</div>
                
                {/* Nút xóa */}
                <button
                  className="delete-btn"
                  onClick={(e) => handleDeleteChat(chat.id, e)}
                  title="Xóa chat"
                >
                  🗑️
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer (optional) */}
        <div className="sidebar-footer">
          <p>Tổng: {chatHistory.length} cuộc trò chuyện</p>
        </div>
      </div>
    </>
  );
};

export default ChatHistorySidebar;