#! pip3 install -q towhee pymilvus==2.2.11
# Download data
#! wget -q https://github.com/towhee-io/examples/releases/download/data/New_Medium_Data.csv

import pandas as pd
from towhee import ops, pipe, DataCollection
import numpy as np
import time
from pymilvus import connections, FieldSchema, CollectionSchema, DataType, Collection, utility
from transformers import AutoTokenizer, AutoModel

df = pd.read_csv('New_Medium_Data.csv', converters={'title_vector': lambda x: eval(x)})
df.head()

connections.connect(host='192.168.0.7', port='19530')

MODEL = 'bert-base-uncased'
TOKENIZATION_BATCH_SIZE = 1000 
DIMENSION = 768 

#takes xml text and returns a dictionary of the fields we want to store
def parse_wiki_page(page_text):
    # find id tag
    id_start = page_text.find('<id>') + 4
    id_end = page_text.find('</id>')
    id = page_text[id_start:id_end]
    # find title tag
    title_start = page_text.find('<title>') + 7
    title_end = page_text.find('</title>')
    title = page_text[title_start:title_end]

    # TODO: if title contains Wikipedia: or Help: or other non-article pages, skip it
    
    # find the title from the redirect tag if it exists, does not always exist
    if page_text.find('<redirect title="') != -1:
        redirect_start = page_text.find('<redirect title="') + 17
        redirect_end = page_text.find('"/>')
        redirect = page_text[redirect_start:redirect_end]

    # find the last revision tag
    revision_start = page_text.rfind('<revision>')
    revision_end = page_text.rfind('</revision>')

    # find the text tag after the last revision tag
    text_start = page_text.rfind('<text') + 5
    text_start = page_text.find('>', text_start) + 1
    text_end = page_text.rfind('</text>')
    #description is everything in text before the first "=="
    description = page_text[text_start:text_end]
    description = description.split("==")[0]
    #body is everything in text after the first "==" inclusive    
    body = page_text[text_start:text_end]
    # image file is the first [[File tag inclusive
    image_file_start = page_text.find('[[File:')
    image_file_end = page_text.find(']]', image_file_start) + 2
    image_file = page_text[image_file_start:image_file_end]
    # categories are everything in all [[Category: tags after the : but before the ]], comma separated
    categories = []
    category_start = page_text.find('[[Category:')
    while category_start != -1:
        category_start += 11
        category_end = page_text.find(']]', category_start)
        category = page_text[category_start:category_end]
        categories.append(category)
        category_start = page_text.find('[[Category:', category_end)
    categories = ",".join(categories)
    # find sha1 tag after text tag
    sha1_start = page_text.find('<sha1>') + 6
    sha1_end = page_text.find('</sha1>')
    sha1 = page_text[sha1_start:sha1_end]
    # pull all the numbers out of the text
    numbers = []
    for word in body.split():
        if word.isnumeric():
            numbers.append(float(word))
    
    # TODO: vectorize
    tokenizer = AutoTokenizer.from_pretrained(MODEL)
    #     results = tokenizer(batch['question'], add_special_tokens = True, truncation = True, padding = "max_length", return_attention_mask = True, return_tensors = "pt")
    title_tokens = tokenizer(title, add_special_tokens = True, truncation = True, padding = "max_length", return_attention_mask = True, return_tensors = "pt")
    description_tokens = tokenizer(description, add_special_tokens = True, truncation = True, padding = "max_length", return_attention_mask = True, return_tensors = "pt")
    body_tokens = tokenizer(body, add_special_tokens = True, truncation = True, padding = "max_length", return_attention_mask = True, return_tensors = "pt")
    categories_tokens = tokenizer(categories, add_special_tokens = True, truncation = True, padding = "max_length", return_attention_mask = True, return_tensors = "pt")
    numbers_tokens = tokenizer(numbers, add_special_tokens = True, truncation = True, padding = "max_length", return_attention_mask = True, return_tensors = "pt")
    
    # TODO: track milvus issue (https://github.com/milvus-io/milvus/issues/25639) multiple vectors in one field
    return {
        'id': id,
        'title': title,
        'title_vector': title_tokens,
        'body': body,
        #'body_vector': body_tokens,
        'description': description,
        #'description_vector': description_tokens,
        'categories': categories,
        #'categories_vector': categories_tokens,
        'image_filename': image_file,
        'redirect_title': redirect,
        'revision_hash': sha1,
        #'numbers_vector': numbers_tokens,
        }

    

