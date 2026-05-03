import sys
import os

# Thêm thư mục backend vào sys.path để import các service dễ dàng hơn
project_root = os.path.dirname(os.path.abspath(__file__))
sys.path.append(os.path.join(project_root, "backend"))

try:
    from tts_service import PiperTTS
    from rvc_service import RVCService
except ImportError as e:
    print(f"Lỗi khi import service: {e}")
    sys.exit(1)

def generate_voice_piper_rvc(text, rvc_model="alice.pth", piper_model="vi_VN-vais1000-medium.onnx", use_filter=False):
    print(f"Đang sinh âm thanh cho nội dung: '{text}'...")
    print("====================================")
    
    # 1. Khởi tạo Piper TTS
    print(f"[1/3] Khởi tạo Piper TTS với model: {piper_model}")
    piper = PiperTTS(model_filename=piper_model)
    
    # 2. Khởi tạo RVC
    print(f"[2/3] Khởi tạo RVC Service với model: {rvc_model}")
    rvc = RVCService(model_filename=rvc_model)
    if not rvc.enabled:
        print("Lỗi: Không tìm thấy model RVC hoặc thư viện chưa sẵn sàng.")
        return
        
    temp_wav = os.path.join(project_root, "temp_piper.wav")
    final_output = os.path.join(project_root, "final_rvc_output.wav")
    
    # 3. Chạy pipeline
    print("[3/3] Bắt đầu quá trình Generate -> Convert")
    
    # Sinh file từ Piper
    print(f"  -> Chạy Piper TTS (Filter={'BẬT' if use_filter else 'TẮT'})...")
    if not piper.generate_wav_file(text, temp_wav, use_filter=use_filter):
        print("❌ Lỗi khi sinh file wav từ Piper.")
        return
    
    # Chuyển đổi giọng nói qua RVC
    print("  -> Chạy RVC Convert...")
    if rvc.convert_audio(temp_wav, final_output):
        print("\n✅ HOÀN TẤT!")
        print(f"File đầu ra đã lưu tại: {final_output}")
        # Xóa file tạm
        if os.path.exists(temp_wav):
            os.remove(temp_wav)
    else:
        print("\n❌ Lỗi trong quá trình đổi giọng RVC.")

if __name__ == "__main__":
    # Nhận nội dung qua argument terminal hoặc hỏi trực tiếp
    if len(sys.argv) > 1:
        message = " ".join(sys.argv[1:])
    else:
        print("--- CÔNG CỤ TẠO GIỌNG NÓI (PIPER + RVC) ---")
        message = input("Nhập văn bản cần đọc: ")
        
        # Hỏi xem có dùng filter không
        filter_ans = input("Dùng filter xóa ký tự đặc biệt (khuyên nên TẮT đối với tiếng Việt)? [y/N]: ").strip().lower()
        use_filter = True if filter_ans == 'y' else False
        
    if message.strip():
        # Tham số: (text, tên_rvc_model, tên_piper_model)
        # Các RVC model hiện có: alice.pth, ayaka-jp.pth, nilou-zh.pth
        # Các Piper model hiện có: en_US-amy-low.onnx, en_US-hfc_female-medium.onnx, vi_VN-vais1000-medium.onnx
        try:
            # Nếu chạy bằng argument, mặc định tắt filter cho tiếng Việt
            if 'use_filter' not in locals():
                use_filter = False
        except:
            use_filter = False
            
        generate_voice_piper_rvc(message, rvc_model="alice.pth", piper_model="vi_VN-vais1000-medium.onnx", use_filter=use_filter)
    else:
        print("⚠️ Nội dung trống!")
