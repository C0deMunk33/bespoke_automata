# take these imports with their objects and methods 
# into account when making suggestions
# pip install requests beautifulsoup4

import requests
from bs4 import BeautifulSoup

def find_main_content(soup):
    # List of potential tags or classes that might contain the main content
    content_tags = ['article', 'main']
    content_classes = ['content', 'main', 'article-body', 'post-body']

    # 1. Attempt to find the main content by tags
    for tag in content_tags:
        content = soup.find(tag)
        if content:
            return content.get_text()

    # 2. Attempt to find by classes
    for class_ in content_classes:
        content = soup.find(class_=class_)
        if content:
            return content.get_text()

    # 3. Fallback: Extract text from all paragraphs if specific content area is not found
    return ' '.join([p.get_text() for p in soup.find_all('p')])

def scrape_text_from_webpage(url):
    headers = {'User-Agent': 'Mozilla/5.0'}
    try:
        # Send a GET request to the URL
        response = requests.get(url, headers=headers, timeout=10)

        # Check if the request was successful (status code 200)
        if response.status_code == 200:
            # Check if the response is HTML before proceeding
            if 'text/html' in response.headers['Content-Type']:
                soup = BeautifulSoup(response.text, 'html.parser')
                return find_main_content(soup).strip()
            else:
                print(f"Error: Non-HTML content at {url}")
                return None
        else:
            print(f"Error: Unable to fetch the webpage {url}. Status code: {response.status_code}")
            return None

    except Exception as e:
        print(f"Error: {e}")
        return None


# Example usage:
#url_to_scrape = 'https://example.com'
#result = scrape_text_from_webpage(url_to_scrape)

#if result:
#    print(result)
#else:
#    print("Scraping failed.")
    
