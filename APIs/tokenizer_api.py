from flask import Flask, request, jsonify
import minillm

app = Flask(__name__)

@app.route('/tokenize', methods=['POST'])
def tokenize():
    data = request.json
    text = data.get('text')

    if text is None:
        return jsonify({'error': 'No text provided'}), 400

    llm, llm_config = minillm.load_llm('llama-7b-4bit', '/path/to/llama-7b-4bit.pt')
    tokens = minillm.tokenize(llm_config, text)

    return jsonify({'tokens': tokens})

if __name__ == '__main__':
    app.run(debug=True)
