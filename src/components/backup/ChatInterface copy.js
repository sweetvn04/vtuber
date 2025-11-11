// src/components/ChatInterface.js

import React, { useState, useRef, useEffect } from 'react';
import './ChatInterface.css'; // File CSS riêng cho khung chat

const ChatInterface = () => {
  const [messages, setMessages] = useState([
    { sender: 'vtuber', text: 'Xin chào! Bạn muốn hỏi gì hôm nay?' }
  ]);
  const [input, setInput] = useState('');
  const messageEndRef = useRef(null);

  // Tự động cuộn xuống tin nhắn mới nhất
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (input.trim() === '') return;

    const newUserMessage = { sender: 'user', text: input };
    
    // Thêm tin nhắn của người dùng và mô phỏng phản hồi của AI
    setMessages(prevMessages => [...prevMessages, newUserMessage]);
    
    // --- MÔ PHỎNG PHẢN HỒI CỦA VTUBER ---
    // (Đây là nơi bạn sẽ gọi API AI của mình)
    setTimeout(() => {
      const aiResponse = { sender: 'vtuber', text: `Tôi nhận được: "${input}"` };
      setMessages(prevMessages => [...prevMessages, aiResponse]);
    }, 1000);

    setInput(''); // Xóa nội dung input
  };

  return (
    <div className="chat-interface">
      <div className="message-list">
        {messages.map((msg, index) => (
          <div key={index} className={`message ${msg.sender}`}>
            <p>{msg.text}</p>
          </div>
        ))}
        {/* Đây là một div trống để tự động cuộn */}
        <div ref={messageEndRef} />
      </div>
      <form className="chat-input-form" onSubmit={handleSendMessage}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Nhập tin nhắn..."
        />
        <button type="submit">Gửi</button>
        {/* Nút 'Giọng nói' (chưa có chức năng) */}
        <button type="button" className="voice-button">🎤</button>
      </form>
    </div>
  );
};

export default ChatInterface;