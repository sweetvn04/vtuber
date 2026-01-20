# Sweet VTuber 🎀

**Sweet VTuber** là một ứng dụng VTuber ảo tích hợp trí tuệ nhân tạo (AI), cho phép người dùng trò chuyện trực tiếp với nhân vật Live2D thông qua giọng nói và văn bản. Dự án kết hợp sức mạnh của Google Gemini để xử lý hội thoại và Piper TTS để mang lại giọng nói tự nhiên, sinh động.

## ✨ Tính năng nổi bật

*   **Nhân vật Live2D Tương tác:** Hiển thị model Live2D (Hiyori) với hiệu ứng chuyển động và lip-sync khớp với giọng nói.
*   **Trò chuyện với AI:** Tích hợp Google Gemini (Gemma 3) giúp nhân vật có khả năng phản hồi thông minh, hóm hỉnh.
*   **Chế độ học Tiếng Anh:** Nhân vật (Hiyori) được thiết lập để trả lời hoàn toàn bằng tiếng Anh ngắn gọn, súc tích, hỗ trợ người dùng luyện tập giao tiếp.
*   **Chuyển đổi văn bản thành giọng nói (TTS):** Sử dụng Piper mang lại tốc độ phản hồi cực nhanh và giọng nói chất lượng cao.
*   **Quản lý lịch sử chat:** Lưu trữ các phiên trò chuyện dưới dạng phiên (sessions), cho phép xem lại hoặc xóa lịch sử.
*   **Giao diện hiện đại:** Được xây dựng bằng Next.js 15 và Tailwind CSS, mang lại trải nghiệm mượt mà và thẩm mỹ.

## 🛠️ Công nghệ sử dụng

### Frontend:
*   **Framework:** Next.js 15 (App Router)
*   **UI/UX:** Tailwind CSS, Lucide Icons
*   **Live2D Engine:** PixiJS & pixi-live2d-display
*   **State Management:** React Hooks (useState, useEffect)

### Backend:
*   **Framework:** FastAPI (Python)
*   **AI Model:** Google Generative AI (Gemini API)
*   **TTS Engine:** Piper TTS
*   **Communication:** WebSockets (để streaming tin nhắn và audio)

## 🚀 Hướng dẫn cài đặt

### 1. Chuẩn bị môi trường
Yêu cầu:
*   Node.js 18+
*   Python 3.10+
*   API Key từ [Google AI Studio](https://aistudio.google.com/)

### 2. Cài đặt Backend
```bash
cd backend
# Tạo môi trường ảo (khuyến nghị)
python -m venv .venv
source .venv/bin/activate  # Linux/macOS
# .venv\Scripts\activate   # Windows

# Cài đặt thư viện
pip install -r requirements.txt
```

**Cấu hình Piper:**
Đảm bảo thư mục `backend/piper` có chứa file thực thi `piper` và thư mục `backend/tts_model` có chứa file model `.onnx` (ví dụ: `en_US-amy-low.onnx`).

### 3. Cài đặt Frontend
```bash
# Tại thư mục gốc của project
npm install
```

### 4. Cấu hình biến môi trường
Tạo file `.env` ở thư mục gốc:
```env
GEMINI_API_KEY=your_api_key_here
```

## 🏃 Cách chạy ứng dụng

Bạn cần chạy đồng thời cả Backend và Frontend:

1.  **Chạy Backend:**
    ```bash
    cd backend
    python main.py
    ```
    Backend sẽ chạy tại `http://localhost:8080`.

2.  **Chạy Frontend:**
    ```bash
    npm run dev
    ```
    Mở trình duyệt và truy cập `http://localhost:3000`.

## 📂 Cấu trúc thư mục chủ yếu

*   `app/`: Chứa các trang chính của Next.js.
*   `components/`: Các component UI (ChatInterface, ChatHistory, VtuberModel...).
*   `backend/`:
    *   `main.py`: Entry point của FastAPI và logic xử lý WebSocket/Gemini.
    *   `tts_service.py`: Xử lý chuyển đổi văn bản sang âm thanh bằng Piper.
    *   `sessions/`: Lưu trữ lịch sử chat dưới dạng file JSON.
*   `public/`: Chứa các tài nguyên tĩnh, model Live2D.

## 📝 Giấy phép
Dự án được tạo ra với mục đích học tập và giải trí.

---
*Chúc bạn có những giây phút trò chuyện vui vẻ với Hiyori!* ฅ^•ﻌ•^ฅ
