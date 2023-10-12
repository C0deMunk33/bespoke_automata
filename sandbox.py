import os
import re
import random
import xml.etree.ElementTree as ET

articles_filename ='enwiki-20231001-pages-articles-multistream.xml'
articles_index_filename = 'enwiki-20231001-pages-articles-multistream-index.txt'

def count_lines(file_path):
    with open(file_path, 'r', encoding='utf-8') as file:
        count = sum(1 for _ in file)
    return count

import csv

def convert_to_csv(input_file, output_file):
    with open(input_file, 'r') as infile, open(output_file, 'w', newline='') as outfile:
        csv_writer = csv.writer(outfile, quoting=csv.QUOTE_MINIMAL)
        csv_writer.writerow(['Section', 'ID', 'Title'])  # Write header
        
        for line in infile:
            section, id_, title = line.strip().split(':')
            csv_writer.writerow([section, id_, title])
            
def binary_search_title(csv_file, target_title):
    with open(csv_file, 'r') as file:
        csv_reader = csv.reader(file)
        data = list(csv_reader)[1:]  # Exclude header
        
        data.sort(key=lambda x: x[2])  # Ensure data is sorted by title
        
        left, right = 0, len(data) - 1
        
        while left <= right:
            mid = (left + right) // 2
            title = data[mid][2]
            
            if title == target_title:
                return data[mid]  # Record found
            elif title < target_title:
                left = mid + 1    # Search in the right half
            else:
                right = mid - 1   # Search in the left half
        return None  # Record not found






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
