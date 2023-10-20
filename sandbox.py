import pandas as pd
from towhee import ops, pipe, DataCollection
import numpy as np
import time
from pymilvus import connections, FieldSchema, CollectionSchema, DataType, Collection, utility


import torch
from concurrent.futures import ProcessPoolExecutor, as_completed
import logging
import multiprocessing

from sentence_transformers import SentenceTransformer


#MODEL = 'bert-base-uncased'
MODEL = 'sentence-transformers/all-MiniLM-L12-v2'

TOKENIZATION_BATCH_SIZE = 1000 
DIMENSION = 384 
INSERTION_BATCH_SIZE = 5000
WORKERS = 32
articles_filename ='enwiki-20231001-pages-articles-multistream.xml'
#articles_filename = './wiki_pages/page_0.xml'




def parse_wiki_page(page_text):
    id_start = page_text.find('<id>') + 4
    id_end = page_text.find('</id>')
    id = page_text[id_start:id_end]
    id = int(id)
    title_start = page_text.find('<title>') + 7
    title_end = page_text.find('</title>')
    title = page_text[title_start:title_end]

    # TODO: if title contains Wikipedia: or Help: or other non-article pages, skip it
    
    redirect_title = ""
    if page_text.find('<redirect title="') != -1:
        redirect_start = page_text.find('<redirect title="') + 17
        redirect_end = page_text.find('" />',redirect_start)
        redirect_title = page_text[redirect_start:redirect_end]
    revision_start = page_text.rfind('<revision>')
    revision_end = page_text.rfind('</revision>')
    text_start = page_text.rfind('<text') + 5
    text_start = page_text.find('>', text_start) + 1
    text_end = page_text.rfind('</text>',text_start)
    description = ""
    body = ""
    if "#REDIRECT" not in page_text[text_start:text_end] and "==" in page_text[text_start:text_end]:
        description = page_text[text_start:text_end]
        description = description.split("==")[0]
        body = page_text[text_start:text_end]
        body = body.split("==")[1]
        body = "=="+body

    image_file = ""
    if page_text.find('[[File:') != -1:
        image_file_start = page_text.find('[[File:')
        image_file_end = page_text.find(']]', image_file_start) + 2
        image_file = page_text[image_file_start:image_file_end]
    categories = []
    if page_text.find('[[Category:') != -1:
        category_start = page_text.find('[[Category:')
        while category_start != -1:
            category_start += 11
            category_end = page_text.find(']]', category_start)
            category = page_text[category_start:category_end]
            categories.append(category)
            category_start = page_text.find('[[Category:', category_end)
    categories = ",".join(categories)
    sha1_start = page_text.find('<sha1>') + 6
    sha1_end = page_text.find('</sha1>')
    sha1 = page_text[sha1_start:sha1_end]
    numbers = []
    for word in body.split():
        if word.isnumeric():
            numbers.append(float(word))
    
    title_tokens = title  # you'll pass this directly to embed_title or embed_titles_batch

    #truncate the strings
    title = truncate_to_bytes(title, 1024)
    body = truncate_to_bytes(body, 65535)
    description = truncate_to_bytes(description, 12100)
    categories =   truncate_to_bytes(categories, 1024)
    image_file =  truncate_to_bytes(image_file, 2048)
    redirect_title =    truncate_to_bytes(redirect_title, 1024)
    sha1 =  truncate_to_bytes(sha1, 510)

    return {
        'id': id,
        'title': title,
        'title_tokens': title_tokens,  # store tokens, will embed later
        'body': body,
        'description': description,
        'categories': categories,
        'image_filename': image_file,
        'redirect_title': redirect_title,
        'revision_hash': sha1
    }

def embed_title(title, model):
    title_vector = model.encode(title, convert_to_tensor=True)
    return title_vector.tolist()

def embed_titles_batch(titles_batch, model):
    title_vectors = model.encode(titles_batch, convert_to_tensor=True)
    return title_vectors.tolist()

 
def insert_pages_in_parallel(articles_filename, model, wiki_collection):
    batch = []
    file_count = 0
    futures = []
    start_time = time.time()
    
    with ProcessPoolExecutor(max_workers=WORKERS) as executor:
        for page in iterate_pages(articles_filename):
            future = executor.submit(parse_wiki_page, page)  # only parse, don't embed
            futures.append(future)
            
            if len(futures) == INSERTION_BATCH_SIZE:
                # Collect the parsed pages from the completed futures
                parsed_pages = [future.result() for future in as_completed(futures)]
                
                # Batch-embed the titles
                title_tokens_batch = [page['title_tokens'] for page in parsed_pages]  # This line remains unchanged but now 'title_tokens' contains the title text directly
                title_vectors = embed_titles_batch(title_tokens_batch, model)
                
                # Assign the embedded vectors back to the parsed pages and add them to the batch
                for idx, parsed_page in enumerate(parsed_pages):
                    parsed_page['title_vector'] = title_vectors[idx]
                    del parsed_page['title_tokens']
                    batch.append(parsed_page)
                    file_count += 1

                    if file_count % INSERTION_BATCH_SIZE == 0:
                        print("inserting batch")
                        insert_wiki_pages(batch, wiki_collection)
                        print(f"Inserted {file_count} pages in {time.time() - start_time} seconds")
                        # show avg rate of insertion
                        print(f"Insertion rate: {file_count / (time.time() - start_time)} pages per second")
                        batch.clear()
                
                futures.clear()

        # Handle remaining futures
        parsed_pages = [future.result() for future in as_completed(futures)]
        title_tokens_batch = [page['title_tokens'] for page in parsed_pages]
        title_vectors = embed_titles_batch(title_tokens_batch, model)
        
        for idx, parsed_page in enumerate(parsed_pages):
            parsed_page['title_vector'] = title_vectors[idx]
            del parsed_page['title_tokens']
            batch.append(parsed_page)
            file_count += 1

        # Flush any remaining batch
        if batch:
            print("inserting remaining batch")
            insert_wiki_pages(batch, wiki_collection)
            print(f"Inserted a total of {file_count} pages")

