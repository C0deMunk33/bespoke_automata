# pip install feedparser
from flask import Flask, request, jsonify
import feedparser

app = Flask(__name__)

@app.route('/parse_rss', methods=['POST'])
def parse_rss():
    # Get the RSS feed URL from the request JSON data
    data = request.get_json()
    rss_url = data.get('rss_url')

    if not rss_url:
        return jsonify({'error': 'RSS feed URL is missing'}), 400

    try:
        # Parse the RSS feed using feedparser
        parsed_feed = feedparser.parse(rss_url)

        # Return the parsed feed as JSON
        return jsonify(parsed_feed)
    except Exception as e:
        return jsonify({'error': f'Error parsing RSS feed: {str(e)}'}), 500

if __name__ == '__main__':
    app.run(debug=True)

