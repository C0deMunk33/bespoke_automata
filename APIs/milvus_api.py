from flask import Flask, request, jsonify

from pymilvus import connections, FieldSchema, CollectionSchema, DataType, Collection, utility
app = Flask(__name__)
from sentence_transformers import SentenceTransformer
MODEL = 'sentence-transformers/all-MiniLM-L12-v2'
model = SentenceTransformer(MODEL)#.to('cuda:0')

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
def query_collection(vector, collection, top_k):
    search_params = {
        "metric_type": "L2", 
        "offset": 0, 
        "ignore_growing": False, 
        "params": {"nprobe": 10}
    }

    results = collection.search(vector, "tag_vector", search_params, top_k=top_k)
    return results


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

if __name__ == '__main__':
    text = "spanish inquisition"
    text_vectors = vectorize_text_batch([text], model)
    print(text_vectors)
    result = query_collection(text_vectors, get_collection('wiki'), 10)
    print(result)

    #app.run(debug=True)
