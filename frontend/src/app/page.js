'use client';

import React, { useState, useEffect } from 'react';
import { RefreshCw, ExternalLink, Filter, Calendar, Newspaper, Clock } from 'lucide-react';

export default function NewsPulseDashboard() {
  const [clusters, setClusters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCluster, setSelectedCluster] = useState(null);
  const [selectedSources, setSelectedSources] = useState(['BBC News', 'NPR', 'The Guardian']);
  const [refreshing, setRefreshing] = useState(false);
  const [jobStatus, setJobStatus] = useState('');

  const API_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5001';

  const fetchTimelineData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/timeline`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setClusters(data);
      }
    } catch (err) {
      console.error("Failed to fetch timeline data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimelineData();
  }, []);

  const handleSourceToggle = (source) => {
    setSelectedSources(prev => 
      prev.includes(source) ? prev.filter(s => s !== source) : [...prev, source]
    );
  };

  const handleClusterClick = async (id) => {
    try {
      const res = await fetch(`${API_URL}/clusters/${id}`);
      const data = await res.json();
      if (data && !data.error) {
        setSelectedCluster(data);
      }
    } catch (err) {
      console.error("Failed to fetch cluster details:", err);
    }
  };

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      setJobStatus('Triggering scraper pipeline...');
      const res = await fetch(`${API_URL}/ingest/trigger`, { method: 'POST' });
      const data = await res.json();

      if (data.jobId) {
        pollStatus(data.jobId);
      }
    } catch (err) {
      console.error("Failed to trigger refresh:", err);
      setRefreshing(false);
      setJobStatus('');
    }
  };

  const pollStatus = (jobId) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/ingest/status/${jobId}`);
        const data = await res.json();
        
        setJobStatus(`Status: ${data.status}`);

        if (data.status === 'COMPLETED' || data.status === 'FAILED') {
          clearInterval(interval);
          setRefreshing(false);
          setJobStatus('');
          fetchTimelineData();
        }
      } catch (err) {
        clearInterval(interval);
        setRefreshing(false);
      }
    }, 2000);
  };

  const filteredClusters = clusters.filter(c => 
    c.sources && c.sources.some(s => selectedSources.includes(s))
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-6 md:p-10">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-teal-400 bg-clip-text text-transparent">
            News Pulse
          </h1>
          <p className="text-slate-400 text-sm mt-1">Topic-Clustered News Timeline Visualization</p>
        </div>

        <div className="flex items-center gap-4">
          {jobStatus && <span className="text-xs text-amber-400 bg-amber-400/10 px-3 py-1 rounded-full">{jobStatus}</span>}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-medium px-4 py-2 rounded-lg transition-all cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Processing...' : 'Refresh Data'}
          </button>
        </div>
      </header>

      {/* Filters */}
      <div className="mb-8 bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center gap-6">
        <div className="flex items-center gap-2 text-slate-400 text-sm font-medium">
          <Filter className="w-4 h-4" />
          Filter Outlets:
        </div>
        <div className="flex gap-3">
          {['BBC News', 'NPR', 'The Guardian'].map(source => (
            <button
              key={source}
              onClick={() => handleSourceToggle(source)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-md border transition-all cursor-pointer ${
                selectedSources.includes(source)
                  ? 'bg-blue-500/20 border-blue-500 text-blue-300'
                  : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300'
              }`}
            >
              {source}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Timeline Chart View */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-6 flex items-center gap-2 text-slate-200">
            <Calendar className="w-5 h-5 text-blue-400" />
            Topic Cluster Activity Window
          </h2>

          {loading ? (
            <div className="h-64 flex items-center justify-center text-slate-500">Loading Clusters...</div>
          ) : filteredClusters.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-slate-500">No clusters match selected filters.</div>
          ) : (
            <div className="space-y-4">
              {filteredClusters.map(cluster => (
                <div
                  key={cluster.id}
                  onClick={() => handleClusterClick(cluster.id)}
                  className="group cursor-pointer bg-slate-950 hover:bg-slate-800/60 border border-slate-800 hover:border-blue-500/50 p-4 rounded-lg transition-all"
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold text-blue-400 group-hover:text-blue-300">{cluster.label}</span>
                    <span className="text-xs bg-slate-800 px-2.5 py-0.5 rounded-full text-slate-300">
                      {cluster.article_count} Articles
                    </span>
                  </div>

                  {/* Visual Bar Span */}
                  <div className="w-full bg-slate-900 h-3 rounded-full overflow-hidden relative my-2 border border-slate-800">
                    <div 
                      className="bg-gradient-to-r from-blue-500 to-teal-400 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(20, cluster.article_count * 15))}%` }}
                    />
                  </div>

                  <div className="flex justify-between items-center text-xs text-slate-500 mt-2">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Active: {cluster.start ? new Date(cluster.start).toLocaleDateString() : 'N/A'}
                    </span>
                    <div className="flex gap-2">
                      {cluster.sources && cluster.sources.map(s => (
                        <span key={s} className="bg-slate-900 px-2 py-0.5 rounded text-[10px] text-slate-400 border border-slate-800">{s}</span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cluster Inspector Drawer */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-slate-200">
            <Newspaper className="w-5 h-5 text-teal-400" />
            Cluster Inspector
          </h2>

          {!selectedCluster ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-500 text-center">
              <p>Click on any topic cluster on the timeline to view its articles.</p>
            </div>
          ) : (
            <div>
              <div className="border-b border-slate-800 pb-4 mb-4">
                <h3 className="text-xl font-bold text-teal-300">{selectedCluster.label}</h3>
                <p className="text-xs text-slate-400 mt-1">{selectedCluster.article_count || 0} linked stories aggregated chronologically</p>
              </div>

              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                {selectedCluster.articles && selectedCluster.articles.length > 0 ? (
                  selectedCluster.articles.map((art, idx) => (
                    <div key={idx} className="bg-slate-950 border border-slate-800 p-3 rounded-lg hover:border-slate-700 transition-all">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-teal-400">{art.source}</span>
                      <h4 className="text-sm font-semibold text-slate-200 mt-1 leading-snug">{art.title}</h4>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">{art.summary}</p>
                      <div className="flex justify-between items-center mt-3 pt-2 border-t border-slate-900 text-[10px] text-slate-500">
                        <span>{art.published_at ? new Date(art.published_at).toLocaleString() : ''}</span>
                        {art.url && (
                          <a
                            href={art.url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 text-blue-400 hover:text-blue-300"
                          >
                            Source <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-500 text-xs">No article list available for this cluster.</p>
                )}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}