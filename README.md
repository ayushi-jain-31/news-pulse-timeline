# News Pulse: Topic-Clustered News Timeline

A full-stack application that ingests live news articles from RSS feeds, automatically groups related stories using NLP topic clustering, and renders them on an interactive visual timeline[cite: 5, 8, 10].

---

## 🏗️ System Architecture

- **`scraper/`**: Python pipeline that fetches RSS feeds, cleans messy structures, extracts full body text, and applies TF-IDF + Cosine Similarity clustering[cite: 5, 7, 8, 13].
- **`backend/`**: Node.js & Express REST API serving clusters, article details, and timeline formatting[cite: 5, 9, 13].
- **`frontend/`**: Next.js (React) UI featuring dynamic timeline activity bars, outlet filters, and real-time refresh polling[cite: 5, 10, 13].
- **Database**: MongoDB (Stores raw articles and cluster groupings)[cite: 5].

---

## 📰 News Sources Used
1. **BBC News** (`http://feeds.bbci.co.uk/news/rss.xml`)[cite: 5]
2. **NPR** (`https://feeds.npr.org/1001/rss.xml`)[cite: 5]
3. **The Guardian** (`https://www.theguardian.com/international/rss`)[cite: 5]

---

## 🧠 Topic Grouping Approach (TF-IDF + Cosine Similarity)

### Why TF-IDF?
We utilized **TF-IDF (Term Frequency-Inverse Document Frequency) vectorization** paired with **Cosine Similarity** from `scikit-learn`[cite: 8]. This statistical NLP approach measures term relevance across headlines and body text to measure how closely articles relate to one another[cite: 8].

### Thresholds & Parameters
- **Similarity Threshold**: `0.30` - Articles with cosine similarity >= 0.30 are grouped together[cite: 8].