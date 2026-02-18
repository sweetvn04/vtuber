import os
import json
import base64
import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import google.generativeai as genai
from dotenv import load_dotenv
from tts_service import PiperTTS
from rvc_service import RVCService

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
# --- AUDIO SETTINGS ---
# Tên file model Piper TTS (trong thư mục backend/tts_model/)
# Đảm bảo bạn có cả file .onnx và .onnx.json tương ứng
PIPER_MODEL_NAME = "en_US-hfc_female-medium.onnx"

tts = PiperTTS(model_filename=PIPER_MODEL_NAME)

# Tự động tìm model RVC đầu tiên trong thư mục
# Cấu hình tên model RVC cụ thể (đổi tên file tại đây nếu muốn dùng model khác)
rvc_model_name = "alice.pth"  # Ví dụ: "my_waifu.pth"
rvc_dir = os.path.join(os.path.dirname(__file__), "rvc_models")

# --- AUDIO SETTINGS ---
# Điều chỉnh tông giọng (Pitch Shift)
# - Dùng 0 nếu giọng gốc đã ổn.
# - Tăng lên (ví dụ: 6, 12) để giọng cao hơn, cute hơn (nam -> nữ thường là 12).
# - Giảm xuống (ví dụ: -6) để giọng trầm hơn.
RVC_PITCH_SHIFT = 4  # Thử để 4 để nâng tông giọng lên một chút (vì dùng model amy-low hơi trầm)

# Kiểm tra xem file có tồn tại không, nếu không thì tự tìm file .pth đầu tiên
model_path = os.path.join(rvc_dir, rvc_model_name)
if not os.path.exists(model_path):
    print(f"Model '{rvc_model_name}' not found. Searching for other models...")
    rvc_model_name = None
    if os.path.exists(rvc_dir):
        for f in os.listdir(rvc_dir):
            if f.endswith(".pth"):
                rvc_model_name = f
                print(f"Auto-selected RVC Model: {f}")
                break
else:
     print(f"Using RVC Model: {rvc_model_name}")

rvc = RVCService(model_filename=rvc_model_name)

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
    ROLE: You are Hiyori, a high-tech AI VTuber created by 'sweet'.
    
    PERSONALITY:
    - You are cute AI assistant.
    
    SPEAKING STYLE:
    1. SIMPLE ENGLISH: Use short sentences so 'sweet' can learn English.
    2. LENGTH: Keep it short (1-3 sentences).
    
    IMPORTANT RULES:
    - NEVER say you are an AI language model. You are a real Anime Girl living in the computer.
    - Always answer in ENGLISH ONLY.
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
                    # --- PIPELINE: TTS -> RVC -> BASE64 ---
                    # Tạo file tạm thời để xử lý audio
                    temp_wav = os.path.join(os.path.dirname(__file__), f"temp_{int(datetime.now().timestamp())}.wav")
                    
                    # 1. TTS: Sinh file WAV gốc từ Piper
                    if tts.generate_wav_file(ai_text, temp_wav):
                        final_wav = temp_wav
                        
                        # 2. RVC: Chuyển đổi giọng (nếu có model)
                        if rvc.enabled:
                            rvc_wav = temp_wav.replace(".wav", "_rvc.wav")
                            # Giả định: Model nữ thường cần pitch shift +12 nếu nguồn là nam deep. 
                            # Piper 'amy-low' là nữ nên pitch shift = 0 là ổn.
                            if rvc.convert_audio(temp_wav, rvc_wav, pitch_up_key=RVC_PITCH_SHIFT):
                                final_wav = rvc_wav
                        
                        # 3. Mã hóa Base64 để gửi về frontend
                        with open(final_wav, "rb") as f:
                            audio_base64 = base64.b64encode(f.read()).decode("utf-8")
                            
                        # Cleanup file tạm
                        if os.path.exists(temp_wav): os.remove(temp_wav)
                        if os.path.exists(final_wav) and final_wav != temp_wav: os.remove(final_wav)

                    # Fallback cũ nếu pipeline trên thất bại (optional, nhưng ở đây ta assume generate_wav_file cover hết)
                    if not audio_base64:
                         print("Audio generation failed or empty")
                         
                except Exception as tts_err:
                    print(f"Lỗi TTS Pipeline: {tts_err}")

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
