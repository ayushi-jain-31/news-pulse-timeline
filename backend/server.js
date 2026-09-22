const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const { Cluster, IngestionJob } = require('./models');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5001;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/news_pulse';

mongoose.connect(MONGO_URI)
  .then(() => console.log('Connected to MongoDB successfully.'))
  .catch((err) => console.error('MongoDB Connection Error:', err));

// 1. GET /clusters - List of topic clusters (Part 2)
app.get('/clusters', async (req, res) => {
  try {
    const clusters = await Cluster.find({}, 'label article_count first_published_at last_published_at created_at').sort({ first_published_at: -1 });
    res.json(clusters);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch clusters' });
  }
});

// 2. GET /clusters/:id - Full cluster detail with all articles (Part 2)
app.get('/clusters/:id', async (req, res) => {
  try {
    const cluster = await Cluster.findById(req.params.id);
    if (!cluster) {
      return res.status(404).json({ error: 'Cluster not found' });
    }
    // Sort articles chronologically
    cluster.articles.sort((a, b) => new Date(a.published_at) - new Date(b.published_at));
    res.json(cluster);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch cluster details' });
  }
});

// 3. GET /timeline - Clusters formatted specifically for charting libraries (Part 2)
app.get('/timeline', async (req, res) => {
  try {
    const clusters = await Cluster.find();
    const timelineData = clusters.map((c) => ({
      id: c._id,
      label: c.label,
      start: c.first_published_at,
      end: c.last_published_at,
      article_count: c.article_count,
      sources: [...new Set(c.articles.map((a) => a.source))]
    }));
    res.json(timelineData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to format timeline data' });
  }
});

// 4. POST /ingest/trigger - Trigger Python scraper script as a background process (Part 2)
app.post('/ingest/trigger', async (req, res) => {
  const jobId = uuidv4();

  try {
    const job = new IngestionJob({ job_id: jobId, status: 'PENDING' });
    await job.save();

    const scriptPath = path.join(__dirname, '../scraper/pipeline.py');
    const pythonProcess = spawn('python3', [scriptPath, jobId]);

    pythonProcess.stdout.on('data', (data) => {
      console.log(`[Python Output]: ${data}`);
    });

    pythonProcess.stderr.on('data', (data) => {
      console.error(`[Python Error]: ${data}`);
    });

    res.status(202).json({ jobId, message: 'Ingestion job triggered successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to trigger ingestion job' });
  }
});

// 5. GET /ingest/status/:jobId - Poll job status (Part 2)
app.get('/ingest/status/:jobId', async (req, res) => {
  try {
    const job = await IngestionJob.findOne({ job_id: req.params.jobId });
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    res.json({ jobId: job.job_id, status: job.status, errorMessage: job.error_message });
  } catch (error) {
    res.status(500).json({ error: 'Failed to check job status' });
  }
});

app.listen(PORT, () => {
  console.log(`Backend Express server running on http://localhost:${PORT}`);
});