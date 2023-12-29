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

def load_models(model_path, instances=6, model_ram_size=6, loras=None, grammars=None):
    global gpu_model_instances, ram_model_instances, gpu_model_cycle, ram_model_cycle


    gpu_model_instances = []
    ram_model_instances = []
    gpu_model_cycle = None
    ram_model_cycle = None

    total_vram = get_total_cuda_vram()
    available_ram = get_available_system_ram()

    print("##########################################")
    print("Loading models...")
    print("model_path: ", model_path)
    print("Total VRAM: ", total_vram)
    print("Available RAM: ", available_ram)
    print("##########################################")
    
    gpu_models_count = int(total_vram // model_ram_size)
    ram_models_count = int(available_ram // model_ram_size)

    to_load_gpu = min(gpu_models_count, instances)
    to_load_ram = min(ram_models_count, instances - to_load_gpu)

    for _ in range(to_load_gpu):
        gpu_model_instances.append(Llama(model_path=model_path, n_ctx=10000, n_gpu_layers=100, chat_format="chatml"))

    for _ in range(to_load_ram):
        ram_model_instances.append(Llama(model_path=model_path, n_ctx=10000, n_gpu_layers=0, chat_format="chatml"))

    gpu_model_cycle = cycle(gpu_model_instances) if gpu_model_instances else None
    ram_model_cycle = cycle(ram_model_instances)
    print("##########################################")
    print("Loaded models:")
    print("model_path: ", model_path)
    print("Total VRAM: ", total_vram)
    print("Available RAM: ", available_ram)
    print("GPU models: ", to_load_gpu)
    print("RAM models: ", to_load_ram)
    print("##########################################")

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
    instances = data.get('instances')

    if instances is None:
        instances = 6
    else:
        instances = int(instances)

    if model_path is None:
        return jsonify({'error': 'No model_path provided'}), 400
    load_models(model_path, instances)
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
