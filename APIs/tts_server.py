from flask import Flask, request, Response, jsonify
from flask_cors import CORS
from transformers import SpeechT5Processor, SpeechT5ForTextToSpeech, SpeechT5HifiGan, SpeechT5ForConditionalGeneration
import torch
import soundfile as sf
from io import BytesIO
import os
import time
import re
import uuid
import threading
from datasets import load_dataset


app = Flask(__name__)
CORS(app, origins="*")

# Load the SpeechT5 model and processor
processor = SpeechT5Processor.from_pretrained("microsoft/speecht5_tts")
model = SpeechT5ForTextToSpeech.from_pretrained("microsoft/speecht5_tts")
vocoder = SpeechT5HifiGan.from_pretrained("microsoft/speecht5_hifigan")

# Load the SpeechT5 model and processor for STT
stt_processor = SpeechT5Processor.from_pretrained("google/speech_t5_base_s2t")
stt_model = SpeechT5ForConditionalGeneration.from_pretrained("google/speech_t5_base_s2t")


#/cmu_us_bdl_arctic-wav-arctic_a0009
#/cmu_us_clb_arctic-wav-arctic_a0144
#/cmu_us_ksp_arctic-wav-arctic_b0087
#/cmu_us_rms_arctic-wav-arctic_b0353
#/cmu_us_slt_arctic-wav-arctic_a0508

embeddings_dataset = load_dataset("Matthijs/cmu-arctic-xvectors", split="validation")

audio_clip_dir = "clips"
pending_audio_clips = {}  # Dictionary to store audio clips by request ID

def generate_audio_for_sentence(sentence):
    # Tokenize the input text
    inputs = processor(text=sentence, return_tensors="pt")
    speaker_embeddings = torch.tensor(embeddings_dataset[7306]["xvector"]).unsqueeze(0)
    # Generate speech using the model
    with torch.no_grad():
        speech = model.generate_speech(inputs["input_ids"], speaker_embeddings, vocoder=vocoder)
    return speech.numpy()

@app.route('/text-to-wav', methods=['POST'])
def text_to_wav():
    data = request.json
    text = data.get('text')
    api_token = data.get('api_token')  # Not used in this example, but can be used for authentication

    print("Incoming call")
    print(text)
    
    text = text.replace("\r", " ")
    text = text.replace("\n", " ")
    text = text.replace("\\n", " ")
    text = text.replace("\\r", " ")
    text = text.replace("...", " ")
    text = text.replace("-", " ")

    # pull out all emotes, they start and end with *, remove them from the text
    emotes = re.findall(r'\*(.*?)\*', text)
    text = re.sub(r'\*(.*?)\*', '', text)

    # TODO: add emotes to the audio prompt

    # split text into sentences
    sentences = re.split('[?!\.]', text)

    request_id = str(uuid.uuid4())  # Generate a unique ID for this request
    pending_audio_clips[request_id] = []

    # Start a new thread to process the audio generation
    threading.Thread(target=generate_audio_for_text, args=(sentences, request_id)).start()

    return jsonify({"request_id": request_id, "message": "Audio generation started"}), 200

@app.route('/transcribe', methods=['POST'])
def transcribe():
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
    
    audio_file = BytesIO()
    file.save(audio_file)
    audio_file.seek(0)
    audio, sr = sf.read(audio_file)

    # Ensure the audio is single-channel and has the correct sample rate
    if len(audio.shape) > 1:
        audio = audio[:, 0]
    if sr != 16000:
        audio = librosa.resample(audio, sr, 16000)
    
    inputs = stt_processor(audio, sampling_rate=16000, return_tensors="pt")
    with torch.no_grad():
        translated = stt_model.generate(**inputs)
    text = stt_processor.decode(translated[0])
    
    return jsonify({"transcription": text}), 200


def generate_audio_for_text(sentences, request_id):
    for sentence in sentences:
        print("creating audio for:")
        print(sentence)
        # strip leading and trailing spaces and other characters
        sentence = sentence.strip()

        audio_clip = generate_audio_for_sentence(sentence)
        buffer = BytesIO()
        sf.write(buffer, audio_clip, samplerate=16000, format="WAV")
        buffer.seek(0)
        audio_data = buffer.getvalue()
        pending_audio_clips[request_id].append(audio_data)

@app.route('/get-audio/<request_id>', methods=['GET'])
def get_audio(request_id):
    if request_id in pending_audio_clips:
        clips = pending_audio_clips[request_id]
        if clips:
            return Response(clips.pop(0), content_type='audio/wav')
        else:
            return jsonify({"message": "No new audio clips yet"}), 202
    else:
        return jsonify({"message": "Invalid request ID"}), 404

if __name__ == '__main__':
    app.run(host='0.0.0.0', debug=True, port=2702)
