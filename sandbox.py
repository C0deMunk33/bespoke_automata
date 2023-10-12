import os
import re
import random
articles_filename ='enwiki-20231001-pages-articles-multistream.xml'
articles_index_filename = 'enwiki-20231001-pages-articles-multistream-index.txt'

def binary_search_xml(file_path, target_id):
    with open(file_path, 'r', encoding='utf-8') as file:
        low = 0
        # file size in bytes
        max = os.path.getsize(file_path)
        high = max
        while low <= high:
            mid = (low + high) // 2
            if mid >= max:
                return None
            file.seek(mid)
            try:
                file.readline()
                line = file.readline()
            except:
                return None
            
            print("mid: ", mid)

            line = ""
            # read the next line
            while '<page>' not in line:
                #if line contains end of file character, break
                if file.tell() >= max:
                    return None           
                line = file.readline()
            page_start_idx = file.tell() - len(line)

            # move three lines down
            for i in range(3):
                line = file.readline()
            # get the id from the line
            id = int(re.search(r'<id>(\d+)</id>', line).group(1))
            if id == target_id:
                # seek to the start of the page, get all text between <page and </page>
                file.seek(page_start_idx)
                page = ""
                while '</page>' not in page:
                    page += file.readline()
                return page                   
            elif id < target_id:
                low = mid + 1
            else:
                high = mid - 1

# do it 10 times
for i in range(10):
    random_id = random.randint(0, 300000)
    print(binary_search_xml(articles_filename, random_id))
