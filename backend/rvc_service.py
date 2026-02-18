import os
import subprocess
import logging
import torch

# MONKEY PATCH: Sửa lỗi torch.load trên PyTorch mới yêu cầu weights_only=True
# Fairseq và RVC cần load các object cũ nên buộc phải dùng weights_only=False
_original_torch_load = torch.load
def safe_torch_load(*args, **kwargs):
    if 'weights_only' not in kwargs:
        kwargs['weights_only'] = False
    return _original_torch_load(*args, **kwargs)
torch.load = safe_torch_load

# Cấu hình logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class RVCService:
    def __init__(self, model_filename: str = None):
        """
        Khởi tạo dịch vụ RVC (Retrieval-based Voice Conversion)
        :param model_filename: Tên file .pth trong thư mục backend/rvc_models/
        """
        self.models_dir = os.path.join(os.path.dirname(__file__), "rvc_models")
        self.model_filename = model_filename
        self.enabled = False
        
        if model_filename:
            self.model_path = os.path.join(self.models_dir, model_filename)
            if os.path.exists(self.model_path):
                self.enabled = True
                logger.info(f"RVC Service enabled with model: {self.model_path}")
            else:
                logger.warning(f"RVC Model file not found: {self.model_path}")
        else:
            logger.info("RVC Service initialized but no model selected.")

    def convert_audio(self, input_wav_path: str, output_wav_path: str, pitch_up_key: int = 0):
        """
        Chuyển đổi giọng nói từ file input_wav_path sang output_wav_path dùng model RVC
        """
        if not self.enabled:
            logger.warning("RVC is not enabled or model is missing.")
            return False
            
        try:
            # Cách 1: Sử dụng thư viện rvc-python (khuyên dùng)
            # Cần cài đặt: pip install rvc-python
            from rvc_python.infer import RVCInference
            
            # Tự động detect device (cuda hoặc cpu)
            # Nếu có file index (giúp giọng giống hơn), nó thường nằm cùng thư mục hoặc cần chỉ định
            # Ở đây ta tìm file .index tự động nếu có
            index_file = None
            for f in os.listdir(self.models_dir):
                if f.endswith(".index"):
                    index_file = os.path.join(self.models_dir, f)
                    break 
            
            logger.info("Starting RVC inference...")
            
            rvc = RVCInference(device="cuda:0")
            
            # 1. Load Model with Version Check
            try:
                # Thử load như model v2 trước (phổ biến nhất)
                rvc.load_model(self.model_path, version="v2", index_path=index_file)
            except Exception as v2_error:
                logger.warning(f"Failed to load as v2, trying v1... Error: {v2_error}")
                try:
                     rvc.load_model(self.model_path, version="v1", index_path=index_file)
                except Exception as v1_error:
                     # Nếu vẫn lỗi thì có thể đây là model RVC v1 nhưng config khác, hoặc file lỗi
                     logger.error(f"Cannot load model as v1 or v2: {v1_error}")
                     raise v1_error
            
            # 2. Set Parameters
            rvc.set_params(
                f0up_key=pitch_up_key,
                f0method="rmvpe",
                index_rate=0.75,
                filter_radius=3,
                resample_sr=0,
                rms_mix_rate=0.25,
                protect=0.33
            )

            # 3. Inference
            rvc.infer_file(
                input_path=input_wav_path,
                output_path=output_wav_path
            )
            
            if os.path.exists(output_wav_path):
                logger.info(f"RVC Conversion successful: {output_wav_path}")
                return True
            else:
                logger.error("RVC output file was not created.")
                return False

        except ImportError:
            logger.error("MISSING LIBRARY: Please install 'rvc-python' (pip install rvc-python)")
            return False
        except Exception as e:
            logger.error(f"RVC Inference Error: {e}")
            return False
