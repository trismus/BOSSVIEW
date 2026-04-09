import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { helpTexts } from '../data/helpTexts'

interface HelpTooltipProps {
  topic: string
  children: React.ReactNode
  placement?: 'top' | 'bottom' | 'left' | 'right'
}

const placementStyles: Record<string, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
}

export function HelpTooltip({ topic, children, placement = 'top' }: HelpTooltipProps) {
  const [isVisible, setIsVisible] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const navigate = useNavigate()

  // Cleanup pending timeout on unmount — declared before any conditional return
  // to keep hook call order stable (Rules of Hooks).
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  const entry = helpTexts[topic]
  if (!entry) {
    console.warn(`HelpTooltip: unknown topic "${topic}"`)
    return <>{children}</>
  }

  const handleMouseEnter = () => {
    timeoutRef.current = setTimeout(() => setIsVisible(true), 300)
  }

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setIsVisible(false)
  }

  const handleClick = () => {
    if (entry.helpSection) {
      navigate(`/help?section=${entry.helpSection}`)
    }
  }

  return (
    <span className="inline-flex items-center gap-1.5 relative">
      {children}
      <span
        className="relative inline-flex"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <button
          type="button"
          onClick={handleClick}
          className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-600 hover:bg-cyan-600 text-slate-300 hover:text-white text-[10px] font-bold transition-colors cursor-pointer"
          aria-label={`Help: ${entry.title}`}
        >
          ?
        </button>
        {isVisible && (
          <div
            className={`absolute z-50 ${placementStyles[placement]} w-64 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg shadow-xl text-sm text-slate-200 pointer-events-none`}
          >
            <p className="font-medium text-cyan-400 mb-1">{entry.title}</p>
            <p className="text-slate-300 text-xs leading-relaxed">{entry.content}</p>
            {entry.helpSection && (
              <p className="text-cyan-500 text-[10px] mt-1.5">Click ? to learn more</p>
            )}
          </div>
        )}
      </span>
    </span>
  )
}
