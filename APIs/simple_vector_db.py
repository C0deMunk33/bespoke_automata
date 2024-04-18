import os
import pickle
from sentence_transformers import SentenceTransformer, models, util
from scipy.spatial.distance import cosine
from scipy.spatial.distance import euclidean
import uuid
from datetime import datetime
from sklearn.feature_extraction.text import TfidfVectorizer
from collections import defaultdict
import numpy as np

class SimpleVectorDB:
    def __init__(self, db_path="./db", db_file="vector_db.pkl", indexes_file="indexes.pkl"):
        self.db_path = db_path
        self.db_file = os.path.join(db_path, db_file)
        self.indexes_file = os.path.join(db_path, indexes_file)
        self.create_db_directory()
        self.load_data()
        self.model = SentenceTransformer("multi-qa-MiniLM-L6-cos-v1")
        self.tfidf_vectorizer = TfidfVectorizer()
        self.inverted_index = defaultdict(list)

    def create_db_directory(self):
        if not os.path.exists(self.db_path):
            os.makedirs(self.db_path)

    def load_data(self):
        try:
            with open(self.db_file, "rb") as file:
                self.db = pickle.load(file)
        except FileNotFoundError:
            self.db = {}

        try:
            with open(self.indexes_file, "rb") as file:
                self.indexes = pickle.load(file)
        except FileNotFoundError:
            self.indexes = {"timestamp": []}

    def save_data(self):
        with open(self.db_file, "wb") as file:
            pickle.dump(self.db, file)
        with open(self.indexes_file, "wb") as file:
            pickle.dump(self.indexes, file)

    def load_from_file(self, db_file):
        db_file_path = os.path.join(self.db_path, db_file)
        try:
            with open(db_file_path, "rb") as file:
                self.db = pickle.load(file)
                self.db_file = db_file_path
        except FileNotFoundError:
            print(f"Database file '{db_file}' not found.")

    def create_collection(self, collection_name):
        print("Creating collection: ", collection_name)
        self.db[collection_name] = {}
        self.save_data()

    def remove_collection(self, collection_name):
        print("Removing collection: ", collection_name)
        del self.db[collection_name]
        self.save_data()

    def insert_into_collection(self, collection_name, title, text, vector, id=None, timestamp=None):
        #print("Inserting into collection: ", collection_name)
        if id is None:
            id = uuid.uuid4().hex
        if timestamp is None:
            timestamp = datetime.now()
        self.db[collection_name][id] = {
            'title': title,
            'text': text,
            'vector': vector,
            'id': id,
            'timestamp': timestamp
        }
        self.indexes["timestamp"].append(id)
        self.save_data()
        self.update_indexes(collection_name)

    def split_text_into_chunks(self, text, chunk_size=500, overlap=50):
        if chunk_size <= 0 or overlap < 0:
            raise ValueError("chunk_size must be positive and overlap must be non-negative")
        
        if chunk_size <= overlap:
            raise ValueError("chunk_size must be greater than overlap")
        
        chunks = []
        start = 0
        
        while start < len(text):
            end = min(start + chunk_size, len(text))
            chunks.append(text[start:end])
            start += chunk_size - overlap
        
        return chunks
    
    def insert_text_into_collection(self, collection_name, title, text, id=None, timestamp=None):
        chunks = self.split_text_into_chunks(text)
        for i, chunk in enumerate(chunks):
            vector = self.get_embedding(chunk)
            chunk_title = f"{title}_chunk_{i+1}"
            self.insert_into_collection(collection_name, chunk_title, chunk, vector, id, timestamp)

    def get_by_time_range(self, collection_name, start, end):
        results = []
        for id in self.indexes["timestamp"]:
            doc = self.db[collection_name].get(id)
            if doc['timestamp'] > start and doc['timestamp'] < end:
                results.append(doc)
        return results

    def delete_from_collection(self, collection_name, id):
        print("Deleting from collection: ", collection_name)
        del self.db[collection_name][id]
        self.save_data()
        self.update_indexes(collection_name)

    def get_by_id(self, collection_name, id):
        return self.db[collection_name].get(id)
    
    def get_by_title(self, collection_name, title):
        for doc in self.db[collection_name].values():
            if doc['title'] == title:
                return doc
        return None

    def get_embedding(self, text):
        return self.model.encode(text)

    def update_indexes(self, collection_name):
        docs = [doc['text'] for doc in self.db[collection_name].values()]
        self.tfidf_vectorizer.fit(docs)
        self.build_inverted_index(collection_name)

    def build_inverted_index(self, collection_name):
        self.inverted_index.clear()
        for doc in self.db[collection_name].values():
            tokens = doc['text'].lower().split()
            for token in set(tokens):
                self.inverted_index[token].append(doc['id'])

    def search(self, collection_name, query_text, top_n=1):
        query_tokens = query_text.lower().split()
        candidate_doc_ids = set()
        for token in query_tokens:
            candidate_doc_ids.update(self.inverted_index.get(token, []))

        candidate_docs = [self.db[collection_name][doc_id] for doc_id in candidate_doc_ids]

        query_embedding = self.get_embedding(query_text)
        query_tfidf = self.tfidf_vectorizer.transform([query_text]).toarray()[0]

        results = []
        for doc in candidate_docs:
            doc_tfidf = self.tfidf_vectorizer.transform([doc['text']]).toarray()[0]
            tfidf_similarity = np.dot(query_tfidf, doc_tfidf) / (np.linalg.norm(query_tfidf) * np.linalg.norm(doc_tfidf))
            semantic_similarity = self.get_cos_similarity(doc['vector'], query_embedding)
            combined_score = 0.5 * tfidf_similarity + 0.5 * semantic_similarity
            results.append((combined_score, doc))

        return sorted(results, reverse=True)[:top_n]

    def get_cos_similarity(self, v1, v2):
        return 1 - cosine(v1, v2)

    def get_euclidean_distance(self, v1, v2):
        return euclidean(v1, v2)

    def collection_exists(self, collection_name):
        return collection_name in self.db