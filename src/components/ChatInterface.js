// src/components/ChatInterface.js
import React, { useState, useRef, useEffect } from 'react';
import './ChatInterface.css';

const ChatInterface = () => {
  const [messages, setMessages] = useState([
    { sender: 'vtuber', text: 'Xin chào! Bạn muốn hỏi gì hôm nay?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messageEndRef = useRef(null);

  // ===== CẤU HÌNH GEMINI API =====
  const GEMINI_API_KEY = 'AIzaSyDhF2imExareMAtwrJqXLXO9v5LtUmQIiE'; // ⚠️ Thay bằng API key ĐẦY ĐỦ từ Google AI Studio
  const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  // Tự động cuộn xuống tin nhắn mới nhất
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Hàm gọi Gemini API
  const callGeminiAPI = async (userMessage) => {
    try {
      const response = await fetch(GEMINI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: userMessage
            }]
          }]
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Chi tiết lỗi API:', errorData);
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();
      
      // Kiểm tra xem có response không
      if (!data.candidates || !data.candidates[0]?.content?.parts?.[0]?.text) {
        throw new Error('Không nhận được phản hồi từ API');
      }

      const aiText = data.candidates[0].content.parts[0].text;
      return aiText;
    } catch (error) {
      console.error('Lỗi khi gọi Gemini API:', error);
      return 'Xin lỗi, tôi gặp sự cố khi xử lý yêu cầu của bạn. Vui lòng kiểm tra API key.';
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (input.trim() === '' || isLoading) return;

    const userMessage = input.trim();
    const newUserMessage = { sender: 'user', text: userMessage };

    // Thêm tin nhắn của người dùng
    setMessages(prevMessages => [...prevMessages, newUserMessage]);
    setInput('');
    setIsLoading(true);

    // Thêm tin nhắn "đang trả lời..."
    setMessages(prevMessages => [
      ...prevMessages, 
      { sender: 'vtuber', text: '💭 Đang suy nghĩ...', isTyping: true }
    ]);

    // Gọi Gemini API
    const aiResponse = await callGeminiAPI(userMessage);

    // Xóa tin nhắn "đang trả lời" và thêm phản hồi thực
    setMessages(prevMessages => {
      const filtered = prevMessages.filter(msg => !msg.isTyping);
      return [...filtered, { sender: 'vtuber', text: aiResponse }];
    });

    setIsLoading(false);
  };

  return (
    <div className="chat-interface">
      <div className="message-list">
        {messages.map((msg, index) => (
          <div key={index} className={`message ${msg.sender}`}>
            <p>{msg.text}</p>
          </div>
        ))}
        <div ref={messageEndRef} />
      </div>

      <form className="chat-input-form" onSubmit={handleSendMessage}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Nhập tin nhắn..."
          disabled={isLoading}
        />
        <button type="submit" disabled={isLoading}>
          {isLoading ? '⏳' : 'Gửi'}
        </button>
        <button type="button" className="voice-button">🎤</button>
      </form>
    </div>
  );
};

export default ChatInterface;