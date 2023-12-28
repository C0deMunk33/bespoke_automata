from flask import Flask, request, jsonify, render_template_string
import torch
import os
import glob
from llama_cpp import Llama
from itertools import cycle
import psutil

# Initialize Flask and CORS
app = Flask(__name__)
from flask_cors import CORS
CORS(app)

# Model Initialization
MODEL = 'sentence-transformers/all-MiniLM-L12-v2'
sentence_model = SentenceTransformer(MODEL)


# Global variables
gpu_model_instances = []
ram_model_instances = []
gpu_model_cycle = None
ram_model_cycle = None


def get_total_cuda_vram():
    total_vram = 0
    if torch.cuda.is_available():
        for i in range(torch.cuda.device_count()):
            total_vram += torch.cuda.get_device_properties(i).total_memory / (1024 ** 3)  # Convert to GB
    return total_vram

def get_available_system_ram():
    return psutil.virtual_memory().available / (1024 ** 3)  # Convert to GB

def load_models(model_path, model_ram_size=6):
    global gpu_model_instances, ram_model_instances, gpu_model_cycle, ram_model_cycle

    total_vram = get_total_cuda_vram()
    available_ram = get_available_system_ram()

    gpu_models_count = int(total_vram // model_ram_size)
    ram_models_count = int(available_ram // model_ram_size)

    for _ in range(gpu_models_count):
        gpu_model_instances.append(Llama(model_path=model_path, n_ctx=512, n_gpu_layers=100, chat_format="chatml"))

    for _ in range(ram_models_count):
        ram_model_instances.append(Llama(model_path=model_path, n_ctx=512, n_gpu_layers=0, chat_format="chatml"))

    gpu_model_cycle = cycle(gpu_model_instances) if gpu_model_instances else None
    ram_model_cycle = cycle(ram_model_instances)

def get_next_model():
    try:
        # Try to get next GPU model
        return next(gpu_model_cycle)
    except (StopIteration, TypeError):
        # If no GPU model is available, fallback to RAM model
        return next(ram_model_cycle)



##################### ENDPOINTS #####################

# Load Model Endpoint
@app.route("/load_model", methods=["POST"])
def load_model():
    data = request.json
    model_path = data.get('model_path')
    if model_path is None:
        return jsonify({'error': 'No model_path provided'}), 400
    load_models(model_path)
    return jsonify({'message': 'Models loaded successfully'}), 200

# Chat Completions Endpoint
@app.route("/v1/chat/completions", methods=["POST"])
def chat_completions():
    print("chat_completions")
    data = request.json
    messages = data.get('messages')
    n_ctx = data.get('max_tokens')

    if messages is None or n_ctx is None:
        return jsonify({'error': 'Required parameters are missing'}), 400

    model = get_next_model()
    out_text = model.create_chat_completion(messages=messages)
    return jsonify({'chat': out_text})

# Models Listing Endpoint
@app.route("/models", methods=["GET"])
def models():
    path = "../../models/text/"
    files = [f for f in glob.glob(path + "**/*.gguf", recursive=True)]
    return jsonify({'models': files})

# Serve HTML Page
@app.route("/")
def index():
    # ./llama_multi_api_ui.html
    with open('./llama_multi_api_ui.html', 'r') as f:
        html = f.read()
    return html




# Main Function
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
