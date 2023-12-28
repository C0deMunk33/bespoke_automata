from flask import Flask, request, jsonify, render_template_string
import json
import re
from sentence_transformers import SentenceTransformer
from llama_cpp import Llama
from itertools import cycle
import os
import glob

# Initialize Flask and CORS
app = Flask(__name__)
from flask_cors import CORS
CORS(app)

# Model Initialization
MODEL = 'sentence-transformers/all-MiniLM-L12-v2'
sentence_model = SentenceTransformer(MODEL)

# Load Model Instances
model_instances = []
model_cycle = None

def load_models(model_path, n_instances=4):
    global model_instances
    global model_cycle
    print(f"Loading model {model_path}" )
    model_instances = [Llama(model_path=model_path, n_ctx=512, n_gpu_layers=25, chat_format="chatml") for _ in range(n_instances)]
    model_cycle = cycle(model_instances)
    print(f"Loaded {len(model_instances)} instances of {model_path}")

# Round-robin model serving
def get_round_robin_model():
    global model_cycle
    return next(model_cycle)

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

    model = get_round_robin_model()
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
