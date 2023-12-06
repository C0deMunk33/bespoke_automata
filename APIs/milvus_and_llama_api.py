from flask import Flask, request, jsonify
import json
import re
from pymilvus import connections, FieldSchema, CollectionSchema, DataType, Collection, utility
app = Flask(__name__)
from sentence_transformers import SentenceTransformer
MODEL = 'sentence-transformers/all-MiniLM-L12-v2'
model = SentenceTransformer(MODEL)#.to('cuda:0')
# CORS
from flask_cors import CORS
CORS(app)

connections.connect(host='192.168.0.8', port='19530')

def vectorize_text_batch(text_batch, model):
    vectors = model.encode(text_batch, convert_to_tensor=True)
    return vectors.tolist()

def create_collection(collection_name):
    if utility.has_collection('wiki'):
        utility.drop_collection('wiki')
    
    fields = [
        FieldSchema(name="id", dtype=DataType.INT64, is_primary=True, auto_id=True),
        FieldSchema(name="tag", dtype=DataType.VARCHAR, max_length=1024),
        FieldSchema(name="tag_vector", dtype=DataType.FLOAT_VECTOR, dim=384),
        FieldSchema(name="text_body", dtype=DataType.VARCHAR, max_length=65535)
    ]
    schema = CollectionSchema(fields=fields, description='search text')
    collection = Collection(name='wiki', schema=schema)
    
    index_params = {
        'metric_type': "L2",
        'index_type': "IVF_FLAT",
        'params': {"nlist": 2048}
    }
    collection.create_index(field_name='tag_vector', index_params=index_params)
    return collection

def insert_into_collection(collection, batch):
    collection.insert(batch)
    collection.flush()
    return collection

def get_collection(collection_name):
    if not utility.has_collection(collection_name):
        return create_collection(collection_name)
    return Collection(collection_name)

# query_collection takes in a vector, a collection, and a top_k value
# and returns the top_k most similar vectors to the input vector
def query_collection(vector, collection, top_k, vector_field_name='tag_vector'):
    search_params = {
        "metric_type": "L2", 
        "offset": 0, 
        "ignore_growing": False, 
        "params": {"nprobe": 10}
    }

    results = collection.search(vector, vector_field_name, search_params, top_k)
    return results

def query_wiki(query_vector, top_k):
    collection = get_collection('wiki')
    results = query_collection(query_vector, collection, top_k, "title_vector")
    return results

def get_wiki_descriptions(text, top_k):   

    text_vectors = vectorize_text_batch([text], model)
    result = query_wiki(text_vectors, top_k)
    collection = get_collection('wiki')
    url_pattern = r'(http[s]?://|www\.)\S+'
    out_text = ""
    # iterate over results
    for res in result[0]:
        item = collection.query(
            expr=f'id in {[res.id]}',
            output_fields=['title', 'body',"redirect_title", "description"]
        )[0]
        if(item['redirect_title'] != ""):
            item = collection.query(
                expr=f'title in {[item["redirect_title"]]}',
                output_fields=['title', 'body',"redirect_title", "description"]
            )[0]

        description_text = item["description"]
        # remove [] and '' as well as *
        description_text = description_text.replace("[", "")
        description_text = description_text.replace("]", "")
        description_text = description_text.replace("{", "")
        description_text = description_text.replace("}", "")
        # &lt
        description_text = description_text.replace("&lt;/small", "")
        description_text = description_text.replace("&lt;/", "")
        description_text = description_text.replace("&lt;", "")
        # &gt
        description_text = description_text.replace("&gt;/small", "")
        description_text = description_text.replace("small&gt;", "")
        description_text = description_text.replace("&gt;", "")
        description_text = description_text.replace("'", "")
        description_text = description_text.replace("**", "")
        description_text = description_text.replace("==", "")
        # |
        description_text = description_text.replace("|", "")
        # &quot;
        description_text = description_text.replace("&quot;", "\"")
        # url=
        description_text = description_text.replace("url=", "")
        # remove web links, use regex
        description_text = re.sub(url_pattern, '', description_text)
        
        out_text += description_text
    return out_text

@app.route('/create_collection', methods=['POST'])
def create_collection():
    data = request.json
    collection_name = data.get('collection_name')
    collection = get_collection(collection_name)
    return jsonify({'collection_name': collection_name})


@app.route('/tokenize_batch', methods=['POST'])
def tokenize_batch():        
    data = request.json
    texts = data.get('text_batch')

    if texts is None:
        return jsonify({'error': 'No texts provided'}), 400

    tokens = vectorize_text_batch(texts, model)

    return jsonify({'tokens': tokens})


@app.route("/wiki", methods=["POST"])
def wiki():
    data = request.json
    text = data.get('query')
    top_k = data.get('top_k', 10)

    if text is None:
        return jsonify({'error': 'No text provided'}), 400

    out_text = get_wiki_descriptions(text, top_k)
    # return as concatenated string
    return jsonify({'wiki': out_text.join("/n")})

# get that does wiki search from url param
@app.route("/wiki/<text>", methods=["GET"])
def wiki_get(text):
    query_text = text.replace("+", " ")
    top_k = 10
    out_text = get_wiki_descriptions(query_text, top_k)
    # return as concatenated string
    return jsonify({'wiki': out_text.join("/n")})

#*****************LLAMA*****************

from llama_cpp import Llama

def get_llama_chat_completion(messages, model_path, n_ctx, n_gpu_layers, chat_format):
    llm = Llama(model_path=model_path, n_ctx=n_ctx, n_gpu_layers=n_gpu_layers, chat_format=chat_format)
    llm.create_chat_completion(messages=messages)
    return llm.get_chat_completion()

# /v1/chat/completions post endpoint
@app.route("/v1/chat/completions", methods=["POST"])
def chat_completions():
    data = request.json
    print("data")
    print(data)
    messages = data.get('messages')
    model_path = data.get('model')
    n_ctx = data.get('max_tokens')
   


    if messages is None:
        return jsonify({'error': 'No messages provided'}), 400

    if model_path is None:
        return jsonify({'error': 'No model_path provided'}), 400

    if n_ctx is None:
        return jsonify({'error': 'No n_ctx provided'}), 400

    
    out_text = get_llama_chat_completion(messages, model_path, n_ctx, 100, "chatml")
    print("out_text")
    print(out_text)
    return jsonify({'chat': out_text})


#*****************END LLAMA*****************
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
