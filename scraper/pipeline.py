import os
import sys
import datetime
import feedparser
import trafilatura
from pymongo import MongoClient
from dotenv import load_dotenv

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://127.0.0.1:27017/news_pulse")
client = MongoClient(MONGO_URI)
db = client.get_database()

articles_col = db["articles"]
clusters_col = db["clusters"]
jobs_col = db["ingestion_jobs"]

# Ensure unique index on article URL to avoid duplicates (Part 1a)
articles_col.create_index("url", unique=True)

RSS_FEEDS = {
    "BBC News": "http://feeds.bbci.co.uk/news/rss.xml",
    "NPR": "https://feeds.npr.org/1001/rss.xml",
    "The Guardian": "https://www.theguardian.com/world/rss"
}

def parse_date(entry):
    if hasattr(entry, 'published_parsed') and entry.published_parsed:
        return datetime.datetime(*entry.published_parsed[:6])
    elif hasattr(entry, 'updated_parsed') and entry.updated_parsed:
        return datetime.datetime(*entry.updated_parsed[:6])
    return datetime.datetime.now()

def fetch_and_store_articles():
    print("Fetching articles from RSS feeds into MongoDB...")
    scraped_count = 0

    for source_name, feed_url in RSS_FEEDS.items():
        feed = feedparser.parse(feed_url)

        for entry in feed.entries:
            title = getattr(entry, 'title', '').strip()
            link = getattr(entry, 'link', '').strip()
            summary = getattr(entry, 'summary', '').strip()
            pub_date = parse_date(entry)

            if not link or not title:
                continue

            # Skip if already exists
            if articles_col.find_one({"url": link}):
                continue

            full_content = None
            try:
                downloaded = trafilatura.fetch_url(link)
                if downloaded:
                    full_content = trafilatura.extract(downloaded)
            except Exception:
                pass

            if not full_content:
                full_content = summary

            try:
                articles_col.insert_one({
                    "title": title,
                    "summary": summary,
                    "content": full_content,
                    "url": link,
                    "source": source_name,
                    "published_at": pub_date,
                    "created_at": datetime.datetime.now()
                })
                scraped_count += 1
            except Exception as e:
                pass

    print(f"Added {scraped_count} new articles to MongoDB.")

def cluster_articles():
    print("Grouping articles into topic clusters...")
    
    # Fetch recent 100 articles
    recent_articles = list(articles_col.find().sort("published_at", -1).limit(100))

    if len(recent_articles) < 2:
        print("Not enough articles in MongoDB to cluster.")
        return

    articles = [
        {
            "id": str(a["_id"]),
            "title": a["title"],
            "summary": a.get("summary", ""),
            "text": f"{a['title']} {a.get('summary', '')}",
            "source": a["source"],
            "url": a["url"],
            "published_at": a["published_at"]
        }
        for a in recent_articles
    ]

    corpus = [a["text"] for a in articles]
    vectorizer = TfidfVectorizer(stop_words='english', max_features=500)
    tfidf_matrix = vectorizer.fit_transform(corpus)
    feature_names = np.array(vectorizer.get_feature_names_out())

    sim_matrix = cosine_similarity(tfidf_matrix)
    THRESHOLD = 0.20
    visited = set()
    clusters = []

    for i in range(len(articles)):
        if i in visited:
            continue
        cluster_indices = [i]
        visited.add(i)

        for j in range(i + 1, len(articles)):
            if j not in visited and sim_matrix[i][j] >= THRESHOLD:
                cluster_indices.append(j)
                visited.add(j)

        if len(cluster_indices) >= 2:
            cluster_articles_list = [articles[idx] for idx in cluster_indices]
            group_vector = tfidf_matrix[cluster_indices].mean(axis=0)
            top_indices = np.asarray(group_vector).ravel().argsort()[-3:][::-1]
            label_terms = [feature_names[idx] for idx in top_indices if group_vector[0, idx] > 0]
            label = " / ".join(label_terms).title() if label_terms else cluster_articles_list[0]['title'][:40]

            dates = [a['published_at'] for a in cluster_articles_list]
            clusters.append({
                "label": label,
                "article_count": len(cluster_articles_list),
                "first_published_at": min(dates),
                "last_published_at": max(dates),
                "articles": cluster_articles_list,
                "created_at": datetime.datetime.now()
            })

    # Clear old clusters and insert fresh ones
    clusters_col.delete_many({})
    if clusters:
        clusters_col.insert_many(clusters)

    print(f"Generated and saved {len(clusters)} topic clusters in MongoDB.")

def run_pipeline(job_id=None):
    if job_id:
        jobs_col.update_one({"job_id": job_id}, {"$set": {"status": "PROCESSING", "updated_at": datetime.datetime.now()}})

    try:
        fetch_and_store_articles()
        cluster_articles()

        if job_id:
            jobs_col.update_one({"job_id": job_id}, {"$set": {"status": "COMPLETED", "updated_at": datetime.datetime.now()}})
    except Exception as e:
        print(f"Pipeline error: {e}")
        if job_id:
            jobs_col.update_one({"job_id": job_id}, {"$set": {"status": "FAILED", "error_message": str(e), "updated_at": datetime.datetime.now()}})

if __name__ == "__main__":
    job_arg = sys.argv[1] if len(sys.argv) > 1 else None
    run_pipeline(job_arg)