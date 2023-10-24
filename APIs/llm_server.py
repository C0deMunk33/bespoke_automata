from flask import Flask, request, jsonify
from transformers import (
    AutoModelForCausalLM, 
    AutoTokenizer,
    pipeline
)
import os
import deepspeed

app = Flask(__name__)

# Default model path
model_path = "../../models/Mistral-7B-Instruct"

model = AutoModelForCausalLM.from_pretrained(model_path).to('cuda')
tokenizer = AutoTokenizer.from_pretrained(model_path)


generator = pipeline(
    "text-generation",
    model=model,
    tokenizer=tokenizer,
    device=0,  # set to the correct device
    deepspeed="ds_config.json"  # path to the deepspeed config
)

@app.route('/generate', methods=['POST'])
def generate_text():
    input_text = request.json.get('input_text')
    temperature = request.json.get('temperature', 1.0)
    max_length = request.json.get('max_length', 100)
    
    if not input_text:
        return jsonify({'error': 'No input text provided'}), 400
    
    generated_text = generator(
        input_text,
        max_length=max_length,
        do_sample=True,
        temperature=temperature
    )[0]['generated_text']
    
    return jsonify({'generated_text': generated_text})

def get_text(prompt):
    return generator(prompt, max_length=100, do_sample=True, temperature=1.0)[0]['generated_text']

get_text("Hello, my name is")

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)