import numpy as np
import soundfile as sf
from io import BytesIO
import os
from pydub import AudioSegment
from flask import Flask, request, jsonify, send_from_directory, abort

import flask_cors
import whisper

app = Flask(__name__)
flask_cors.CORS(app)

class WhisperAPI:
    def __init__(self):
        self.model = whisper.load_model("large", "cuda", "../../models/whisper/", True)

    def transcribe(self, audio):
        result = self.model.transcribe(audio)
        return result["text"]

whisper_api = WhisperAPI()

def save_audio_as_mp3(audio_bytes, filename):
    audio_bytes.seek(0)
    sound = AudioSegment.from_file(audio_bytes)
    mp3_filename = f"./saved_audio_files/{filename}.mp3"
    sound.export(mp3_filename, format="mp3")

@app.route("/audio/<filename>", methods=["GET"])
def serve_audio(filename):
    directory = "./saved_audio_files"
    file_path = os.path.join(directory, filename + ".mp3")

    # Check if file exists
    if not os.path.isfile(file_path):
        abort(404)  # File not found

    return send_from_directory(directory, filename + ".mp3")

@app.route("/list_audio", methods=["GET"])
def list_files():
    directory = "./saved_audio_files"
    files = [filename for filename in os.listdir(directory) if filename.endswith(".mp3")]
    return jsonify(files)


@app.route("/whisper", methods=["POST"])
def whisper_route():
    # Retrieve the file from the request
    audio_file = request.files["audio"]
    audio_bytes = BytesIO()
    audio_file.save(audio_bytes)
    audio_bytes.seek(0)
    # Save the audio file as an MP3
    filename = audio_file.filename.rsplit('.', 1)[0]
    save_audio_as_mp3(audio_bytes, filename)
    audio_bytes.seek(0)
    # Convert the file to a BytesIO object for transcription
    

    # Load the audio file as a NumPy array
    data, samplerate = sf.read(audio_bytes)

    # Ensure the data is of the correct dtype (e.g., float32)
    data = data.astype(np.float32)

    # Transcribe the audio
    text = whisper_api.transcribe(data)

    # Return the transcription
    return jsonify({"text": text})

# serve whisper_api_ui.html
@app.route("/", methods=["GET"])
def serve_static():
    return app.send_static_file("whisper_api_ui.html")

if __name__ == "__main__":
    if not os.path.exists('./saved_audio_files'):
        os.makedirs('./saved_audio_files')
    app.run(host="0.0.0.0", port=5123, ssl_context='adhoc')
