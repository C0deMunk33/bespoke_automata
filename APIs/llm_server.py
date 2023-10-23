from flask import Flask, request, jsonify
from transformers import AutoModelForCausalLM, AutoTokenizer
import os

app = Flask(__name__)

# Default model path
model_path = os.path.join(os.getcwd(), 'mistral_model')
model = AutoModelForCausalLM.from_pretrained(model_path)
tokenizer = AutoTokenizer.from_pretrained(model_path)

@app.route('/load_model', methods=['POST'])
def load_model():
    global model, tokenizer  # Declare model and tokenizer as global to update them
    model_name = request.json.get('model_name', model_path)  # Default to current model_path if not provided
    new_model_path = os.path.join(os.getcwd(), model_name)
    
    # Load new model and tokenizer
    model = AutoModelForCausalLM.from_pretrained(new_model_path)
    tokenizer = AutoTokenizer.from_pretrained(new_model_path)
    
    return jsonify({'message': f'Model loaded from {new_model_path}'})

@app.route('/generate', methods=['POST'])
def generate_text():
    # Get the text input and optional LLM parameters from the request
    input_text = request.json.get('input_text')
    temperature = request.json.get('temperature', 1.0)  # Default temperature is 1.0
    max_length = request.json.get('max_length', 100)  # Default max_length is 100
    
    # Check if text is provided
    if not input_text:
        return jsonify({'error': 'No input text provided'}), 400
    
    # Prepare the text input for the model
    model_inputs = tokenizer([input_text], return_tensors="pt")
    
    # Generate a response with optional LLM parameters
    generated_ids = model.generate(
        **model_inputs, 
        max_length=max_length, 
        temperature=temperature, 
        do_sample=True
    )
    generated_text = tokenizer.batch_decode(generated_ids)[0]
    
    return jsonify({'generated_text': generated_text})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
