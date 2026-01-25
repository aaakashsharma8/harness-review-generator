'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface FormData {
  userId: string;
  repoUrls: string;
  roleLevel: string;
  dateFrom: string;
  dateTo: string;
}

export default function SetupPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string[]>([]);
  
  const [formData, setFormData] = useState<FormData>({
    userId: '1374',
    repoUrls: 'https://harness0.harness.io/ng/account/l7B_kbSEQD2wjrM7PShm5w/module/code/orgs/PROD/projects/Harness_Commons/repos/harness-core-ui',
    roleLevel: 'SSE1',
    dateFrom: '',
    dateTo: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setProgress(['Starting pipeline...']);

    try {
      const response = await fetch('/api/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: formData.userId,
          repoUrls: formData.repoUrls.split('\n').map(s => s.trim()).filter(Boolean),
          roleLevel: formData.roleLevel,
          createdAfter: formData.dateFrom || undefined,
          createdBefore: formData.dateTo || undefined,
        }),
      });

      const result = await response.json();

      if (result.success) {
        router.push('/review');
      } else {
        setError(result.error || 'Pipeline failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-2xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent mb-3">
            Self Review Generator
          </h1>
          <p className="text-slate-400 text-lg">
            AI-powered performance review from your merged PRs
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* User ID */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              User ID
            </label>
            <input
              type="text"
              value={formData.userId}
              onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
              className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
              placeholder="e.g., 1374"
              required
            />
          </div>

          {/* Role Level */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Role Level
            </label>
            <select
              value={formData.roleLevel}
              onChange={(e) => setFormData({ ...formData, roleLevel: e.target.value })}
              className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
            >
              <optgroup label="Software Engineer">
                <option value="SE1">Software Engineer 1 (SE1)</option>
                <option value="SE2">Software Engineer 2 (SE2)</option>
              </optgroup>
              <optgroup label="Senior Software Engineer">
                <option value="SSE1">Senior Software Engineer 1 (SSE1)</option>
                <option value="SSE2">Senior Software Engineer 2 (SSE2)</option>
              </optgroup>
              <optgroup label="Staff Engineer">
                <option value="Staff1">Staff Engineer 1</option>
                <option value="Staff2">Staff Engineer 2</option>
              </optgroup>
              <optgroup label="Principal & Above">
                <option value="Principal">Principal Engineer</option>
                <option value="Architect">Architect</option>
                <option value="Distinguished">Distinguished Engineer</option>
              </optgroup>
            </select>
          </div>

          {/* Repo URLs */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Repository URLs
              <span className="text-slate-500 font-normal ml-2">(one per line)</span>
            </label>
            <textarea
              value={formData.repoUrls}
              onChange={(e) => setFormData({ ...formData, repoUrls: e.target.value })}
              rows={3}
              className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all font-mono text-sm"
              placeholder="https://..."
              required
            />
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                From Date
                <span className="text-slate-500 font-normal ml-2">(optional)</span>
              </label>
              <input
                type="date"
                value={formData.dateFrom}
                onChange={(e) => setFormData({ ...formData, dateFrom: e.target.value })}
                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                To Date
                <span className="text-slate-500 font-normal ml-2">(optional)</span>
              </label>
              <input
                type="date"
                value={formData.dateTo}
                onChange={(e) => setFormData({ ...formData, dateTo: e.target.value })}
                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
              {error}
            </div>
          )}

          {/* Progress */}
          {isLoading && progress.length > 0 && (
            <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-slate-300 font-medium">Processing...</span>
              </div>
              <div className="text-sm text-slate-500 font-mono">
                {progress[progress.length - 1]}
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-semibold rounded-lg hover:from-emerald-600 hover:to-cyan-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isLoading ? 'Running Pipeline...' : 'Generate Self Review'}
            </button>
          </div>
        </form>

        {/* Quick Links */}
        <div className="mt-8 flex gap-4 justify-center">
          <a
            href="/review"
            className="px-6 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-300 hover:text-white hover:border-slate-600 transition-all flex items-center gap-2"
          >
            <span>📝</span> View Review
          </a>
          <a
            href="/data"
            className="px-6 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-300 hover:text-white hover:border-slate-600 transition-all flex items-center gap-2"
          >
            <span>📊</span> View Pipeline Data
          </a>
        </div>

        {/* Info */}
        <div className="mt-8 p-6 bg-slate-800/30 border border-slate-700/50 rounded-lg">
          <h3 className="text-slate-300 font-semibold mb-3">How it works</h3>
          <ol className="text-slate-400 text-sm space-y-2">
            <li className="flex gap-3">
              <span className="text-emerald-400 font-mono">1.</span>
              Fetches your merged PRs from Harness Code → <code className="text-slate-500">raw.json</code>
            </li>
            <li className="flex gap-3">
              <span className="text-emerald-400 font-mono">2.</span>
              Parses each PR and fetches linked Jira tickets
            </li>
            <li className="flex gap-3">
              <span className="text-emerald-400 font-mono">3.</span>
              Summarizes work using local LLM → <code className="text-slate-500">processed.json</code>
            </li>
            <li className="flex gap-3">
              <span className="text-emerald-400 font-mono">4.</span>
              Aligns to career framework → <code className="text-slate-500">alignment.json</code>
            </li>
            <li className="flex gap-3">
              <span className="text-emerald-400 font-mono">5.</span>
              Generates R-H-G self-review → <code className="text-slate-500">self-review.json</code>
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
