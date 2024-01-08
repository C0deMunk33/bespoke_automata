# flex 
# port: 5000
# cors: *
# /whisper takes in audio data and returns text
import whisper
from flask import Flask, request, jsonify
import flask_cors

import numpy as np
import soundfile as sf
from io import BytesIO



app = Flask(__name__)
flask_cors.CORS(app)

class WhisperAPI:
    def __init__(self):
        self.model = whisper.load_model("medium.en", "cuda", "../../models/whisper/", True)

    def transcribe(self, audio):
        result = self.model.transcribe(audio)
        return result["text"]

whisper_api = WhisperAPI()

@app.route("/whisper", methods=["POST"])
def whisper_route():
    # Retrieve the file from the request
    audio_file = request.files["audio"]

    # Convert the file to a BytesIO object
    audio_bytes = BytesIO()
    audio_file.save(audio_bytes)
    audio_bytes.seek(0)

    # Load the audio file as a NumPy array
    data, samplerate = sf.read(audio_bytes)

    # Transcribe the audio
    text = whisper_api.transcribe(data)

    # Return the transcription
    return jsonify({"text": text})

# serve ./whisper_api_ui.html
@app.route("/")
def index():
    return app.send_static_file("whisper_api_ui.html")

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5123, ssl_context='adhoc')
