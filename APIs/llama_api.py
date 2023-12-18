from flask import Flask, request, jsonify
import json
import re
app = Flask(__name__)
from sentence_transformers import SentenceTransformer
MODEL = 'sentence-transformers/all-MiniLM-L12-v2'
model = SentenceTransformer(MODEL)#.to('cuda:0')
# CORS
from flask_cors import CORS
CORS(app)


#*****************LLAMA*****************

from llama_cpp import Llama

def get_llama_chat_completion(messages, model_path, n_ctx, n_gpu_layers, chat_format):
    llm = Llama(model_path=model_path, n_ctx=n_ctx, n_gpu_layers=n_gpu_layers, chat_format=chat_format)
    
    return llm.create_chat_completion(messages=messages)

# /v1/chat/completions post endpoint
@app.route("/v1/chat/completions", methods=["POST"])
def chat_completions():
    data = request.json
    print("data")
    print(data)
    messages = data.get('messages')
    model_path = data.get('model')
    n_ctx = data.get('max_tokens')
   


    if messages is None:
        return jsonify({'error': 'No messages provided'}), 400

    if model_path is None:
        return jsonify({'error': 'No model_path provided'}), 400

    if n_ctx is None:
        return jsonify({'error': 'No n_ctx provided'}), 400

    
    out_text = get_llama_chat_completion(messages, model_path, n_ctx, 25, "chatml")
    print("out_text")
    print(out_text)
    return jsonify({'chat': out_text})

# lists all .gguf files in the model directory (default ../../models/text/)
@app.route("/models", methods=["GET"])
def models():
    import os
    import glob
    path = "../../models/text/"
    files = [f for f in glob.glob(path + "**/*.gguf", recursive=True)]
    return jsonify({'models': files})

#*****************END LLAMA*****************
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
