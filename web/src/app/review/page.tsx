'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface SelfReview {
  results: string;
  how: string;
  growth: string;
  suggestedRating: string;
  ratingJustification: string;
}

interface Stats {
  totalPRs: number;
  strongCount: number;
  moderateCount: number;
}

export default function ReviewPage() {
  const [review, setReview] = useState<SelfReview | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetchReview();
  }, []);

  const fetchReview = async () => {
    try {
      const response = await fetch('/api/review');
      const data = await response.json();
      
      if (data.success) {
        setReview(data.review);
        setStats(data.stats);
      } else {
        setError(data.error || 'Failed to load review');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, section: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(section);
    setTimeout(() => setCopied(null), 2000);
  };

  const copyAll = async () => {
    if (!review) return;
    const fullText = `RESULTS / IMPACT\n\n${review.results}\n\nHOW\n\n${review.how}\n\nGROWTH & DEVELOPMENT\n\n${review.growth}\n\nSUGGESTED RATING: ${review.suggestedRating}\n\n${review.ratingJustification}`;
    await copyToClipboard(fullText, 'all');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-slate-300">Loading review...</span>
        </div>
      </div>
    );
  }

  if (error || !review) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 mb-4">{error || 'No review found'}</div>
          <Link 
            href="/"
            className="text-emerald-400 hover:text-emerald-300 underline"
          >
            Go back to setup
          </Link>
        </div>
      </div>
    );
  }

  const ratingColor = review.suggestedRating === 'Goes the extra mile' 
    ? 'text-emerald-400' 
    : review.suggestedRating === 'Sets a new record'
    ? 'text-amber-400'
    : 'text-slate-300';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-100 mb-2">Your Self Review</h1>
            {stats && (
              <p className="text-slate-400">
                Based on {stats.totalPRs} PRs • {stats.strongCount} strong competencies
              </p>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={copyAll}
              className="px-4 py-2 bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/30 transition-all flex items-center gap-2"
            >
              {copied === 'all' ? (
                <>
                  <CheckIcon /> Copied!
                </>
              ) : (
                <>
                  <CopyIcon /> Copy All
                </>
              )}
            </button>
            <Link
              href="/data"
              className="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-all flex items-center gap-2"
            >
              <DataIcon /> View Data
            </Link>
            <Link
              href="/"
              className="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-all"
            >
              ← Back
            </Link>
          </div>
        </div>

        {/* Rating Badge */}
        <div className="mb-8 p-6 bg-slate-800/50 border border-slate-700 rounded-xl">
          <div className="flex items-center gap-4">
            <div className="text-4xl">⭐</div>
            <div>
              <div className={`text-2xl font-bold ${ratingColor}`}>
                {review.suggestedRating}
              </div>
              <div className="text-slate-400 mt-1">
                {review.ratingJustification}
              </div>
            </div>
          </div>
        </div>

        {/* Sections */}
        <div className="space-y-6">
          <ReviewSection
            title="Results / Impact"
            content={review.results}
            onCopy={() => copyToClipboard(review.results, 'results')}
            copied={copied === 'results'}
          />
          
          <ReviewSection
            title="How (Team Effectiveness)"
            content={review.how}
            onCopy={() => copyToClipboard(review.how, 'how')}
            copied={copied === 'how'}
          />
          
          <ReviewSection
            title="Growth & Development"
            content={review.growth}
            onCopy={() => copyToClipboard(review.growth, 'growth')}
            copied={copied === 'growth'}
          />
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-slate-500 text-sm">
          Generated locally using Ollama • All data stays on your machine
        </div>
      </div>
    </div>
  );
}

function ReviewSection({ 
  title, 
  content, 
  onCopy, 
  copied 
}: { 
  title: string; 
  content: string; 
  onCopy: () => void;
  copied: boolean;
}) {
  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
        <h2 className="text-lg font-semibold text-slate-200">{title}</h2>
        <button
          onClick={onCopy}
          className="px-3 py-1.5 text-sm bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-all flex items-center gap-2"
        >
          {copied ? (
            <>
              <CheckIcon /> Copied
            </>
          ) : (
            <>
              <CopyIcon /> Copy
            </>
          )}
        </button>
      </div>
      <div className="px-6 py-5">
        <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">
          {content}
        </p>
      </div>
    </div>
  );
}

function CopyIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function DataIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
    </svg>
  );
}
