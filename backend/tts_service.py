import subprocess
import base64
import os
import re

class PiperTTS:
    def __init__(self, model_filename="en_US-amy-low.onnx"):
        # Đường dẫn đến file thực thi piper và model
        self.piper_path = os.path.join(os.path.dirname(__file__), "piper", "piper")
        self.model_path = os.path.join(os.path.dirname(__file__), "tts_model", model_filename)

    def clean_text(self, text: str) -> str:
        # Xóa các emoji và ký tự đặc biệt không muốn đọc
        # Regex này sẽ lọc bỏ hầu hết các emoji phổ biến
        text = re.sub(r'[^\x00-\x7F]+', ' ', text) # Cách đơn giản: giữ lại ký tự ASCII
        
        # Hoặc cách chuyên sâu hơn để bỏ emoji nhưng giữ tiếng Việt có dấu:
        # text = re.compile(r'[^\u0000-\u007F\u0080-\u00FF\u0100-\u017F\u0180-\u024F]+', re.UNICODE).sub('', text)
        
        # Xóa các dấu sao (thường dùng cho hành động như *vẫy tay*)
        text = re.sub(r'\*.*?\*', '', text) 
        
        # Xóa các khoảng trắng thừa
        text = ' '.join(text.split())
        return text

    def generate_audio(self, text: str) -> str:
        """
        Sinh âm thanh từ văn bản và trả về chuỗi Base64.
        """
        if not text or not text.strip():
            return None
        
        # --- LỌC VĂN BẢN TRƯỚC KHI ĐỌC ---
        cleaned_text = self.clean_text(text)
        if not cleaned_text: return None 
        # ---------------------------------

        try:
            # Gọi lệnh piper bằng subprocess
            # echo "text" | piper ... --output-raw
            process = subprocess.Popen(
                [self.piper_path, "--model", self.model_path, "--output_raw"],
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            
            # Gửi text vào pipeline
            wav_data, error = process.communicate(input=text.encode("utf-8"))
            
            if process.returncode != 0:
                print(f"Piper Error: {error.decode('utf-8')}")
                return None
                
            # Đóng gói thành file WAV (vì output_raw chỉ là PCM data)
            # Hoặc đơn giản hơn: Dùng --output_file - (stdout) để piper tự đóng gói WAV
            # Sửa lại lệnh trên một chút cho gọn:
            
            cmd = [
                self.piper_path,
                "--model", self.model_path,
                "--length_scale", "0.85", # Giảm xuống dưới 1.0 để nói nhanh hơn (Neuro nói khá nhanh)
                "--noise_scale", "0.667",  # Giữ nguyên hoặc tăng nhẹ để giọng có cảm xúc hơn
                "--output_file", "-"
            ]
            
            run_process = subprocess.run(
                cmd,
                input=cleaned_text.encode("utf-8"),
                capture_output=True
            )
            
            if run_process.returncode != 0:
                print(f"Piper Error: {run_process.stderr.decode('utf-8')}")
                return None
                
            # Chuyển dữ liệu binary (WAV) sang Base64
            audio_base64 = base64.b64encode(run_process.stdout).decode("utf-8")
            return audio_base64

        except Exception as e:
            print(f"TTS Exception: {e}")
            return None

    def generate_wav_file(self, text: str, output_path: str) -> bool:
        """
        Sinh âm thanh từ văn bản và lưu trực tiếp vào file WAV.
        Hữu ích cho pipeline RVC (Text -> Wav -> RVC -> Wav).
        """
        if not text or not text.strip(): return False
        
        cleaned_text = self.clean_text(text)
        if not cleaned_text: return False

        try:
            cmd = [
                self.piper_path,
                "--model", self.model_path,
                "--length_scale", "0.85",
                "--noise_scale", "0.667",
                "--output_file", output_path
            ]
            
            # Chạy lệnh
            subprocess.run(
                cmd,
                input=cleaned_text.encode("utf-8"),
                check=True,
                stdout=subprocess.DEVNULL, # Ẩn log không cần thiết
                stderr=subprocess.PIPE
            )
            return True
        except subprocess.CalledProcessError as e:
            print(f"Piper File Generation Error: {e.stderr.decode('utf-8')}")
            return False
        except Exception as e:
            print(f"TTS File Error: {e}")
            return False

# Test thử khi chạy trực tiếp file này
if __name__ == "__main__":
    tts = PiperTTS()
    b64 = tts.generate_audio("Hello world from Piper")
    if b64:
        print(f"Đã sinh ra {len(b64)} bytes Base64 audio.")