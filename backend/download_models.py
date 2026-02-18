import os
import requests
import sys

# Cấu hình các model cần tải
# Bạn có thể thêm link model RVC của bạn vào đây nếu bạn upload nó lên Google Drive/HuggingFace
MODELS = {
    "piper": {
        "folder": "tts_model",
        "files": [
            {
                "url": "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/hfc_female/medium/en_US-hfc_female-medium.onnx?download=true",
                "name": "en_US-hfc_female-medium.onnx"
            },
            {
                "url": "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/hfc_female/medium/en_US-hfc_female-medium.onnx.json?download=true",
                "name": "en_US-hfc_female-medium.onnx.json"
            }
        ]
    },
    # Nếu bạn có link tải RVC model, hãy bỏ comment và điền link vào đây
    # "rvc": {
    #     "folder": "rvc_models",
    #     "files": [
    #         {
    #             "url": "LINK_TO_YOUR_ALICE_PTH",
    #             "name": "alice.pth"
    #         }
    #     ]
    # }
}

def download_file(url, folder, filename):
    filepath = os.path.join(folder, filename)
    
    if os.path.exists(filepath):
        print(f"✅  File đã tồn tại: {filename}")
        return

    print(f"⬇️  Đang tải: {filename} ...")
    
    try:
        if not os.path.exists(folder):
            os.makedirs(folder)

        response = requests.get(url, stream=True)
        response.raise_for_status()
        
        total_size = int(response.headers.get('content-length', 0))
        block_size = 1024 # 1 Kibibyte
        
        with open(filepath, 'wb') as f:
            downloaded = 0
            for data in response.iter_content(block_size):
                downloaded += len(data)
                f.write(data)
                # Simple progress bar
                if total_size > 0:
                    percent = downloaded * 100 / total_size
                    sys.stdout.write(f"\r    [{int(percent)}%] {downloaded}/{total_size} bytes")
                    sys.stdout.flush()
        
        print(f"\n✅  Hoàn tất: {filename}")
        
    except Exception as e:
        print(f"\n❌  Lỗi khi tải {filename}: {e}")

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    
    print("🚀 Bắt đầu tải các model AI cần thiết...")
    print("----------------------------------------")

    for category, content in MODELS.items():
        folder_path = os.path.join(base_dir, content["folder"])
        print(f"\n📂 Kiểm tra thư mục: {content['folder']}")
        
        for file_info in content["files"]:
            download_file(file_info["url"], folder_path, file_info["name"])

    print("\n----------------------------------------")
    print("✨  Tất cả model đã sẵn sàng!")

if __name__ == "__main__":
    main()
