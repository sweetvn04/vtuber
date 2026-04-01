import os
import json
import base64
import uuid
import importlib.util
import warnings
# Tắt FutureWarning spam từ torch.nn.utils.weight_norm (không ảnh hưởng chức năng)
warnings.filterwarnings("ignore", category=FutureWarning)
from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import google.generativeai as genai
from dotenv import load_dotenv
from tts_service import PiperTTS
from rvc_service import RVCService

# --- LOAD SEARCH SERVICE (tên file có dấu '-' nên phải dùng importlib) ---
_search_spec = importlib.util.spec_from_file_location(
    "search_service",
    os.path.join(os.path.dirname(__file__), "search-service.py")
)
_search_mod = importlib.util.module_from_spec(_search_spec)
_search_spec.loader.exec_module(_search_mod)
web_search = _search_mod.web_search
print("[Search] search-service.py loaded OK")

# --- CONFIGURATION ---
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
API_SECRET_KEY = os.getenv("API_SECRET_KEY", "")
SESSIONS_DIR = "sessions"

if not API_SECRET_KEY:
    print("WARNING: API_SECRET_KEY not set! Backend is unprotected.")

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

ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "https://localhost:3000",
    "http://localhost:5173",
    "http://vtuber.sweetvn2004.id.vn",
    "https://vtuber.sweetvn2004.id.vn",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

from fastapi import Request, Query
from fastapi.responses import Response

# --- API KEY MIDDLEWARE ---
@app.middleware("http")
async def verify_api_key(request: Request, call_next):
    # Cho phép OPTIONS (preflight CORS) đi qua không cần key
    if request.method == "OPTIONS":
        return await call_next(request)
    # WebSocket upgrade thì bỏ qua (WS tự kiểm tra bên dưới)
    if request.headers.get("upgrade", "").lower() == "websocket":
        return await call_next(request)
    # Kiểm tra X-API-Key header
    api_key = request.headers.get("X-API-Key", "")
    if API_SECRET_KEY and api_key != API_SECRET_KEY:
        return JSONResponse(
            {"error": "Unauthorized", "detail": "Invalid or missing API key"},
            status_code=401
        )
    return await call_next(request)

@app.get("/api/chat/sessions")
async def list_sessions():
    return history_store.get_sessions()

