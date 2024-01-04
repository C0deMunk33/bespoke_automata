# flex 
# port: 5000
# cors: *
# /whisper takes in audio data and returns text
import whisper
from flask import Flask, request, jsonify
import flask_cors

app = Flask(__name__)
flask_cors.CORS(app)

class WhisperAPI:
    def __init__(self):
        self.model = whisper.load_model("base")

    def transcribe(self, audio):
        result = self.model.transcribe(audio)
        return result["text"]

whisper_api = WhisperAPI()

@app.route("/whisper", methods=["POST"])
def whisper():
    audio = request.files["audio"]
    text = whisper_api.transcribe(audio)
    return jsonify({"text": text})