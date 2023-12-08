# flask server for serving the simple vector database
from flask import Flask, request, jsonify
from flask_cors import CORS
from simple_vector_db import SimpleVectorDB

# create the flask app
app = Flask(__name__)
CORS(app)

# create the database
db = SimpleVectorDB()

# create the routes
# get all collections
@app.route('/collections', methods=['POST'])
def get_collections():
    return jsonify(db.get_collections())

# create a collection
@app.route('/create_collection', methods=['POST'])
def create_collection():
    collection_name = request.json['collection_name']
    db.create_collection(collection_name)
    return jsonify({'success': True})

# delete a collection
@app.route('/delete_collection', methods=['POST'])
def delete_collection():
    collection_name = request.json['collection_name']
    db.remove_collection(collection_name)
    return jsonify({'success': True})

# insert a document into a collection
@app.route('/add_document', methods=['POST'])
def insert_document():
    collection_name = request.json['collection_name']
    title = request.json['title']
    text = request.json['text']
    vector = db.get_embedding(text)
    id = db.insert_into_collection(collection_name, title, text, vector)
    return jsonify({'success': True, 'id': id})

# delete a document from a collection
@app.route('/delete_document', methods=['POST'])
def delete_document():
    collection_name = request.json['collection_name']
    id = request.json['id']
    db.delete_from_collection(collection_name, id)
    return jsonify({'success': True})

# get a document by id
@app.route('/get_document_by_id', methods=['POST'])
def get_document_by_id(collection_name, id):
    return jsonify(db.get_by_id(collection_name, id))

# get a document by title
@app.route('/get_document_by_title', methods=['POST'])
def get_document_by_title(collection_name, title):
    return jsonify(db.get_by_title(collection_name, title))

# get similar documents by cosine similarity
@app.route('/get_similar_documents_by_cos', methods=['POST'])
def get_similar_documents_by_cos():
    text1 = request.args.get('text')
    top_n = int(request.args.get('top_n', 1))
    vector = db.get_embedding(text1)
    collection_name = request.args.get('collection_name')
    results = db.vector_search_cos(collection_name, vector, top_n)
    return jsonify(results)

# get similar documents by euclidean distance
@app.route('/get_similar_documents_by_euclidean', methods=['POST'])
def get_similar_documents_by_euclidean():
    text1 = request.args.get('text')
    top_n = int(request.args.get('top_n', 1))
    vector = db.get_embedding(text1)
    collection_name = request.args.get('collection_name')
    results = db.vector_search_euclidean(collection_name, vector, top_n)
    return jsonify(results)

# collection exists
@app.route('/collection_exists', methods=['POST'])
def collection_exists():
    collection_name = request.args.get('collection_name')
    return jsonify({'exists': db.collection_exists(collection_name)})

# run the app
if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
    