import xml.sax

class Article:
    def __init__(self, title, ns, id, revisions):
        self.title = title
        self.ns = ns
        self.id = id
        self.revisions = revisions

class Revision:
    def __init__(self, id, timestamp, username, userid, comment, text):
        self.id = id
        self.timestamp = timestamp
        self.username = username
        self.userid = userid
        self.comment = comment
        self.text = text

class WikiHandler(xml.sax.ContentHandler):
    def __init__(self, target_id):
        self.target_id = target_id
        self.current_id = None
        self.buffer = ""
        self.article = None
        self.revision = None
        self.in_target_article = False

    def startElement(self, name, attrs):
        if name in ["title", "ns", "id", "timestamp", "username", "comment", "text"]:
            self.buffer = ""

    def characters(self, content):
        self.buffer += content

    def endElement(self, name):
        if name == "id":
            if self.article is None:  # This is the article ID
                self.current_id = int(self.buffer.strip())
                if self.current_id == self.target_id:
                    self.in_target_article = True
            elif self.in_target_article:  # This is the revision ID
                self.revision.id = int(self.buffer.strip())
        elif self.in_target_article:
            if name == "title":
                self.article = Article(self.buffer, None, self.current_id, [])
            elif name == "ns":
                self.article.ns = int(self.buffer.strip())
            elif name == "revision":
                self.article.revisions.append(self.revision)
                self.revision = None
            elif name == "timestamp":
                self.revision.timestamp = self.buffer
            elif name == "username":
                self.revision.username = self.buffer
            elif name == "comment":
                self.revision.comment = self.buffer
            elif name == "text":
                self.revision.text = self.buffer
            elif name == "page":
                self.in_target_article = False  # Exit early, we found our article

    def startDocument(self):
        self.revision = Revision(None, None, None, None, None, None)

def get_article(xml_file_path, article_id):
    parser = xml.sax.make_parser()
    handler = WikiHandler(article_id)
    parser.setContentHandler(handler)
    with open(xml_file_path, 'r', encoding='utf-8') as file:
        parser.parse(file)
    return handler.article

# Usage:
# article = get_article('your_file.xml', 1)
