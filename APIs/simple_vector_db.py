
from sentence_transformers import SentenceTransformer, models, util
from scipy.spatial.distance import cosine
from scipy.spatial.distance import euclidean
import pickle

class SimpleVectorDB:
    def __init__(self):
        self.db = {}
        self.model = SentenceTransformer("multi-qa-MiniLM-L6-cos-v1")

    def save_to_disk(self, path):
        with open(path, 'wb') as f:
            pickle.dump(self.db, f)

    def load_from_disk(self, path):
        with open(path, 'rb') as f:
            self.db = pickle.load(f)

    def create_collection(self, collection_name):
        self.db[collection_name] = {}

    def remove_collection(self, collection_name):
        del self.db[collection_name]

    def insert_into_collection(self, collection_name, title, text, vector, id):
        self.db[collection_name][id] = {'title': title, 'text': text, 'vector': vector}

    def delete_from_collection(self, collection_name, id):
        del self.db[collection_name][id]

    def get_by_id(self, collection_name, id):
        return self.db[collection_name].get(id)

    def get_by_title(self, collection_name, title):
        for doc in self.db[collection_name].values():
            if doc['title'] == title:
                return doc
        return None
    
    def get_embedding(self, text):
        return self.model.encode(text)

    def vector_search_cos(self, collection_name, vector, top_n=1):
        results = []
        for id, doc in self.db[collection_name].items():
            score = self.get_cos_simmilarity(doc['vector'], vector)
            results.append((score, doc))

        return sorted(results, key=lambda x: x[0], reverse=True)[:top_n]

    def vector_search_euclidean(self, collection_name, vector, top_n=1):
        results = []
        for id, doc in self.db[collection_name].items():
            score = self.get_euclidean_distance(doc['vector'], vector)
            results.append((score, doc))

        return sorted(results, key=lambda x: x[0], reverse=False)[:top_n]
    
    def get_cos_simmilarity(v1, v2):
        return 1 - cosine(v1, v2)
    
    def get_euclidean_distance(v1, v2):
        return euclidean(v1, v2)
    
    def collection_exists(self, collection_name):
        return collection_name in self.db