def create_wiki_collection():
    if utility.has_collection('wiki-50'):
        utility.drop_collection('wiki-50')
    
    fields = [
            FieldSchema(name="id", dtype=DataType.INT64, is_primary=True, auto_id=False),
            FieldSchema(name="title", dtype=DataType.VARCHAR, max_length=500),   
            FieldSchema(name="title_vector", dtype=DataType.FLOAT_VECTOR, dim=768),
            FieldSchema(name="body", dtype=DataType.VARCHAR, max_length=50000),
            # body_vector
            #FieldSchema(name="body_vector", dtype=DataType.FLOAT_VECTOR, dim=768),
            # description
            FieldSchema(name="description", dtype=DataType.VARCHAR, max_length=500),
            # description_vector
            #FieldSchema(name="description_vector", dtype=DataType.FLOAT_VECTOR, dim=768),
            # image filename
            FieldSchema(name="image_filename", dtype=DataType.VARCHAR, max_length=500),
            # categories
            FieldSchema(name="categories", dtype=DataType.VARCHAR, max_length=500),
            # categories_vector
            #FieldSchema(name="categories_vector", dtype=DataType.FLOAT_VECTOR, dim=768),
            FieldSchema(name="redirect_title", dtype=DataType.VARCHAR, max_length=500),
            # revision hash
            FieldSchema(name="revision_hash", dtype=DataType.VARCHAR, max_length=500),
            # numbers vector, a vector of numbers extracted from the text
            #FieldSchema(name="numbers_vector", dtype=DataType.FLOAT_VECTOR, dim=768),

    ]
    schema = CollectionSchema(fields=fields, description='search text')
    collection = Collection(name='wiki-50', schema=schema)
    
    index_params = {
        'metric_type': "L2",
        'index_type': "IVF_FLAT",
        'params': {"nlist": 2048}
    }
    collection.create_index(field_name='title_vector', index_params=index_params)
    return collection

def insert_wiki_page(page_text, collection):
    insertable = parse_wiki_page(page_text)
    collection.insert(insertable)
    collection.flush()



'''
collection = create_milvus_collection('search_article_in_medium', 768)

insert_pipe = (pipe.input('df')
                   .flat_map('df', 'data', lambda df: df.values.tolist())
                   .map('data', 'res', ops.ann_insert.milvus_client(host='192.168.0.7', 
                                                                    port='19530',
                                                                    collection_name='search_article_in_medium'))
                   .output('res')
)

start_time = time.time()
_ = insert_pipe(df)
end_time = time.time()
print('Time Cost: {}'.format(end_time - start_time))
collection.load()
collection.num_entities
search_pipe = (pipe.input('query')
                    .map('query', 'vec', ops.text_embedding.dpr(model_name="facebook/dpr-ctx_encoder-single-nq-base"))
                    .map('vec', 'vec', lambda x: x / np.linalg.norm(x, axis=0))
                    .flat_map('vec', ('id', 'score'), ops.ann_search.milvus_client(host='192.168.0.7', 
                                                                                   port='19530',
                                                                                   collection_name='search_article_in_medium'))  
                    .output('query', 'id', 'score')
               )

res = search_pipe('monkey')
DataCollection(res).show()

res = search_pipe.batch(['funny python demo', 'AI in data analysis'])
for re in res:
    DataCollection(re).show()

'''