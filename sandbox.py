#! pip3 install -q towhee pymilvus==2.2.11
# Download data
#! wget -q https://github.com/towhee-io/examples/releases/download/data/New_Medium_Data.csv

import pandas as pd
from towhee import ops, pipe, DataCollection
import numpy as np
import time
from pymilvus import connections, FieldSchema, CollectionSchema, DataType, Collection, utility

df = pd.read_csv('New_Medium_Data.csv', converters={'title_vector': lambda x: eval(x)})
df.head()

connections.connect(host='192.168.0.7', port='19530')

def create_milvus_collection(collection_name, dim):
    if utility.has_collection(collection_name):
        utility.drop_collection(collection_name)
    
    fields = [
            FieldSchema(name="id", dtype=DataType.INT64, is_primary=True, auto_id=False),
            FieldSchema(name="title", dtype=DataType.VARCHAR, max_length=500),   
            FieldSchema(name="title_vector", dtype=DataType.FLOAT_VECTOR, dim=dim),
            FieldSchema(name="link", dtype=DataType.VARCHAR, max_length=500),
            FieldSchema(name="reading_time", dtype=DataType.INT64),
            FieldSchema(name="publication", dtype=DataType.VARCHAR, max_length=500),
            FieldSchema(name="claps", dtype=DataType.INT64),
            FieldSchema(name="responses", dtype=DataType.INT64)
    ]
    schema = CollectionSchema(fields=fields, description='search text')
    collection = Collection(name=collection_name, schema=schema)
    
    index_params = {
        'metric_type': "L2",
        'index_type': "IVF_FLAT",
        'params': {"nlist": 2048}
    }
    collection.create_index(field_name='title_vector', index_params=index_params)
    return collection

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

