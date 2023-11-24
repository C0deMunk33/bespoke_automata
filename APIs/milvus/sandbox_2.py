import re

articles_filename = 'enwiki-20231001-pages-articles-multistream.xml'

def check_ids_are_ascending(file_path):
    last_id = -1  # initialize with a value that is lower than any valid id
    
    with open(file_path, 'r', encoding='utf-8') as file:
        line_number = 0
        for line in file:
            line_number += 1

            # every million lines, print a message
            if line_number % 1000000 == 0:
                print(f"Checked {line_number} lines so far...")

            # Check for the <page> tag
            if '<page>' in line:
                # Skip next 2 lines to get to the id line
                for _ in range(2):
                    line = file.readline()
                    line_number += 1
                
                # The next line should contain the <id> tag
                id_line = file.readline()
                line_number += 1
                
                # Extract id using regex and check if it is ascending
                match = re.search(r'<id>(\d+)</id>', id_line)
                if match:
                    current_id = int(match.group(1))
                    if current_id <= last_id:
                        print(f"IDs not in ascending order! (line {line_number}: id={current_id}, last_id={last_id})")
                        return False
                    last_id = current_id
                else:
                    print(f"No id found on expected line {line_number}. Line content: {id_line.strip()}")
                    return False
    return True

# Call the function and print the result
if check_ids_are_ascending(articles_filename):
    print("All IDs are in ascending order!")
else:
    print("IDs are not in ascending order.")