def create_wiki_collection():
    if utility.has_collection('wiki'):
        utility.drop_collection('wiki')
    
    fields = [
            FieldSchema(name="id", dtype=DataType.INT64, is_primary=True, auto_id=False),
            FieldSchema(name="title", dtype=DataType.VARCHAR, max_length=1024),   
            FieldSchema(name="title_vector", dtype=DataType.FLOAT_VECTOR, dim=384),
            FieldSchema(name="body", dtype=DataType.VARCHAR, max_length=65535),
            FieldSchema(name="description", dtype=DataType.VARCHAR, max_length=12100),         
            FieldSchema(name="image_filename", dtype=DataType.VARCHAR, max_length=2048),          
            FieldSchema(name="categories", dtype=DataType.VARCHAR, max_length=1024),
            FieldSchema(name="redirect_title", dtype=DataType.VARCHAR, max_length=1024),
            FieldSchema(name="revision_hash", dtype=DataType.VARCHAR, max_length=510),
    ]
    schema = CollectionSchema(fields=fields, description='search text')
    collection = Collection(name='wiki', schema=schema)
    
    index_params = {
        'metric_type': "L2",
        'index_type': "IVF_FLAT",
        'params': {"nlist": 2048}
    }
    collection.create_index(field_name='title_vector', index_params=index_params)
    return collection


def insert_wiki_page(page_text, collection, tokenizer):
    insertable = parse_wiki_page(page_text, tokenizer)

    collection.insert(insertable)
    collection.flush()

def insert_wiki_pages(batch, collection):
    try:
        # check to see if any batch descriptions are larger than 10000 characters
        collection.insert(batch)
        collection.flush()
    except Exception as e:
        # save all the image filenames in the batch to file
        with open('./failed_batch.txt', 'w') as file:
            for page in batch:
                file.write(page['description'] + '\n')
        print(e)
        print("insert failed")
        # exit program if insert failed
        exit(1)

def truncate_to_bytes(s, max_bytes):
    """
    Truncate a string to the specified byte length without breaking utf-8 encoding.
    
    Args:
    - s (str): The input string.
    - max_bytes (int): The maximum byte length.

    Returns:
    - str: The truncated string.
    """
    
    # Step 1: Filter out characters that are not representable in utf8 (3 bytes max)
    s = ''.join(ch for ch in s if len(ch.encode('utf8')) <= 3)
    
    # Step 2: Truncate string based on byte length
    encoded = s.encode('utf8')
    while len(encoded) > max_bytes:
        s = s[:-1]
        encoded = s.encode('utf8')
    
    return s

def iterate_pages(file_name, start_line=0):
    with open(file_name, 'r', encoding='utf-8') as file:
        file.seek(start_line)
        for line in file:
            if '<page>' in line:
                page = line
                for line in file:
                    page += line
                    if '</page>' in line:
                        yield page
                        break   



def insert_pages(articles_filename, model, wiki_collection):
    batch = []
    file_count = 0
    start_time = time.time()
    
    for page in iterate_pages(articles_filename):
        parsed_page = parse_wiki_page(page)
        title_vector = embed_title(parsed_page['title_tokens'], model)
        parsed_page['title_vector'] = title_vector
        del parsed_page['title_tokens']
        batch.append(parsed_page)
        file_count += 1

        if file_count % INSERTION_BATCH_SIZE == 0:
            print("inserting batch")
            insert_wiki_pages(batch, wiki_collection)
            print(f"Inserted {file_count} pages in {time.time() - start_time} seconds")
            # show avg rate of insertion
            print(f"Insertion rate: {file_count / (time.time() - start_time)} pages per second")
            batch.clear()

    # Flush any remaining batch
    if batch:
        print("inserting remaining batch")
        insert_wiki_pages(batch, wiki_collection)
        print(f"Inserted a total of {file_count} pages")

def main():
    logging.getLogger("transformers.modeling_utils").setLevel(logging.ERROR)
    model = SentenceTransformer(MODEL).to('cuda:0')
    wiki_collection = create_wiki_collection()
    insert_pages(articles_filename, model, wiki_collection)

if __name__ == '__main__':
    connections.connect(host='192.168.0.8', port='19530')
    main()
'''Multitrhead:
def main():
    logging.getLogger("transformers.modeling_utils").setLevel(logging.ERROR)
    model = SentenceTransformer(MODEL).to('cuda:0')
    model.share_memory()
    wiki_collection = create_wiki_collection()
    insert_pages_in_parallel(articles_filename, model, wiki_collection)

if __name__ == '__main__':
    connections.connect(host='192.168.0.8', port='19530')

    multiprocessing.set_start_method('spawn', force=True)
    main()

    '''