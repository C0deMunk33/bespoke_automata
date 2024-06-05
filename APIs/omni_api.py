from flask import Flask, request, jsonify, render_template_string, send_from_directory, abort
import flask_cors
import torch
import os
import glob
from itertools import cycle
import psutil
import io
import base64
from llama_cpp import Llama
from llama_cpp.llama import Llama, LlamaGrammar
from llama_cpp.llama_chat_format import Llava15ChatHandler
import whisper
import time
import soundfile as sf
from pydub import AudioSegment
from transformers import SpeechT5Processor, SpeechT5ForTextToSpeech, SpeechT5HifiGan
import uuid
import threading
from datasets import load_dataset
from keybert import KeyBERT
import pytesseract
from PIL import Image

from simple_vector_db import SimpleVectorDB

# flask app
app = Flask(__name__)
#use cors
flask_cors.CORS(app)

# enum for which model type is loaded, none, vision 
class ModelType:
    NONE = 0
    VISION = 1
    CHAT = 2
    
class OmniApi:
    def __init__(self):
        self.model_type_loaded = ModelType.NONE
        self.vision_llm = None
        self.chat_llm = None
        self.chat_handler = None
        self.clip_model_path = ""
        self.vision_model_path = ""
        self.chat_llm_path = ""
        self.svdb = SimpleVectorDB()
        self.whisper_model_path = None
        self.keyword_extractor_model = None

    def unload_model(self):
        self.vision_llm = None
        self.chat_llm = None
        self.model_type_loaded = ModelType.NONE
        
    def load_vision(self, clip_path, model_path):
        print("loading vision")
        if self.clip_model_path != clip_path or self.vision_model_path != model_path or self.model_type_loaded != ModelType.VISION:
            
            self.unload_model()
            # check if file exists
            if not os.path.isfile(clip_path):
                raise Exception(f"File does not exist: {clip_path}")
            
            if not os.path.isfile(model_path):
                raise Exception(f"File does not exist: {model_path}")

            self.vision_model_path = model_path
            self.clip_model_path = clip_path
            # load model
            # "../../models/vision/bakllava/mmproj-model-f16.gguf"
            
            self.chat_handler = Llava15ChatHandler(clip_model_path=clip_path)
            
            self.vision_llm = Llama(
                    # "../../models/vision/bakllava/ggml-model-q5_k.gguf"
                model_path= model_path,
                chat_handler=self.chat_handler,
                n_ctx=0, # n_ctx should be increased to accomodate the image embedding
                logits_all=True,# needed to make llava work
                n_gpu_layers=-1,
                chat_format="chatml"
            )
            self.model_type_loaded = ModelType.VISION

    def load_chat_model(self, model_path, n_ctx, n_gpu_layers, chat_format):
        
        if self.chat_llm_path != model_path or self.model_type_loaded != ModelType.CHAT:
            self.unload_model()
            self.chat_llm = Llama(model_path=model_path, n_ctx=n_ctx, n_gpu_layers=n_gpu_layers, chat_format=chat_format)
            self.chat_llm_path = model_path
            self.model_type_loaded = ModelType.CHAT

    def vision(self, system_prompt, user_prompt, image_url, grammar=None):
        print("~" * 100)
        print("starting vision")

        #create saved_images directory if it doesn't exist
        if not os.path.exists("saved_images"):
            os.makedirs("saved_images")

        # image_url is a base64 encoded imageurl, save it to a file
        temp_image_url = image_url.split(",")[1]
        temp_image = base64.b64decode(temp_image_url)
        with open("saved_images/image.jpg", "wb") as file:
            file.write(temp_image)
        

        result = self.vision_llm.create_chat_completion(
            grammar=grammar,
            #repeat_penalty=1.0,
            #max_tokens=100,
            #response_format={"type":"json_object"}",
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
        print("~" * 100)
        return jsonify(result)
        
    def chat(self, messages, grammar=None, temperature=None):
        try:
            result = None
            if temperature is not None:
                result = self.chat_llm.create_chat_completion(
                    messages=messages, 
                    grammar=grammar,
                    temperature=temperature
                    )
            else:
                result = self.chat_llm.create_chat_completion(
                    messages=messages, 
                    grammar=grammar
                    )
        except Exception as e:
            print("~" * 100)
            print("~" * 100)
            print("~" * 100)
            print("~" * 100)
            print("~" * 100)
            print(e)
            print("~" * 100)
            print("~" * 100)
            print("~" * 100)
            print("~" * 100)
            print("~" * 100)
            
            return jsonify({'error': str(e), 'chat': None})

    def load_whisper(self, model_path):
        self.whisper_model = whisper.load_model("large", "cuda", model_path, True)
        self.whisper_model_path = model_path

    def transcribe_with_whisper(self, audio):
        result = self.whisper_model.transcribe(audio)
        return result["text"]
    
    def save_audio_as_mp3(self, audio_bytes, filename):
        audio_bytes.seek(0)
        sound = AudioSegment.from_file(audio_bytes)
        mp3_filename = f"./saved_audio_files/{filename}-{int(time.time())}.mp3"
        sound.export(mp3_filename, format="mp3")
        return mp3_filename
    
    def load_tts_model(self, model_path):
        self.tts_processor = SpeechT5Processor.from_pretrained("microsoft/speecht5_tts")
        self.tts_model = SpeechT5ForTextToSpeech.from_pretrained("microsoft/speecht5_tts")
        self.tts_vocoder = SpeechT5HifiGan.from_pretrained("microsoft/speecht5_hifigan")
        self.tts_embeddings_dataset = load_dataset("Matthijs/cmu-arctic-xvectors", split="validation")

    def generate_audio_for_sentence(self, sentence):
        # Tokenize the input text
        inputs = self.tts_processor(text=sentence, return_tensors="pt")
        speaker_embeddings = torch.tensor(self.tts_embeddings_dataset[7306]["xvector"]).unsqueeze(0)
        # Generate speech using the model
        with torch.no_grad():
            speech = self.tts_model.generate_speech(inputs["input_ids"], speaker_embeddings, vocoder=self_tts_vocoder)
        return speech.numpy()
    
    def generate_audio_for_sentences(sentences, request_id):
        for sentence in sentences:
            print("creating audio for:")
            print(sentence)
            # strip leading and trailing spaces and other characters
            sentence = sentence.strip()

            audio_clip = self.generate_audio_for_sentence(sentence)
            buffer = BytesIO()
            sf.write(buffer, audio_clip, samplerate=16000, format="WAV")
            buffer.seek(0)
            audio_data = buffer.getvalue()
            pending_audio_clips[request_id].append(audio_data)

    def generate_audio_for_text(self, text):
        # Tokenize the input text
        inputs = self.tts_processor(text=text, return_tensors="pt")
        speaker_embeddings = torch.tensor(self.tts_embeddings_dataset[7306]["xvector"]).unsqueeze(0)
        # Generate speech using the model
        with torch.no_grad():
            speech = self.tts_model.generate_speech(inputs["input_ids"], speaker_embeddings, vocoder=self_tts_vocoder)
        audio_clip = speech.numpy()
        buffer = BytesIO()
        sf.write(buffer, audio_clip, samplerate=16000, format="WAV")
        buffer.seek(0)
        audio_data = buffer.getvalue()
        return audio_data

    def extract_keywords(self, text):
        if self.keyword_extractor_model is None:
            self.keyword_extractor_model = KeyBERT()
        
        keywords = self.keyword_extractor_model.extract_keywords(text)
        return keywords
    
    def ocr(self, base64_image):
        # base64_image is a base64 url encoded image
        # strip the url part
        base64_image = base64_image.split(",")[1]
        # decode the base64 image
        image = Image.open(io.BytesIO(base64.b64decode(base64_image)))
        return pytesseract.image_to_string(image)

Routes = {
    "vision": "/vision",
    "chat": "/v1/chat/completions",
    "models": "/models",
    "svdb_collections": "/collections",
    "svdb_create_collection": "/create_collection",
    "svdb_delete_collection": "/delete_collection",
    "svdb_add_document": "/add_document",
    "svdb_delete_document": "/delete_document",
    "svdb_get_document_by_id": "/get_document_by_id",
    "svdb_get_document_by_title": "/get_document_by_title",
    "svdb_get_similar_documents_by_cos": "/get_similar_documents_by_cos",
    "svdb_get_similar_documents_by_euclidean": "/get_similar_documents_by_euclidean",
    "svdb_collection_exists": "/collection_exists",
    "get_audio_file": "/audio/<filename>",
    "list_audio_files": "/list_audio",
    "whisper": "/whisper",
    "tts_stream": "/tts_stream",
    "tts": "/tts",
    "keyword_extraction": "/keyword_extraction",
    "ocr": "/ocr"
}

omni_api = OmniApi()

# set flask routes
@app.route(Routes["vision"], methods=['POST'])
def vision():
    print("request received")
    #print request keys
    print(request.json.keys())
    image_url = request.json['img_base64']
    system_prompt = request.json['system_prompt']
    user_prompt = request.json['user_prompt']        
    model_path = request.json['model_path']
    clip_path = request.json['clip_path']

    grammar_text = request.json['grammar']
    
    grammar = None
    if(grammar_text is not None and len(grammar_text) > 0):
        print("grammar_text")
        print(grammar_text)
        grammar = LlamaGrammar.from_string(grammar_text, verbose=True)

    try:
        omni_api.load_vision(clip_path, model_path)
        result = omni_api.vision(system_prompt, user_prompt, image_url, grammar)
        print(result)
        return result
    except Exception as e:
        print(e)
        return jsonify({'error': str(e)})

@app.route(Routes["ocr"], methods=['POST'])
def ocr():
    base64_image = request.json['img_base64']
    return jsonify({'text': omni_api.ocr(base64_image)})

@app.route(Routes["chat"], methods=['POST'])
def chat():
    data = request.json
    messages = data.get('messages')
    model_path = data.get('model')
    n_ctx = data.get('max_tokens')
    grammar_text = None
    try:
        grammar_text = data.get('grammar')
    except:
        pass
    grammar = None
    if(grammar_text is not None and len(grammar_text) > 0):
        print("grammar_text")
        print(grammar_text)
        grammar = LlamaGrammar.from_string(grammar_text, verbose=True)

    temperature = None
    try:
        temperature = data.get('temperature')
    except:
        pass

    if messages is None:
        return jsonify({'error': 'No messages provided'}), 400

    if model_path is None:
        return jsonify({'error': 'No model_path provided'}), 400

    if n_ctx is None:
        return jsonify({'error': 'No n_ctx provided'}), 400

    omni_api.load_chat_model(model_path, n_ctx, -1, "chatml")
    result = omni_api.chat(messages=messages, grammar=grammar, temperature=temperature)
    print("out_text")
    print(result)
    return result
    
@app.route(Routes["models"], methods=['GET'])
def models():
    chat_path = "../../models/text/"
    chat_files = [f for f in glob.glob(chat_path + "**/*.gguf", recursive=True)]
    vision_path = "../../models/vision/bakllava/"
    vision_files = [f for f in glob.glob(vision_path + "**/*.gguf", recursive=True)]
    return jsonify({
        'chat_models': chat_files
        ,'vision_models': vision_files
        })

@app.route(Routes["svdb_collections"], methods=['GET'])
def svdb_collections():
    return jsonify(omni_api.svdb.get_collections())

@app.route(Routes["svdb_create_collection"], methods=['POST'])
def svdb_create_collection():
    collection_name = request.json['collection_name']
    omni_api.svdb.create_collection(collection_name)
    return jsonify({'success': True})

@app.route(Routes["svdb_delete_collection"], methods=['POST'])
def svdb_delete_collection():
    collection_name = request.json['collection_name']
    omni_api.svdb.remove_collection(collection_name)
    return jsonify({'success': True})

@app.route(Routes["svdb_add_document"], methods=['POST'])
def svdb_add_document():
    print("Adding document")
    collection_name = request.json['collection_name']
    title = request.json['title']
    text = request.json['text']
    vector = omni_api.svdb.get_embedding(text)
    id = omni_api.svdb.insert_into_collection(collection_name, title, text, vector)
    return jsonify({'success': True, 'id': id})

@app.route(Routes["svdb_delete_document"], methods=['POST'])
def svdb_delete_document():
    collection_name = request.json['collection_name']
    id = request.json['id']
    omni_api.svdb.delete_from_collection(collection_name, id)
    return jsonify({'success': True})

@app.route(Routes["svdb_get_document_by_id"], methods=['POST'])
def svdb_get_document_by_id():
    collection_name = request.json['collection_name']
    id = request.json['id']
    return jsonify(omni_api.svdb.get_by_id(collection_name, id))

@app.route(Routes["svdb_get_document_by_title"], methods=['POST'])
def svdb_get_document_by_title():
    collection_name = request.json['collection_name']
    title = request.json['title']
    return jsonify(omni_api.svdb.get_by_title(collection_name, title))

@app.route(Routes["svdb_get_similar_documents_by_cos"], methods=['POST'])
def svdb_get_similar_documents_by_cos():
    collection_name = request.json['collection_name']
    id = request.json['id']
    return jsonify(omni_api.svdb.get_similar_documents_by_cos(collection_name, id))

@app.route(Routes["svdb_get_similar_documents_by_euclidean"], methods=['POST'])
def svdb_get_similar_documents_by_euclidean():
    collection_name = request.json['collection_name']
    input_text = request.json['text']
    text_embedding = omni_api.svdb.get_embedding(input_text)
    top_n = request.json['top_n']
    print("text_embedding")
    print(f"top_n: {top_n}")
    search = omni_api.svdb.vector_search_euclidean(collection_name, text_embedding, top_n)
    
    return jsonify(search)

@app.route(Routes["svdb_collection_exists"], methods=['POST'])
def svdb_collection_exists():
    collection_name = request.json['collection_name']
    collection_exists = omni_api.svdb.collection_exists(collection_name)
    print(f"collection_exists ({collection_name}) {collection_exists}")
    return jsonify(collection_exists)

@app.route(Routes["get_audio_file"], methods=['GET'])
def serve_audio(filename):
    directory = "./saved_audio_files"
    file_path = os.path.join(directory, filename + ".mp3")

    # Check if file exists
    if not os.path.isfile(file_path):
        abort(404)
    return send_from_directory(directory, filename + ".mp3")

@app.route(Routes["list_audio_files"], methods=['GET'])
def list_files():
    directory = "./saved_audio_files"
    files = [filename for filename in os.listdir(directory) if filename.endswith(".mp3")]
    return jsonify(files)

@app.route(Routes["whisper"], methods=['POST'])
def whisper_route():
    # Retrieve the file from the request
    audio_file = request.files["audio"]
    audio_bytes = BytesIO()
    audio_file.save(audio_bytes)
    audio_bytes.seek(0)
    # Save the audio file as an MP3
    filename = audio_file.filename.rsplit('.', 1)[0]
    filename = omni_api.save_audio_as_mp3(audio_bytes, filename)
    
    # Transcribe the audio
    text = omni_api.transcribe_with_whisper(filename)
    return jsonify({"transcription": text})

audio_clip_dir = "clips"
pending_audio_clips = {} 
@app.route(Routes["tts_stream"], methods=['POST'])
def tts_stream_route():
    data = request.json
    text = data.get('text')

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
    threading.Thread(target=omni_api.generate_audio_for_sentences, args=(sentences, request_id)).start()

    return jsonify({"request_id": request_id, "message": "Audio generation started"}), 200

@app.route(Routes["tts"], methods=['POST'])
def tts_route():
    data = request.json
    text = data.get('text')
    api_token = data.get('api_token')
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


    return jsonify({"audio": omni_api.generate_audio_for_text(text)}), 200

@app.route(Routes["keyword_extraction"], methods=['POST'])
def keyword_extraction():
    data = request.json
    text = data.get('text')
    keywords = omni_api.extract_keywords(text)
    return jsonify({"keywords": keywords}), 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)