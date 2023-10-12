def binary_search_xml(file_path, target_id):
    with open(file_path, 'r', encoding='utf-8') as file:
        low = 0
        high = file.seek(0, 2)  # Seek to end

        while low < high:
            mid = (low + high) // 2
            file.seek(mid)
            
            # Skip partial line if landed in the middle
            file.readline()
            
            # Skip until the next "<page>" tag
            while True:
                line = file.readline()
                if '<page>' in line:
                    break
                mid = mid + len(line)
            
            # Store lines in a buffer and find "<id>" tag
            buffer = [line]
            for _ in range(3):  # Adjust accordingly
                line = file.readline()
                buffer.append(line)
                if '<id>' in line:
                    # Extract ID value
                    id_start = line.find('<id>') + 4
                    id_end = line.find('</id>')
                    if id_start != -1 and id_end != -1:
                        id_value = int(line[id_start:id_end])
                        break
            else:
                # If here, failed to find ID in expected lines - error handling or skip to next iteration
                low = mid + 1
                continue
                
            # Compare ID with target and adjust bounds
            if id_value == target_id:
                # Found the ID, now extract the full <page> content
                # Read forward until "</page>"
                while True:
                    line = file.readline()
                    buffer.append(line)
                    if '</page>' in line:
                        break
                
                # Concatenate buffer to return the <page> content
                return ''.join(buffer)
            elif id_value < target_id:
                low = mid + 1
            else:
                high = mid

    return None  # ID not found
