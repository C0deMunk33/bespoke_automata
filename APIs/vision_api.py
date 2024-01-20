from flask import Flask, request, jsonify, render_template_string
import flask_cors
import torch
import os
import glob
from llama_cpp import Llama
from itertools import cycle
import psutil
import io
import base64

from llama_cpp import Llama
from llama_cpp.llama_chat_format import Llava15ChatHandler
chat_handler = Llava15ChatHandler(clip_model_path="../../models/vision/bakllava/mmproj-model-f16.gguf")
llm = Llama(
  model_path="../../models/vision/bakllava/ggml-model-q5_k.gguf",
  chat_handler=chat_handler,
  n_ctx=4096, # n_ctx should be increased to accomodate the image embedding
  logits_all=True,# needed to make llava work
)

# flask app
app = Flask(__name__)
#use cors
flask_cors.CORS(app)


@app.route('/api/vision', methods=['POST'])
def vision():
    if request.method == 'POST':
        # get image from request
        image = request.files['file']
        
        in_memory_file = io.BytesIO()
        image.save(in_memory_file)
        data = base64.b64encode(in_memory_file.getvalue()).decode('utf-8')
        image_url = f"data:image/jpeg;base64,{data}"
        
        
        
        result = llm.create_chat_completion(
            messages = [
                {"role": "system", "content": "You are an assistant who perfectly describes images."},
                {
                    "role": "user",
                    "content": [
                        {"type": "image_url", "image_url": {"url": image_url}},
                        {"type" : "text", "text": "Describe this image in detail please."}
                    ]
                }
            ]
        )
        print(result)
        return jsonify(result)                   
    
# serve vision_ui.html as static file
@app.route('/')
def index():
    return app.send_static_file('vision_ui.html')

# main
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=6969, debug=True)