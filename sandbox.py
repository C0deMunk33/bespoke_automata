import pandas as pd
from towhee import ops, pipe, DataCollection
import numpy as np
import time
from pymilvus import connections, FieldSchema, CollectionSchema, DataType, Collection, utility
from transformers import AutoTokenizer, AutoModel

import torch
from concurrent.futures import ProcessPoolExecutor, as_completed
import logging
import multiprocessing




MODEL = 'bert-base-uncased'
TOKENIZATION_BATCH_SIZE = 1000 
DIMENSION = 768 
INSERTION_BATCH_SIZE = 200
WORKERS = 32
articles_filename ='enwiki-20231001-pages-articles-multistream.xml'
#articles_filename = './wiki_pages/page_0.xml'



def parse_wiki_page(page_text, tokenizer):
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
    
    title_tokens = tokenizer(title, add_special_tokens=True, truncation=True, padding="max_length", return_attention_mask=True, return_tensors="pt")
    title_tokens = {k: v.to('cuda:0') for k, v in title_tokens.items()}
    #truncate the strings
    title = title[:1000]
    body = body[:65000]
    description = description[:10000]
    categories = categories[0:1000]
    image_file = image_file[:2000]
    redirect_title = redirect_title[:1000]
    sha1 = sha1[:500]

    print(id)
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

def embed_title(title_tokens, model):
    #title_tokens = {k: v.to('cuda:0') for k, v in title_tokens.items()}
    title_embedding = model(
                input_ids=title_tokens['input_ids'],
                token_type_ids=title_tokens['token_type_ids'],
                attention_mask=title_tokens['attention_mask']
                )[0]
    input_mask_expanded = title_tokens['attention_mask'].unsqueeze(-1).expand(title_embedding.size()).float()
    title_vector = (title_embedding * input_mask_expanded).sum(1) / torch.clamp(input_mask_expanded.sum(1), min=1e-9)
    title_vector = title_vector.tolist()[0]
    return title_vector
 
def insert_pages_in_parallel(articles_filename, tokenizer, model, wiki_collection):
    batch = []
    file_count = 0
    futures = []

    with ProcessPoolExecutor(max_workers=WORKERS) as executor:
        for page in iterate_pages(articles_filename):
            future = executor.submit(parse_wiki_page, page, tokenizer)  # only parse, don't embed
            futures.append(future)
            
            if len(futures) == INSERTION_BATCH_SIZE:
                for future in as_completed(futures):
                    parsed_page = future.result()
                    parsed_page['title_vector'] = embed_title(parsed_page['title_tokens'], model)  # embed in main process
                    del parsed_page['title_tokens']  # remove tokens if you don't want to store them
                    batch.append(parsed_page)
                    file_count += 1

                    if file_count % INSERTION_BATCH_SIZE == 0:
                        print("inserting batch")
                        insert_wiki_pages(batch, wiki_collection)
                        print(f"Inserted {file_count} pages")
                        batch.clear()
                futures.clear()

    # Handle remaining futures
    for future in as_completed(futures):
        parsed_page = future.result()
        parsed_page['title_vector'] = embed_title(parsed_page['title_tokens'])
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
            FieldSchema(name="title_vector", dtype=DataType.FLOAT_VECTOR, dim=768),
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
                    
def main():
    logging.getLogger("transformers.modeling_utils").setLevel(logging.ERROR)


    tokenizer = AutoTokenizer.from_pretrained(MODEL)
    model = AutoModel.from_pretrained(MODEL).to('cuda:0')
    model.share_memory()



    wiki_collection = create_wiki_collection()
    insert_pages_in_parallel(articles_filename, tokenizer, model, wiki_collection)

if __name__ == '__main__':
    connections.connect(host='192.168.0.8', port='19530')

    multiprocessing.set_start_method('spawn', force=True)
    main()