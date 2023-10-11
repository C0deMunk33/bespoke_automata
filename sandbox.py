import xml.sax
import pickle

class IndexBuilder(xml.sax.ContentHandler):
    def __init__(self):
        self.current_id = None
        self.in_id_tag = False
        self.buffer = ""
        self.index = {}

    def startElement(self, name, attrs):
        if name == "id":
            self.in_id_tag = True

    def characters(self, content):
        if self.in_id_tag:
            self.buffer += content

    def endElement(self, name):
        if name == "id" and self.in_id_tag:
            self.current_id = int(self.buffer.strip())
            self.in_id_tag = False
            self.buffer = ""
        elif name == "page":
            self.index[self.current_id] = self._locator.getLineNumber()

    def save_index(self, file_path):
        with open(file_path, 'wb') as file:
            pickle.dump(self.index, file)

def build_index(xml_file_path, index_file_path):
    parser = xml.sax.make_parser()
    handler = IndexBuilder()
    parser.setContentHandler(handler)
    with open(xml_file_path, 'r', encoding='utf-8') as file:
        parser.parse(file)
    handler.save_index(index_file_path)

# Usage:
# build_index('your_file.xml', 'index.pkl')

def get_article(xml_file_path, index_file_path, article_id):
    with open(index_file_path, 'rb') as file:
        index = pickle.load(file)
    if article_id not in index:
        return None  # Article ID not found
    with open(xml_file_path, 'r', encoding='utf-8') as file:
        file.seek(index[article_id])  # Seek to the start of the article
        # Now parse the XML from this point to extract the article
        # ...
        pass

# Usage:
# article_text = get_article('your_file.xml', 'index.pkl', 1)
