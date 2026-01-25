'use client';

import { useState, useEffect } from 'react';

type DataType = 'raw' | 'processed' | 'alignment' | 'review';

interface FileStatus {
  raw: boolean;
  processed: boolean;
  alignment: boolean;
  review: boolean;
}

export default function DataViewerPage() {
  const [activeTab, setActiveTab] = useState<DataType>('raw');
  const [data, setData] = useState<Record<string, unknown>>({});
  const [fileStatus, setFileStatus] = useState<FileStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/data');
      const result = await response.json();
      if (result.success) {
        setData({
          raw: result.raw,
          processed: result.processed,
          alignment: result.alignment,
          review: result.review,
        });
        setFileStatus(result.files);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    }
    setLoading(false);
  };

  const copyToClipboard = async () => {
    const content = data[activeTab];
    if (content) {
      await navigator.clipboard.writeText(JSON.stringify(content, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const downloadJson = () => {
    const content = data[activeTab];
    if (content) {
      const blob = new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${activeTab}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const tabs: { id: DataType; label: string; description: string }[] = [
    { id: 'raw', label: 'Raw PRs', description: 'Parsed PR data with Jira context' },
    { id: 'processed', label: 'Summaries', description: 'WHAT/WHY/HOW/IMPACT for each PR' },
    { id: 'alignment', label: 'Alignment', description: 'Framework competency mapping' },
    { id: 'review', label: 'Review', description: 'Final R-H-G output' },
  ];

  const getStats = () => {
    const content = data[activeTab] as Record<string, unknown> | undefined;
    if (!content) return null;

    switch (activeTab) {
      case 'raw':
        return {
          'Total PRs': (content as { totalPRs?: number }).totalPRs || 0,
          'With Jira': ((content as { prs?: Array<{ jiraContext?: unknown }> }).prs || []).filter((p) => p.jiraContext).length,
        };
      case 'processed':
        return {
          'Total Summaries': (content as { totalPRs?: number }).totalPRs || 0,
        };
      case 'alignment':
        const summary = (content as { summary?: { strongCount?: number; moderateCount?: number; totalPRs?: number } }).summary;
        return {
          'Strong Alignments': summary?.strongCount || 0,
          'Moderate': summary?.moderateCount || 0,
          'Total PRs': summary?.totalPRs || 0,
        };
      case 'review':
        return {
          'Rating': (content as { suggestedRating?: string }).suggestedRating || 'N/A',
        };
      default:
        return null;
    }
  };

  const stats = getStats();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700/50 bg-slate-900/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Pipeline Data Viewer</h1>
              <p className="text-slate-400 text-sm mt-1">Inspect all generated JSON files</p>
            </div>
            <div className="flex gap-3">
              <a
                href="/"
                className="px-4 py-2 text-sm text-slate-300 hover:text-white border border-slate-600 rounded-lg hover:border-slate-500 transition-colors"
              >
                ← Setup
              </a>
              <a
                href="/review"
                className="px-4 py-2 text-sm text-white bg-emerald-600 rounded-lg hover:bg-emerald-500 transition-colors"
              >
                View Review →
              </a>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6 p-1 bg-slate-800/50 rounded-xl w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-emerald-600 text-white shadow-lg'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              } ${!fileStatus?.[tab.id] ? 'opacity-50' : ''}`}
            >
              {tab.label}
              {fileStatus?.[tab.id] && (
                <span className="ml-2 w-2 h-2 bg-emerald-400 rounded-full inline-block"></span>
              )}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="bg-slate-800/30 rounded-2xl border border-slate-700/50 overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50 bg-slate-800/50">
            <div>
              <h2 className="text-lg font-semibold text-white">
                {tabs.find((t) => t.id === activeTab)?.label}
              </h2>
              <p className="text-sm text-slate-400">
                {tabs.find((t) => t.id === activeTab)?.description}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* Stats */}
              {stats && (
                <div className="flex gap-4 mr-4">
                  {Object.entries(stats).map(([key, value]) => (
                    <div key={key} className="text-center">
                      <div className="text-lg font-bold text-emerald-400">{value}</div>
                      <div className="text-xs text-slate-500">{key}</div>
                    </div>
                  ))}
                </div>
              )}
              {/* Actions */}
              <button
                onClick={copyToClipboard}
                disabled={!data[activeTab]}
                className="flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:text-white border border-slate-600 rounded-lg hover:border-slate-500 transition-colors disabled:opacity-50"
              >
                {copied ? (
                  <>
                    <CheckIcon /> Copied!
                  </>
                ) : (
                  <>
                    <CopyIcon /> Copy
                  </>
                )}
              </button>
              <button
                onClick={downloadJson}
                disabled={!data[activeTab]}
                className="flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:text-white border border-slate-600 rounded-lg hover:border-slate-500 transition-colors disabled:opacity-50"
              >
                <DownloadIcon /> Download
              </button>
              <button
                onClick={fetchData}
                className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors"
              >
                <RefreshIcon /> Refresh
              </button>
            </div>
          </div>

          {/* JSON Viewer */}
          <div className="p-6 max-h-[70vh] overflow-auto">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
              </div>
            ) : data[activeTab] ? (
              <JsonViewer data={data[activeTab]} />
            ) : (
              <div className="text-center py-20">
                <div className="text-slate-500 text-lg mb-2">No data available</div>
                <p className="text-slate-600 text-sm">
                  Run the pipeline first to generate this file.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

// JSON Viewer Component with syntax highlighting
function JsonViewer({ data }: { data: unknown }) {
  const renderValue = (value: unknown, depth: number = 0): JSX.Element => {
    if (value === null) {
      return <span className="text-slate-500">null</span>;
    }

    if (typeof value === 'string') {
      // Check if it's a URL
      if (value.startsWith('http')) {
        return (
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-400 hover:text-emerald-300 hover:underline break-all"
          >
            "{value}"
          </a>
        );
      }
      return <span className="text-amber-400 break-all">"{value}"</span>;
    }

    if (typeof value === 'number') {
      return <span className="text-cyan-400">{value}</span>;
    }

    if (typeof value === 'boolean') {
      return <span className="text-purple-400">{value.toString()}</span>;
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return <span className="text-slate-500">[]</span>;
      }
      return (
        <div className="pl-4 border-l border-slate-700/50">
          <span className="text-slate-500">[</span>
          {value.map((item, index) => (
            <div key={index} className="pl-2">
              <span className="text-slate-600 text-xs mr-2">{index}</span>
              {renderValue(item, depth + 1)}
              {index < value.length - 1 && <span className="text-slate-500">,</span>}
            </div>
          ))}
          <span className="text-slate-500">]</span>
        </div>
      );
    }

    if (typeof value === 'object') {
      const entries = Object.entries(value as Record<string, unknown>);
      if (entries.length === 0) {
        return <span className="text-slate-500">{'{}'}</span>;
      }
      return (
        <div className={depth > 0 ? 'pl-4 border-l border-slate-700/50' : ''}>
          <span className="text-slate-500">{'{'}</span>
          {entries.map(([key, val], index) => (
            <div key={key} className="pl-2 py-0.5">
              <span className="text-sky-400">"{key}"</span>
              <span className="text-slate-500">: </span>
              {renderValue(val, depth + 1)}
              {index < entries.length - 1 && <span className="text-slate-500">,</span>}
            </div>
          ))}
          <span className="text-slate-500">{'}'}</span>
        </div>
      );
    }

    return <span className="text-slate-400">{String(value)}</span>;
  };

  return (
    <pre className="font-mono text-sm leading-relaxed text-slate-300">
      {renderValue(data)}
    </pre>
  );
}

// Icons
function CopyIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}
