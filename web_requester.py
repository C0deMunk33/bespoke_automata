# take these imports with their objects and methods 
# into account when making suggestions
# pip install requests beautifulsoup4

import requests
from bs4 import BeautifulSoup


def scrape_text_from_webpage(url):
    try:
        # Send a GET request to the URL
        response = requests.get(url)

        # Check if the request was successful (status code 200)
        if response.status_code == 200:
            # Parse the HTML content of the page using BeautifulSoup
            soup = BeautifulSoup(response.text, 'html.parser')

            # Extract text from all paragraphs (you can adjust this based on your needs)
            paragraphs = soup.find_all('p')

            # Concatenate the text from all paragraphs
            extracted_text = ' '.join([paragraph.get_text() for paragraph in paragraphs])

            return extracted_text

        else:
            print(f"Error: Unable to fetch the webpage. Status code: {response.status_code}")
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
    
