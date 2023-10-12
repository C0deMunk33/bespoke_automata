import os
import re
import random
import xml.etree.ElementTree as ET

articles_filename ='enwiki-20231001-pages-articles-multistream.xml'
articles_index_filename = 'enwiki-20231001-pages-articles-multistream-index.txt'


def index_binary_search(file_path, title_part):
    with open(file_path, 'r', encoding='utf-8') as file:
        low = 0
        high = os.path.getsize(file_path)

        while low < high:
            mid = (low + high) // 2
            file.seek(mid)

            # Skip to the end of the current line, unless we are at the start of the file
            if mid > 0:
                file.readline()

            # Try to read the next full line and return None if not possible (e.g., at EOF)
            try:
                line = file.readline().strip()
            except EOFError:
                return None

            # If line is empty, we are likely at the end of the file
            if not line:
                high = mid
                continue

            # Check the next line as well to prevent off-by-one errors
            try:
                next_line = file.readline().strip()
            except EOFError:
                next_line = ""

            # Parse the current line and the next line
            try:
                _, id_, title = line.split(":", 2)
                id_ = int(id_)
            except ValueError:
                return None

            try:
                _, next_id, next_title = next_line.split(":", 2)
                next_id = int(next_id)
            except ValueError:
                next_title = ""
                next_id = None

            # Compare the current title and adjust the search space accordingly
            if title.startswith(title_part):
                return id_
            elif next_title.startswith(title_part):
                return next_id
            elif title_part < title:
                high = mid
            else:
                low = mid + 1

        return None





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

    return None

id = index_binary_search(articles_index_filename, 'AssistiveTechnology')
print(id)
'''
# do it 10 times
for i in range(10):
    random_id = random.randint(0, 74955154)
    article = binary_search_xml(articles_filename, random_id)
    # parse the article xml into a dictionary
    if article:
        root = ET.fromstring(article)
        article = {}
        for child in root:
            article[child.tag] = child.text
    if(article):
        print("Article found for id: ", random_id, " with title: ", article['title'])
    else:
        print("No article found for id: ", random_id)
'''
