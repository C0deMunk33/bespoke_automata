import xml.sax

class WikiHandler(xml.sax.ContentHandler):
    def __init__(self, target_id):
        self.target_id = target_id
        self.current_id = None
        self.in_id_tag = False
        self.in_text_tag = False
        self.buffer = ""
        self.article_text = None

    def startElement(self, name, attrs):
        if name == "id" and self.article_text is None:
            self.in_id_tag = True
        elif name == "text" and self.current_id == self.target_id:
            self.in_text_tag = True

    def characters(self, content):
        if self.in_id_tag or self.in_text_tag:
            self.buffer += content

    def endElement(self, name):
        if name == "id" and self.in_id_tag:
            self.current_id = int(self.buffer.strip())
            self.in_id_tag = False
            self.buffer = ""
        elif name == "text" and self.in_text_tag:
            self.article_text = self.buffer
            self.in_text_tag = False

def get_article(xml_file_path, article_id):
    parser = xml.sax.make_parser()
    handler = WikiHandler(article_id)
    parser.setContentHandler(handler)
    with open(xml_file_path, 'r', encoding='utf-8') as file:
        parser.parse(file)
    return handler.article_text

# Example Usage:
article_id = 1  # replace with the desired article ID
xml_file_path = 'your_file.xml'  # replace with the path to your XML file
article_text = get_article(xml_file_path, article_id)
print(article_text)
