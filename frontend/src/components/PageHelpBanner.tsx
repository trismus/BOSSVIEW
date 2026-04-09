import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

interface PageHelpBannerProps {
  pageKey: string;
  title: string;
  description: string;
  learnMoreSection?: string;
}

function getStorageKey(pageKey: string): string {
  return `bossview-help-dismissed-${pageKey}`;
}

export function PageHelpBanner({
  pageKey,
  title,
  description,
  learnMoreSection,
}: PageHelpBannerProps) {
  const [isDismissed, setIsDismissed] = useState(true);

  useEffect(() => {
    const dismissed = localStorage.getItem(getStorageKey(pageKey));
    setIsDismissed(dismissed === 'true');
  }, [pageKey]);

  const handleDismiss = () => {
    localStorage.setItem(getStorageKey(pageKey), 'true');
    setIsDismissed(true);
  };

  if (isDismissed) return null;

  return (
    <div className="mb-4 px-4 py-3 bg-cyan-900/20 border border-cyan-800/40 rounded-lg flex items-start gap-3">
      <svg
        className="w-5 h-5 text-cyan-400 mt-0.5 shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z"
        />
      </svg>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-cyan-300">{title}</p>
        <p className="text-xs text-slate-400 mt-0.5">{description}</p>
        {learnMoreSection && (
          <Link
            to={`/help?section=${learnMoreSection}`}
            className="text-xs text-cyan-500 hover:text-cyan-400 mt-1 inline-block transition-colors"
          >
            Learn more &rarr;
          </Link>
        )}
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        className="text-slate-500 hover:text-slate-300 transition-colors p-1"
        aria-label="Dismiss help banner"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
