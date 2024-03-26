
import time
import random
import string
from simple_vector_db import SimpleVectorDB

def test_simple_vector_db():
    # Create an instance of SimpleVectorDB
    db = SimpleVectorDB(db_path="./test_db")

    # Create a new collection
    collection_name = "test_collection"
    db.create_collection(collection_name)

    # Insert documents into the collection
    docs = [
        {"title": "Natural Language Processing", "text": "NLP is a field of computer science and artificial intelligence concerned with the interactions between computers and human language."},
        {"title": "Machine Learning", "text": "Machine learning is a branch of artificial intelligence that focuses on the development of algorithms and models that can learn from data and make predictions or decisions."},
        {"title": "Deep Learning", "text": "Deep learning is a subset of machine learning that uses artificial neural networks with multiple layers to learn hierarchical representations of data."},
        {"title": "Computer Vision", "text": "Computer vision is a field of artificial intelligence that focuses on enabling computers to interpret and understand visual information from the world."},
        {"title": "Data Science", "text": "Data science is an interdisciplinary field that combines scientific methods, processes, algorithms, and systems to extract knowledge and insights from structured and unstructured data."}
    ]

    for doc in docs:
        vector = db.get_embedding(doc["text"])
        db.insert_into_collection(collection_name, doc["title"], doc["text"], vector)

    # Perform similarity searches
    queries = [
        "What is natural language processing?",
        "Explain machine learning concepts.",
        "How does deep learning differ from traditional machine learning?",
        "What are the applications of computer vision?",
        "Describe the role of data science in organizations."
    ]

    top_n = 2
    for query in queries:
        print(f"Query: {query}")
        results = db.search(collection_name, query, top_n)

        print(f"Top {top_n} similar documents:")
        for score, doc in results:
            print(f"Title: {doc['title']}")
            print(f"Text: {doc['text']}")
            print(f"Similarity Score: {score}")
            print("---")

        print("\n")

    # Remove the collection
    db.remove_collection(collection_name)
    print(f"Removed collection: {collection_name}")



def generate_random_text(length):
    letters = string.ascii_letters + ' '
    return ''.join(random.choice(letters) for _ in range(length))

def test_simple_vector_db_large_scale():
    # Create an instance of SimpleVectorDB
    db = SimpleVectorDB(db_path="./test_db_large")

    # Create a new collection
    collection_name = "test_collection_large"
    db.create_collection(collection_name)

    # Insert a large number of documents into the collection
    num_documents = 1000
    insert_start_time = time.time()

    for i in range(num_documents):
        title = f"Document {i+1}"
        text = generate_random_text(100)
        vector = db.get_embedding(text)
        db.insert_into_collection(collection_name, title, text, vector)

    insert_end_time = time.time()
    insert_duration = insert_end_time - insert_start_time
    print(f"Inserted {num_documents} documents in {insert_duration:.2f} seconds.")

    # Perform similarity searches
    num_queries = 100
    query_lengths = [10, 20, 50]  # Different query lengths to test

    for query_length in query_lengths:
        search_start_time = time.time()

        for _ in range(num_queries):
            query = generate_random_text(query_length)
            results = db.search(collection_name, query, top_n=5)

        search_end_time = time.time()
        search_duration = search_end_time - search_start_time
        avg_search_time = search_duration / num_queries

        print(f"Query Length: {query_length}")
        print(f"Average search time for {num_queries} queries: {avg_search_time:.4f} seconds.")
        print(f"Search throughput: {num_queries / search_duration:.2f} queries/second.")
        print("---")

    # Remove the collection
    db.remove_collection(collection_name)
    print(f"Removed collection: {collection_name}")




import unittest
from simple_vector_db import SimpleVectorDB

class TestSimpleVectorDB(unittest.TestCase):
    def setUp(self):
        self.db = SimpleVectorDB()
        self.collection_name = "test_collection"
        self.db.create_collection(self.collection_name)

    def test_insert_text_into_collection(self):
        # Large piece of text for testing
        large_text = """
        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Fusce auctor, 
        nisl eget ultricies tincidunt, nisl nibh aliquam nisl, nec tincidunt 
        nisl nunc vel nisl. Sed euismod, nisl sit amet aliquam lacinia, nisl 
        nisl aliquam nisl, nec aliquam nisl nisl sit amet nisl. Sed euismod, 
        nisl sit amet aliquam lacinia, nisl nisl aliquam nisl, nec aliquam 
        nisl nisl sit amet nisl. Sed euismod, nisl sit amet aliquam lacinia, 
        nisl nisl aliquam nisl, nec aliquam nisl nisl sit amet nisl. Sed 
        euismod, nisl sit amet aliquam lacinia, nisl nisl aliquam nisl, nec 
        aliquam nisl nisl sit amet nisl. Sed euismod, nisl sit amet aliquam 
        lacinia, nisl nisl aliquam nisl, nec aliquam nisl nisl sit amet nisl.
        """

        # Insert the large text into the collection
        self.db.insert_text_into_collection(self.collection_name, "Large Text", large_text)

        # Retrieve the inserted chunks
        chunks = [doc['text'] for doc in self.db.db[self.collection_name].values()]

        # Check if the number of chunks is correct
        self.assertEqual(len(chunks), 2)

        # Check if the chunks have the expected size
        self.assertLessEqual(len(chunks[0]), 500)
        self.assertLessEqual(len(chunks[1]), 500)

        # Check if the chunks contain the expected text
        self.assertTrue("Lorem ipsum dolor sit amet" in chunks[0])
        self.assertTrue("lacinia, nisl nisl aliquam nisl" in chunks[1])

    def tearDown(self):
        self.db.remove_collection(self.collection_name)


if __name__ == "__main__":
    #test_simple_vector_db_large_scale()
    test_simple_vector_db()
    unittest.main()
