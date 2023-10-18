data_dataset = load_dataset(DATASET, split='all')
data_dataset = data_dataset.train_test_split(test_size=INSERT_RATIO, seed=42)['test']
data_dataset = data_dataset.map(lambda val: {'answer': val['answers']['text'][0]}, remove_columns=['answers'])

tokenizer = AutoTokenizer.from_pretrained(MODEL)

def tokenize_question(batch):
    results = tokenizer(batch['question'], add_special_tokens = True, truncation = True, padding = "max_length", return_attention_mask = True, return_tensors = "pt")
    batch['input_ids'] = results['input_ids']
    batch['token_type_ids'] = results['token_type_ids']
    batch['attention_mask'] = results['attention_mask']
    return batch

data_dataset = data_dataset.map(tokenize_question, batch_size=TOKENIZATION_BATCH_SIZE, batched=True)
data_dataset.set_format('torch', columns=['input_ids', 'token_type_ids', 'attention_mask'], output_all_columns=True)

model = AutoModel.from_pretrained(MODEL)
def embed(batch):
    sentence_embs = model(
                input_ids=batch['input_ids'],
                token_type_ids=batch['token_type_ids'],
                attention_mask=batch['attention_mask']
                )[0]
    input_mask_expanded = batch['attention_mask'].unsqueeze(-1).expand(sentence_embs.size()).float()
    batch['question_embedding'] = sum(sentence_embs * input_mask_expanded, 1) / clamp(input_mask_expanded.sum(1), min=1e-9)
    return batch

data_dataset = data_dataset.map(embed, remove_columns=['input_ids', 'token_type_ids', 'attention_mask'], batched = True, batch_size=INFERENCE_BATCH_SIZE)

def insert_function(batch):
    insertable = [
        batch['question'],
        [x[:995] + '...' if len(x) > 999 else x for x in batch['answer']],
        batch['question_embedding'].tolist()
    ]    
    collection.insert(insertable)

data_dataset.map(insert_function, batched=True, batch_size=64)
collection.flush()
