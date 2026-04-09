import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { helpSections, type HelpSection, type HelpSubSection } from '../data/helpContent';

// ─── Markdown-like renderer ─────────────────────────────────

function renderContent(content: string) {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];
  let tableRows: string[][] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul
          key={`list-${elements.length}`}
          className="list-disc list-inside space-y-1 text-slate-300 text-sm mb-3"
        >
          {listItems.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </ul>,
      );
      listItems = [];
    }
  };

  const flushTable = () => {
    if (tableRows.length > 0) {
      const headers = tableRows[0];
      const body = tableRows.slice(1);
      elements.push(
        <div key={`table-${elements.length}`} className="overflow-x-auto mb-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                {headers.map((h, i) => (
                  <th key={i} className="text-left py-1.5 px-2 text-cyan-400 font-medium">
                    {renderInline(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((row, ri) => (
                <tr key={ri} className="border-b border-slate-800">
                  {row.map((cell, ci) => (
                    <td key={ci} className="py-1.5 px-2 text-slate-300">
                      {renderInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      tableRows = [];
    }
  };

  const flushCode = () => {
    if (codeLines.length > 0) {
      elements.push(
        <pre
          key={`code-${elements.length}`}
          className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-sm text-cyan-300 font-mono overflow-x-auto mb-3"
        >
          {codeLines.join('\n')}
        </pre>,
      );
      codeLines = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code blocks
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        inCodeBlock = false;
        flushCode();
      } else {
        flushList();
        flushTable();
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    // Table rows
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      flushList();
      const cells = line
        .split('|')
        .slice(1, -1)
        .map((c) => c.trim());
      // Skip separator rows (|---|---|)
      if (cells.every((c) => /^[-:]+$/.test(c))) continue;
      tableRows.push(cells);
      continue;
    } else {
      flushTable();
    }

    // List items
    if (line.trim().startsWith('- ')) {
      listItems.push(line.trim().slice(2));
      continue;
    } else {
      flushList();
    }

    // Numbered list items
    if (/^\d+\.\s/.test(line.trim())) {
      const text = line.trim().replace(/^\d+\.\s/, '');
      listItems.push(text);
      continue;
    } else if (listItems.length > 0 && line.trim() === '') {
      flushList();
      continue;
    }

    // Empty lines
    if (line.trim() === '') {
      continue;
    }

    // Tip/info boxes
    if (line.trim().startsWith('`Tip:`')) {
      const text = line.trim().replace(/^`Tip:`\s*/, '');
      elements.push(
        <div
          key={`tip-${elements.length}`}
          className="bg-cyan-900/20 border border-cyan-800/40 rounded-lg px-4 py-2.5 text-sm text-cyan-300 mb-3 flex items-start gap-2"
        >
          <span className="text-cyan-400 font-medium shrink-0">Tip:</span>
          <span>{renderInline(text)}</span>
        </div>,
      );
      continue;
    }

    // Headings (within content)
    if (line.trim().startsWith('**') && line.trim().endsWith('**')) {
      const text = line.trim().slice(2, -2);
      elements.push(
        <h4
          key={`h4-${elements.length}`}
          className="text-sm font-semibold text-slate-200 mt-4 mb-2"
        >
          {text}
        </h4>,
      );
      continue;
    }

    // Regular paragraphs
    elements.push(
      <p key={`p-${elements.length}`} className="text-sm text-slate-300 leading-relaxed mb-3">
        {renderInline(line)}
      </p>,
    );
  }

  flushList();
  flushTable();
  flushCode();

  return elements;
}

function renderInline(text: string): React.ReactNode {
  // Process bold, inline code, and links
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let keyIdx = 0;

  while (remaining.length > 0) {
    // Bold
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    // Inline code
    const codeMatch = remaining.match(/`(.+?)`/);

    const matches: Array<{ type: string; match: RegExpMatchArray }> = [];
    if (boldMatch?.index !== undefined) matches.push({ type: 'bold', match: boldMatch });
    if (codeMatch?.index !== undefined) matches.push({ type: 'code', match: codeMatch });

    if (matches.length === 0) {
      parts.push(remaining);
      break;
    }

    // Pick the earliest match
    matches.sort((a, b) => (a.match.index ?? 0) - (b.match.index ?? 0));
    const earliest = matches[0];
    const idx = earliest.match.index ?? 0;

    if (idx > 0) {
      parts.push(remaining.slice(0, idx));
    }

    if (earliest.type === 'bold') {
      parts.push(
        <strong key={`b-${keyIdx++}`} className="text-slate-200 font-semibold">
          {earliest.match[1]}
        </strong>,
      );
    } else if (earliest.type === 'code') {
      parts.push(
        <code
          key={`c-${keyIdx++}`}
          className="bg-slate-700 rounded px-1.5 py-0.5 font-mono text-xs text-cyan-300"
        >
          {earliest.match[1]}
        </code>,
      );
    }

    remaining = remaining.slice(idx + earliest.match[0].length);
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

// ─── HelpPage Component ────────────────────────────────────

export function HelpPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeSection, setActiveSection] = useState(
    searchParams.get('section') ?? 'getting-started',
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(helpSections.map((s) => s.id)),
  );

  // Sync from URL params
  useEffect(() => {
    const section = searchParams.get('section');
    if (section) {
      setActiveSection(section);
    }
  }, [searchParams]);

  const handleSectionClick = (sectionId: string) => {
    setActiveSection(sectionId);
    setSearchParams({ section: sectionId });
  };

  const toggleSidebarSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  // Search across all help content
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const query = searchQuery.toLowerCase();
    const results: Array<{ section: HelpSection; subsection: HelpSubSection }> = [];

    for (const section of helpSections) {
      for (const sub of section.subsections) {
        if (sub.title.toLowerCase().includes(query) || sub.content.toLowerCase().includes(query)) {
          results.push({ section, subsection: sub });
        }
      }
    }

    return results;
  }, [searchQuery]);

  const currentSection = helpSections.find((s) => s.id === activeSection);

  return (
    <div className="flex h-[calc(100vh-8rem)] text-slate-200 rounded-xl border border-slate-700 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-72 bg-slate-800 border-r border-slate-700 flex flex-col shrink-0">
        {/* Search */}
        <div className="p-3 border-b border-slate-700">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
              />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search documentation..."
              className="w-full pl-10 pr-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
            />
          </div>
        </div>

        {/* Nav sections */}
        <nav className="flex-1 overflow-y-auto py-2">
          {helpSections.map((section) => {
            const isActive = section.id === activeSection;
            const isExpanded = expandedSections.has(section.id);

            return (
              <div key={section.id}>
                <button
                  type="button"
                  onClick={() => {
                    handleSectionClick(section.id);
                    if (!isExpanded) toggleSidebarSection(section.id);
                  }}
                  className={`w-full flex items-center gap-2.5 px-4 py-2 text-sm font-medium transition-colors text-left ${
                    isActive
                      ? 'text-cyan-400 bg-slate-700/50'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/30'
                  }`}
                >
                  <span className="text-base">{section.icon}</span>
                  <span className="flex-1">{section.title}</span>
                  <svg
                    className={`w-3.5 h-3.5 text-slate-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSidebarSection(section.id);
                    }}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="m8.25 4.5 7.5 7.5-7.5 7.5"
                    />
                  </svg>
                </button>

                {isExpanded && (
                  <div className="ml-9 border-l border-slate-700">
                    {section.subsections.map((sub) => (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => {
                          handleSectionClick(section.id);
                          // Scroll to subsection
                          setTimeout(() => {
                            document
                              .getElementById(`help-${sub.id}`)
                              ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }, 50);
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
                      >
                        {sub.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-slate-900">
        <div className="max-w-3xl mx-auto px-8 py-6">
          {/* Search results mode */}
          {searchResults !== null ? (
            <>
              <h2 className="text-xl font-bold text-slate-200 mb-4">
                Search Results
                <span className="text-sm font-normal text-slate-500 ml-2">
                  {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for &ldquo;
                  {searchQuery}&rdquo;
                </span>
              </h2>

              {searchResults.length === 0 ? (
                <div className="text-center py-12">
                  <svg
                    className="w-12 h-12 text-slate-600 mx-auto mb-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
                    />
                  </svg>
                  <p className="text-slate-500 text-sm">
                    No results found. Try a different search term.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {searchResults.map(({ section, subsection }) => (
                    <button
                      key={`${section.id}-${subsection.id}`}
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        handleSectionClick(section.id);
                        setTimeout(() => {
                          document
                            .getElementById(`help-${subsection.id}`)
                            ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }, 50);
                      }}
                      className="w-full text-left p-4 bg-slate-800 border border-slate-700 rounded-lg hover:border-cyan-800/50 transition-colors"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm">{section.icon}</span>
                        <span className="text-xs text-slate-500">{section.title}</span>
                      </div>
                      <p className="text-sm font-medium text-slate-200">{subsection.title}</p>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                        {subsection.content.slice(0, 150)}...
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : currentSection ? (
            <>
              {/* Section header */}
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-700">
                <span className="text-2xl">{currentSection.icon}</span>
                <h2 className="text-2xl font-bold text-slate-100">{currentSection.title}</h2>
              </div>

              {/* Subsections */}
              <div className="space-y-8">
                {currentSection.subsections.map((sub) => (
                  <section key={sub.id} id={`help-${sub.id}`} className="scroll-mt-4">
                    <h3 className="text-lg font-semibold text-slate-200 mb-3 flex items-center gap-2">
                      <span className="w-1 h-5 bg-cyan-500 rounded-full" />
                      {sub.title}
                    </h3>
                    <div className="pl-3">{renderContent(sub.content)}</div>
                  </section>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <p className="text-slate-500">Select a section from the sidebar.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
