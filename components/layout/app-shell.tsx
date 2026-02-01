"use client"

import { useState, useEffect, useCallback } from "react"
import { usePathname } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Bot } from "lucide-react"
import { Sidebar } from "./sidebar"
import { ChatPanel } from "./chat-panel"
import { cn } from "@/lib/utils"
import { useScreenData } from "@/lib/context/screen-data-context"

interface AppShellProps {
  children: React.ReactNode
}

export interface PageContextData {
  page: string
  title: string
  description?: string
  data?: Record<string, string | undefined>
  richContext?: Record<string, unknown>
}

// Derive page context from pathname
function getBasePageContext(pathname: string): PageContextData {
  if (pathname === '/') {
    return { page: 'dashboard', title: 'Dashboard', description: 'Overview of VALORANT analytics data' }
  }
  if (pathname === '/analytics') {
    return { page: 'analytics', title: 'Analytics Hub', description: 'AI-powered coaching insights and analysis' }
  }
  if (pathname.startsWith('/player-analytics')) {
    return { page: 'player-analytics', title: 'Player Analytics', description: 'Individual player performance analysis' }
  }
  if (pathname.startsWith('/macro-review')) {
    return { page: 'macro', title: 'Macro Review', description: 'Team-level tactical analysis' }
  }
  if (pathname.startsWith('/scenario-analysis')) {
    return { page: 'scenarios', title: 'Scenario Analysis', description: 'Historical scenario matching' }
  }
  if (pathname.startsWith('/tournaments')) {
    const match = pathname.match(/\/tournaments\/([^/]+)/)
    if (match) {
      return { page: 'tournament', title: 'Tournament', data: { tournamentId: match[1] } }
    }
    return { page: 'tournaments', title: 'Tournaments', description: 'Browse all tournaments' }
  }
  if (pathname.startsWith('/teams')) {
    const match = pathname.match(/\/teams\/([^/]+)/)
    if (match) {
      return { page: 'team', title: 'Team', data: { teamId: match[1] } }
    }
    return { page: 'teams', title: 'Teams', description: 'Browse all teams' }
  }
  if (pathname.startsWith('/players')) {
    const match = pathname.match(/\/players\/([^/]+)/)
    if (match) {
      return { page: 'player', title: 'Player', data: { playerId: match[1] } }
    }
    return { page: 'players', title: 'Players', description: 'Browse all players' }
  }
  if (pathname.startsWith('/series')) {
    const match = pathname.match(/\/series\/([^/]+)/)
    if (match) {
      return { page: 'series', title: 'Match', data: { seriesId: match[1] } }
    }
    return { page: 'series', title: 'Series', description: 'Match history' }
  }
  if (pathname.startsWith('/game')) {
    const match = pathname.match(/\/game\/([^/]+)/)
    if (match) {
      return { page: 'game', title: 'Game', data: { gameId: match[1] } }
    }
    return { page: 'game', title: 'Game' }
  }
  return { page: 'unknown', title: 'Lumina' }
}

export function AppShell({ children }: AppShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [pageContext, setPageContext] = useState<PageContextData>({ page: 'dashboard', title: 'Dashboard' })
  const pathname = usePathname()
  const { setPageInfo, getFormattedContext } = useScreenData()

  // Fetch rich context when pathname changes
  const fetchRichContext = useCallback(async (baseContext: PageContextData) => {
    // Always sync page info to screen data context
    setPageInfo({
      page: baseContext.page,
      pageTitle: baseContext.title,
      seriesId: baseContext.data?.seriesId,
      teamId: baseContext.data?.teamId,
      playerId: baseContext.data?.playerId,
      tournamentId: baseContext.data?.tournamentId,
      gameId: baseContext.data?.gameId,
    })

    if (!baseContext.data) {
      setPageContext(baseContext)
      return
    }

    try {
      const params = new URLSearchParams({ page: baseContext.page })
      if (baseContext.data.tournamentId) params.set('tournamentId', baseContext.data.tournamentId)
      if (baseContext.data.seriesId) params.set('seriesId', baseContext.data.seriesId)
      if (baseContext.data.teamId) params.set('teamId', baseContext.data.teamId)
      if (baseContext.data.playerId) params.set('playerId', baseContext.data.playerId)

      const response = await fetch(`/api/context?${params.toString()}`)
      if (response.ok) {
        const richContext = await response.json()

        // Update context with rich data
        let updatedTitle = baseContext.title
        let updatedDescription = baseContext.description

        if (richContext.type === 'tournament' && richContext.tournamentName) {
          updatedTitle = richContext.tournamentName
          updatedDescription = `${richContext.matchCount || 0} matches`
        } else if (richContext.type === 'series' && richContext.teamA && richContext.teamB) {
          updatedTitle = `${richContext.teamA} vs ${richContext.teamB}`
          updatedDescription = richContext.tournamentName || 'Match Details'
        } else if (richContext.type === 'team' && richContext.teamName) {
          updatedTitle = richContext.teamName
          updatedDescription = `${richContext.players?.length || 0} players`
        } else if (richContext.type === 'player' && richContext.playerName) {
          updatedTitle = richContext.playerName
          updatedDescription = richContext.teamName || 'Player Stats'
        }

        setPageContext({
          ...baseContext,
          title: updatedTitle,
          description: updatedDescription,
          richContext
        })
      } else {
        setPageContext(baseContext)
      }
    } catch (error) {
      console.error('Failed to fetch rich context:', error)
      setPageContext(baseContext)
    }
  }, [setPageInfo])

  // Update context when pathname changes
  useEffect(() => {
    const baseContext = getBasePageContext(pathname)
    fetchRichContext(baseContext)
  }, [pathname, fetchRichContext])

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Collapsible Sidebar */}
      <Sidebar
        isCollapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Main Content Area - Shrinks when chat is open */}
      <main className={cn(
        "flex-1 overflow-auto min-w-0 relative transition-all duration-300",
        chatOpen && "pr-[420px]"
      )}>
        {/* Content container enables CSS container queries for responsive components */}
        <div className="content-container max-w-[1800px] mx-auto h-full transition-all duration-300">
          {children}
        </div>

        {/* Floating Chat Button - Right Side */}
        <AnimatePresence>
          {!chatOpen && (
            <motion.button
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              onClick={() => setChatOpen(true)}
              className={cn(
                "fixed bottom-6 right-6 z-40",
                "w-14 h-14 rounded-full",
                "bg-valorant-accent hover:bg-valorant-accent/90",
                "shadow-lg shadow-valorant-accent/25 hover:shadow-xl hover:shadow-valorant-accent/30",
                "flex items-center justify-center",
                "transition-shadow duration-200",
                "group"
              )}
              title="Open AI Assistant"
            >
              <Bot className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />

              {/* Pulse animation indicator */}
              <span className="absolute inset-0 rounded-full bg-valorant-accent animate-ping opacity-20" />
            </motion.button>
          )}
        </AnimatePresence>
      </main>

      {/* Persistent Chat Panel - Fixed to right side */}
      <ChatPanel
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        pageContext={pageContext}
      />
    </div>
  )
}
