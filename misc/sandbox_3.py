import re

articles_filename = 'enwiki-20231001-pages-articles-multistream.xml'

def find_last_id(file_path, chunk_size=1024):
    last_id = None  # initialize
    
    with open(file_path, 'r', encoding='utf-8') as file:
        # Seek to the end of file
        file.seek(0, 2) 
        file_size = file.tell()
        
        # Initialize variables
        buffer = ""
        position = file_size
        
        # Read backwards in chunks
        while position > 0:
            position = max(0, position - chunk_size)
            file.seek(position)
            buffer = file.read(min(chunk_size, file_size - position)) + buffer
            file_size = position
            
            # Check if buffer contains an <id> tag
            match = re.search(r'<id>(\d+)</id>', buffer)
            if match:
                last_id = int(match.group(1))
                break  # Stop once an ID is found
            
            # Keep last part of the buffer in case <id> tag is split between chunks
            buffer = buffer[-chunk_size:]
        
    return last_id

# Call the function and print the result
last_id = find_last_id(articles_filename)
if last_id is not None:
    print(f"The last ID in the file is: {last_id}")
else:
    print("No IDs found in the file.")