@app.post("/api/transcribe")
async def transcribe_audio(audio: UploadFile = File(...)):
    """Nhận file audio từ trình duyệt, dùng Gemini để transcribe thành text."""
    try:
        audio_bytes = await audio.read()
        if not audio_bytes:
            return JSONResponse({"text": ""}, status_code=200)

        # Xác định MIME type
        filename = audio.filename or "recording.webm"
        if filename.endswith(".ogg"):
            mime = "audio/ogg"
        elif filename.endswith(".mp4"):
            mime = "audio/mp4"
        else:
            mime = "audio/webm"

        print(f"[Transcribe] Received {len(audio_bytes)} bytes, mime={mime}")

        # Gửi lên Gemini để transcribe
        model = genai.GenerativeModel("gemini-2.0-flash")
        response = model.generate_content([
            {
                "mime_type": mime,
                "data": base64.b64encode(audio_bytes).decode("utf-8"),
            },
            "Hãy transcribe chính xác những gì được nói trong đoạn audio này. Chỉ trả về text, không thêm bất kỳ giải thích nào."
        ])

        text = response.text.strip() if response.text else ""
        print(f"[Transcribe] Result: {repr(text)}")
        return {"text": text}

    except Exception as e:
        print(f"[Transcribe] Error: {e}")
        return JSONResponse({"error": str(e)}, status_code=500)



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
async def chat_endpoint(
    websocket: WebSocket,
    session_id: str,
    api_key: str = Query(default="", alias="api_key")
):
    # --- ORIGIN CHECK ---
    origin = websocket.headers.get("origin", "")
    if origin not in ALLOWED_ORIGINS:
        await websocket.close(code=1008)
        print(f"[WS] Blocked unauthorized origin: {origin!r}")
        return

    # --- API KEY CHECK cho WebSocket (qua query param vì browser WS k set header) ---
    if API_SECRET_KEY and api_key != API_SECRET_KEY:
        await websocket.close(code=1008)
        print(f"[WS] Blocked: invalid api_key from origin {origin!r}")
        return

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
                # Đọc flag TTS từ client (mặc định True nếu không có)
                tts_enabled = message.get("tts_enabled", True)

                # --- WEB SEARCH: tự động tìm kiếm nếu câu hỏi cần thông tin thực tế ---
                # Các từ khoá gợi ý rằng user cần thông tin mới/thực tế
                SEARCH_KEYWORDS = [
                    "today", "now", "latest", "recent", "news", "current",
                    "2024", "2025", "2026", "weather", "price", "score",
                    "hôm nay", "mới nhất", "tin tức", "thời tiết", "hiện tại",
                    "bây giờ", "gần đây", "vừa", "mới", "search", "tìm"
                ]
                user_lower = user_text.lower()
                needs_search = any(kw in user_lower for kw in SEARCH_KEYWORDS)

                search_context = ""
                if needs_search:
                    print(f"[Search] ➤ Keyword matched! Querying DuckDuckGo: '{user_text[:80]}'")
                    await websocket.send_json({"type": "STATUS", "payload": "searching"})
                    try:
                        search_results = web_search(user_text, max_results=3)
                        if search_results and search_results != "No results found.":
                            search_context = (
                                f"\n\n[WEB SEARCH RESULTS - use this to answer]:\n"
                                f"{search_results}"
                                f"[END OF SEARCH RESULTS]\n"
                            )
                            print(f"[Search] ✅ Got {len(search_results)} chars of results")
                            print(f"[Search] Preview: {search_results[:200]}")
                        else:
                            print("[Search] ⚠️  No results found.")
                    except Exception as search_err:
                        import traceback
                        print(f"[Search] ❌ Error: {search_err}")
                        traceback.print_exc()
                else:
                    print(f"[Search] ⏩ Skipped (no keywords matched) for: '{user_text[:60]}'")
                # -----------------------------------------------------------------------

                # Lưu tin nhắn user vào store (lưu text gốc, không lưu context search)
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

                # Gửi câu chat hiện tại (kèm search context nếu có)
                message_to_send = user_text + search_context
                response = await chat.send_message_async(message_to_send)
                ai_text = response.text
                
                # Lưu câu trả lời của AI vào store
                history_store.add_message(session_id, "assistant", ai_text)

                # --- GỬITEXT TRƯỚC (luôn luôn) ---
                await websocket.send_json({
                    "type": "AI_RESPONSE_TEXT",
                    "payload": ai_text
                })

                # --- PIPELINE TTS + RVC (chỉ chạy khi TTS được bật) ---
                if tts_enabled:
                    audio_base64 = None
                    try:
                        # PIPELINE: TTS -> RVC -> BASE64
                        temp_wav = os.path.join(os.path.dirname(__file__), f"temp_{int(datetime.now().timestamp())}.wav")
                        
                        # 1. TTS: Sinh file WAV gốc từ Piper
                        if tts.generate_wav_file(ai_text, temp_wav):
                            final_wav = temp_wav
                            
                            # 2. RVC: Chuyển đổi giọng (nếu có model)
                            if rvc.enabled:
                                rvc_wav = temp_wav.replace(".wav", "_rvc.wav")
                                if rvc.convert_audio(temp_wav, rvc_wav, pitch_up_key=RVC_PITCH_SHIFT):
                                    final_wav = rvc_wav
                            
                            # 3. Mã hóa Base64 để gửi về frontend
                            with open(final_wav, "rb") as f:
                                audio_base64 = base64.b64encode(f.read()).decode("utf-8")
                                
                            # Cleanup file tạm
                            if os.path.exists(temp_wav): os.remove(temp_wav)
                            if os.path.exists(final_wav) and final_wav != temp_wav: os.remove(final_wav)

                        if not audio_base64:
                            print("Audio generation failed or empty")
                            
                    except Exception as tts_err:
                        print(f"Lỗi TTS Pipeline: {tts_err}")

                    if audio_base64:
                        await websocket.send_json({
                            "type": "AUDIO",
                            "payload": audio_base64
                        })
                else:
                    print(f"[TTS SKIP] Session {session_id}: TTS disabled by client.")

    except WebSocketDisconnect:
        print(f"Session {session_id} disconnected")
    except Exception as e:
        print(f"Error in chat endpoint: {e}")
        # Không cần send_json ở đây nếu connection đã đóng

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
