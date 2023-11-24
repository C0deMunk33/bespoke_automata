import os
import re
import random
import xml.etree.ElementTree as ET
import csv

articles_filename ='enwiki-20231001-pages-articles-multistream.xml'
articles_index_filename = "articles_index.csv"

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


# func to save the first 10 pages as .xml files
def save_random_pages(file_name, output_dir, num_pages=10):
    # Create output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)
    
    # Get the size of the file
    file_size = os.path.getsize(file_name)
    
    # Generate a random list of lines to seek to
    lines = sorted([random.randint(0, file_size) for _ in range(num_pages)])
    
    # Iterate over the pages and save them
    for i, page in enumerate(iterate_pages(file_name, start_line=lines[0])):
        if i == num_pages:
            break
        with open(os.path.join(output_dir, f"page_{i}.xml"), 'w', encoding='utf-8') as out_file:
            out_file.write(page)

# function to find if any page has multple <revision> tags
def found_a_multiple_revision(filename): #returns the first found page with multiple <revision> tags
    for page in iterate_pages(filename):
        if page.count('<revision>') > 1:
            return page
    return None


#function to find max length of all the text in the <text> tag using the bytes= param of the tag
def find_max_text_length(filename):
    max_length = 0
    for page in iterate_pages(filename):
        match = re.search(r'<text bytes="(\d+)">', page)
        if match:
            length = int(match.group(1))
            if length > max_length:
                max_length = length
    return max_length

# save the first 10 pages as .xml files
# save_random_pages(articles_filename, 'pages')

# find if any page has multple <revision> tags
'''
page = found_a_multiple_revision(articles_filename)
if page is not None:
    print("Found page with multiple <revision> tags:")
    print(page)
'''

# find max length of all the text in the <text> tag using the bytes= param of the tag
print(f"Max text length: {find_max_text_length(articles_filename)}")