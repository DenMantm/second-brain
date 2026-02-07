import onnxruntime as ort

print("Available providers:", ort.get_available_providers())

try:
    sess_opts = ort.SessionOptions()
    sess = ort.InferenceSession(
        "/mnt/c/Interesting/repos/second-brain/models/piper/en_US-lessac-medium.onnx",
        sess_opts,
        providers=["CUDAExecutionProvider", "CPUExecutionProvider"]
    )
    print("✅ GPU/CUDA provider working!")
    print("Active provider:", sess.get_providers())
except Exception as e:
    print("❌ Error:", e)
