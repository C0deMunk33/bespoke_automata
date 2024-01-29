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


@app.route('/vision', methods=['POST'])
def vision():
    if request.method == 'POST':
        print("request received")
        #print request keys
        print(request.json.keys())
        image_url = request.json['img_base64']
        system_prompt = request.json['system_prompt']
        user_prompt = request.json['user_prompt']        
        
        result = llm.create_chat_completion(
            messages = [
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": [
                        {"type": "image_url", "image_url": {"url": image_url}},
                        {"type" : "text", "text": user_prompt}
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