import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { helpTexts } from '../data/helpTexts'

interface QuickHelpModalProps {
  isOpen: boolean
  onClose: () => void
}

const shortcuts = [
  { keys: ['?'], description: 'Open Quick Help' },
  { keys: ['L'], description: 'Toggle Link Mode (Topology)' },
  { keys: ['ESC'], description: 'Cancel / Close modal' },
  { keys: ['Right-click'], description: 'Context menu (Topology)' },
]

export function QuickHelpModal({ isOpen, onClose }: QuickHelpModalProps) {
  const [search, setSearch] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (isOpen) {
      setSearch('')
      setTimeout(() => searchRef.current?.focus(), 50)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const filteredTopics = useMemo(() => {
    if (!search.trim()) return []
    const query = search.toLowerCase()
    return Object.entries(helpTexts)
      .filter(
        ([_key, entry]) =>
          entry.title.toLowerCase().includes(query) ||
          entry.content.toLowerCase().includes(query)
      )
      .slice(0, 8)
  }, [search])

  const handleTopicClick = (helpSection?: string) => {
    if (helpSection) {
      navigate(`/help?section=${helpSection}`)
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-slate-800 border border-slate-600 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 pt-5 pb-3">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-slate-200">Quick Help</h2>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-500 hover:text-slate-300 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search help topics..."
              className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
            />
          </div>
        </div>

        {/* Search Results */}
        {filteredTopics.length > 0 && (
          <div className="px-5 pb-3 max-h-48 overflow-y-auto">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Results</p>
            {filteredTopics.map(([key, entry]) => (
              <button
                key={key}
                type="button"
                onClick={() => handleTopicClick(entry.helpSection)}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-700 transition-colors group"
              >
                <p className="text-sm text-slate-200 group-hover:text-cyan-400">{entry.title}</p>
                <p className="text-xs text-slate-500 truncate">{entry.content}</p>
              </button>
            ))}
          </div>
        )}

        {search.trim() && filteredTopics.length === 0 && (
          <div className="px-5 pb-3">
            <p className="text-sm text-slate-500 text-center py-3">No matching topics found.</p>
          </div>
        )}

        {/* Keyboard Shortcuts */}
        <div className="px-5 py-3 border-t border-slate-700">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Keyboard Shortcuts</p>
          <div className="space-y-1.5">
            {shortcuts.map((s) => (
              <div key={s.description} className="flex items-center justify-between">
                <span className="text-sm text-slate-400">{s.description}</span>
                <div className="flex gap-1">
                  {s.keys.map((key) => (
                    <kbd
                      key={key}
                      className="bg-slate-700 rounded px-1.5 py-0.5 font-mono text-xs text-slate-300 border border-slate-600"
                    >
                      {key}
                    </kbd>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-700 flex justify-between items-center">
          <button
            type="button"
            onClick={() => {
              navigate('/help')
              onClose()
            }}
            className="text-sm text-cyan-500 hover:text-cyan-400 transition-colors"
          >
            Open full documentation &rarr;
          </button>
          <span className="text-xs text-slate-600">
            Press <kbd className="bg-slate-700 rounded px-1 py-0.5 font-mono text-[10px] border border-slate-600">ESC</kbd> to close
          </span>
        </div>
      </div>
    </div>
  )
}
