const mongoose = require('mongoose');

const ArticleSchema = new mongoose.Schema({
  title: String,
  summary: String,
  content: String,
  url: { type: String, unique: true },
  source: String,
  published_at: Date,
  created_at: { type: Date, default: Date.now }
});

const ClusterSchema = new mongoose.Schema({
  label: String,
  article_count: Number,
  first_published_at: Date,
  last_published_at: Date,
  articles: [
    {
      id: String,
      title: String,
      summary: String,
      text: String,
      source: String,
      url: String,
      published_at: Date
    }
  ],
  created_at: { type: Date, default: Date.now }
});

const IngestionJobSchema = new mongoose.Schema({
  job_id: { type: String, required: true, unique: true },
  status: { type: String, enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'], default: 'PENDING' },
  error_message: String,
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

module.exports = {
  Article: mongoose.model('Article', ArticleSchema),
  Cluster: mongoose.model('Cluster', ClusterSchema),
  IngestionJob: mongoose.model('IngestionJob', IngestionJobSchema)
};