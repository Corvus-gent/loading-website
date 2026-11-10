"""Read public metrics from a pinned yt-dlp release. No downloads or browser cookie access."""
import json, re, sys
from urllib.parse import urlsplit
# Use the verified zipapp installed by install-worker; do not import arbitrary remote code.
bundle, platform, url = sys.argv[1:4]
sys.path.insert(0, bundle)
from yt_dlp import YoutubeDL
from yt_dlp.extractor.twitter import TwitterIE
options = {'quiet': True, 'no_warnings': True, 'socket_timeout': 8, 'retries': 0,
           'extractor_retries': 0, 'noplaylist': True, 'skip_download': True, 'cachedir': False}
with YoutubeDL(options) as dl:
    if platform == 'x':
        # The normal --dump-json projection omits bookmarks and quote counts from the same response.
        post_id = urlsplit(url).path.split('/')[-1]
        ie = TwitterIE(dl)
        ie.initialize()
        status = ie._extract_status(post_id)
        if str(status.get('id_str') or status.get('id')) != post_id:
            raise ValueError('Post identity not confirmed')
        if status.get('retweeted_status') or status.get('quoted_status_id_str') or status.get('in_reply_to_status_id_str'):
            raise ValueError('Not an original X post')
        metrics = {k:status[k] for k in ['view_count','favorite_count','reply_count','retweet_count','quote_count','bookmark_count'] if status.get(k) is not None}
        if 'view_count' in metrics: metrics['impression_count'] = metrics.pop('view_count')
    else:
        item = dl.extract_info(url, download=False)
        metrics = {k:item[k] for k in ['view_count','like_count','comment_count','repost_count','save_count'] if item.get(k) is not None}
    print(json.dumps(metrics))
