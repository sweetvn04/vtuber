import os
import json
import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import google.generativeai as genai
from dotenv import load_dotenv
from tts_service import PiperTTS

# --- CONFIGURATION ---
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
SESSIONS_DIR = "sessions"

if not os.path.exists(SESSIONS_DIR):
    os.makedirs(SESSIONS_DIR)

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
else:
    print("WARNING: GEMINI_API_KEY not found in .env file")

# --- DATA MODELS ---
class SessionCreate(BaseModel):
    title: str

# --- HISTORY MANAGER ---
class HistoryStore:
    def __init__(self, directory: str):
        self.directory = directory

    def _get_path(self, session_id: str):
        return os.path.join(self.directory, f"{session_id}.json")

    def create_session(self, title: str):
        session_id = str(uuid.uuid4())
        session_data = {
            "id": session_id,
            "title": title,
            "created_at": datetime.now().isoformat(),
            "history": []
        }
        with open(self._get_path(session_id), "w", encoding="utf-8") as f:
            json.dump(session_data, f, ensure_ascii=False, indent=2)
        return session_data

    def get_sessions(self):
        sessions = []
        if not os.path.exists(self.directory): return []
        for fn in os.listdir(self.directory):
            if fn.endswith(".json"):
                with open(os.path.join(self.directory, fn), "r", encoding="utf-8") as f:
                    data = json.load(f)
                    sessions.append({
                        "id": data["id"],
                        "title": data["title"],
                        "created_at": data["created_at"],
                        "history": data.get("history", [])
                    })
        return sorted(sessions, key=lambda x: x["created_at"], reverse=True)

    def get_history(self, session_id: str):
        path = self._get_path(session_id)
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        return None

    def add_message(self, session_id: str, role: str, content: str):
        path = self._get_path(session_id)
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            data["history"].append({"role": role, "content": content})
            with open(path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            return True
        return False

    def delete_session(self, session_id: str):
        path = self._get_path(session_id)
        if os.path.exists(path):
            os.remove(path)
            return True
        return False

history_store = HistoryStore(SESSIONS_DIR)
tts = PiperTTS()

# --- FASTAPI APP ---
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/chat/sessions")
async def list_sessions():
    return history_store.get_sessions()

@app.post("/api/chat/session/create")
async def create_session(session: SessionCreate):
    return history_store.create_session(session.title)

@app.get("/api/chat/session/{session_id}")
async def get_session(session_id: str):
    data = history_store.get_history(session_id)
    if not data:
        return {"error": "Not found"}
    return data

@app.delete("/api/chat/session/{session_id}")
async def delete_session(session_id: str):
    if history_store.delete_session(session_id):
        return {"status": "success"}
    return {"error": "Not found"}

@app.websocket("/ws/chat/{session_id}")
async def chat_endpoint(websocket: WebSocket, session_id: str):
    await websocket.accept()
    
    # Lấy lịch sử chat từ store
    session_data = history_store.get_history(session_id)
    if not session_data:
        await websocket.close(code=1008)
        return

    # Khởi tạo model đơn giản (Gemma 3 không hỗ trợ system_instruction trực tiếp)
    model = genai.GenerativeModel(model_name="models/gemma-3-4b-it")

    system_prompt = """
        Bối cảnh: Bạn là Hiyori, một nữ VTuber ảo năng động và đáng yêu.
        Tính cách: Vui vẻ, hay dùng icon (emo).
        Thông tin về bạn (Chủ nhân): Bạn đang trò chuyện với sweetvn.
        Cách xưng hô: Xưng là 'Hiyori', gọi người dùng là 'sweetvn' hoặc là 'you'.
        Quy tắc trả lời: 
        1. Trả lời ngắn gọn, súc tích (khoảng 1-3 câu).
        2. Sử dụng tiếng Anh đơn giản để giúp sweetvn học tiếng Anh.
        3. Luôn giữ thái độ tích cực và thân thiết.
        4. Trả lời hoàn toàn bằng TIẾNG ANH (ENGLISH ONLY).
    """

    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if message["type"] == "TEXT_MESSAGE":
                user_text = message["payload"]
                
                # Lưu tin nhắn user vào store
                history_store.add_message(session_id, "user", user_text)
                
                # Lấy lịch sử để chuẩn bị gửi cho Gemini
                session_data = history_store.get_history(session_id)
                current_history = session_data["history"]

                # --- "MỒI" PROMPT VÀO HISTORY ---
                history_for_gemini = [
                    {"role": "user", "parts": [f"IMPORTANT INSTRUCTION: {system_prompt}\n\nPlease response as Hiyori."]},
                    {"role": "model", "parts": ["Understood! Hiyori is here and ready to talk to sweetvn! Hi hí!"]}
                ]

                # Thêm lịch sử chat thực tế (trừ câu vừa gửi để dùng send_message)
                for m in current_history[:-1]:
                    role = "user" if m["role"] == "user" else "model"
                    history_for_gemini.append({"role": role, "parts": [m["content"]]})
                
                # Khởi tạo chat với history đã được mồi prompt
                chat = model.start_chat(history=history_for_gemini)

                # Gửi câu chat hiện tại
                response = await chat.send_message_async(user_text)
                ai_text = response.text
                
                # Lưu câu trả lời của AI vào store
                history_store.add_message(session_id, "assistant", ai_text)
                
                # Sinh Audio
                audio_base64 = None
                try:
                    audio_base64 = tts.generate_audio(ai_text)
                except Exception as tts_err:
                    print(f"Lỗi TTS: {tts_err}")

                # Gửi kết quả về Frontend
                await websocket.send_json({
                    "type": "AI_RESPONSE_TEXT",
                    "payload": ai_text
                })

                if audio_base64:
                    await websocket.send_json({
                        "type": "AUDIO",
                        "payload": audio_base64
                    })

    except WebSocketDisconnect:
        print(f"Session {session_id} disconnected")
    except Exception as e:
        print(f"Error in chat endpoint: {e}")
        # Không cần send_json ở đây nếu connection đã đóng

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
