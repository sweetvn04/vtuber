import { useState, useEffect, useRef } from 'react'
import './App.css'

function App() {
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Bot: Đang chờ kết nối..." }
  ])
  const [inputText, setInputText] = useState("")
  const [status, setStatus] = useState("Đang ngắt kết nối")
  const ws = useRef(null)

  // Khởi tạo WebSocket kết nối thẳng vào cổng 8080 của Python
  useEffect(() => {
    // Session ID tĩnh tạm thời để test
    const sessionId = "test_react_session"
    // URL kết nối tới WebSocket của FastAPI
    const wsUrl = `ws://localhost:8080/ws/chat/${sessionId}?api_key=`
    
    ws.current = new WebSocket(wsUrl)

    ws.current.onopen = () => {
      setStatus("Đã kết nối thành công với Bot!")
      setMessages([{ role: "assistant", content: "Bot: Đã kết nối! Bạn hãy chat thử đi." }])
    }

    ws.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        // Nhận chữ trả về từ AI
        if (data.type === "AI_RESPONSE_TEXT") {
          setMessages(prev => [...prev, { role: "assistant", content: `Bot: ${data.payload}` }])
        }
      } catch (e) {
        console.error("Lỗi đọc dữ liệu WS:", e)
      }
    }

    ws.current.onclose = () => setStatus("Bị ngắt kết nối.")
    ws.current.onerror = () => setStatus("Lỗi kết nối!")

    // Dọn dẹp khi đóng trang
    return () => {
      if (ws.current) ws.current.close()
    }
  }, [])

  const handleSend = () => {
    if (inputText.trim() && ws.current?.readyState === WebSocket.OPEN) {
      // 1. Hiện tin nhắn user lên màn hình
      setMessages(prev => [...prev, { role: "user", content: `Bạn: ${inputText}` }])
      
      // 2. Gửi dữ liệu theo đúng chuẩn JSON backend yêu cầu
      ws.current.send(JSON.stringify({ 
        type: "TEXT_MESSAGE", 
        payload: inputText, 
        tts_enabled: false // Tạm tắt giọng nói để test chữ trước
      }))
      
      setInputText("")
    }
  }

  return (
    <div style={{ padding: 20, maxWidth: 600, margin: '0 auto', textAlign: 'left' }}>
      <h1 style={{ fontSize: 24, textAlign: 'center' }}>Test Kết Nối React - Python</h1>
      <p style={{ textAlign: 'center', color: status.includes("thành công") ? 'green' : 'red' }}>
        Trạng thái: <b>{status}</b>
      </p>
      
      {/* KHU VỰC CHAT */}
      <div style={{ height: 350, border: '1px solid #ccc', overflowY: 'auto', padding: 15, marginBottom: 20, borderRadius: 8, background: '#f9f9f9' }}>
        {messages.map((msg, index) => (
          <div key={index} style={{
              margin: '10px 0',
              textAlign: msg.role === 'user' ? 'right' : 'left'
          }}>
             <span style={{
                display: 'inline-block',
                padding: '10px 14px',
                borderRadius: 8,
                background: msg.role === 'user' ? '#3b82f6' : '#e5e7eb',
                color: msg.role === 'user' ? 'white' : 'black'
             }}>
               {msg.content}
             </span>
          </div>
        ))}
      </div>

      {/* KHU VỰC NHẬP LIỆU */}
      <div style={{ display: 'flex', gap: 10 }}>
         <input 
            type="text" 
            style={{ flex: 1, padding: 10, borderRadius: 6, border: '1px solid #ccc' }}
            value={inputText} 
            onChange={(e) => setInputText(e.target.value)} 
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Nhập tin nhắn để test Bot..." 
         />
         <button 
           style={{ padding: '10px 20px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}
           onClick={handleSend}
         >
            Gửi
         </button>
      </div>
    </div>
  )
}

export default App
