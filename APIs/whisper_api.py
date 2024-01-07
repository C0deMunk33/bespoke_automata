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
        self.model = whisper.load_model("medium.en", "cuda", "../../models/whisper/", True)

    def transcribe(self, audio):
        result = self.model.transcribe(audio)
        return result["text"]

whisper_api = WhisperAPI()

@app.route("/whisper", methods=["POST"])
def whisper():
    audio = request.files["audio"]
    text = whisper_api.transcribe(audio)
    return jsonify({"text": text})

# serve ./whisper_api_ui.html
@app.route("/")
def index():
    return app.send_static_file("whisper_api_ui.html")

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5123)
