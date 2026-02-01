"use client"

import { createContext, useContext, useState, useCallback, ReactNode } from "react"

// Types for different data that can be on screen
export interface ScreenDataState {
  // Page info
  page: string
  pageTitle?: string

  // IDs for reference
  seriesId?: string
  teamId?: string
  playerId?: string
  tournamentId?: string
  gameId?: string

  // Actual visible data - keyed by component/section
  visibleData: Record<string, unknown>

  // Last updated timestamp
  lastUpdated: number
}

interface ScreenDataContextValue {
  screenData: ScreenDataState

  // Set page-level info
  setPageInfo: (info: { page: string; pageTitle?: string; seriesId?: string; teamId?: string; playerId?: string; tournamentId?: string; gameId?: string }) => void

  // Push data from a component (e.g., a card, table, chart)
  pushData: (key: string, data: unknown) => void

  // Remove data when component unmounts
  removeData: (key: string) => void

  // Clear all data (on page navigation)
  clearData: () => void

  // Get formatted context for chat
  getFormattedContext: () => string
}

const ScreenDataContext = createContext<ScreenDataContextValue | null>(null)

export function ScreenDataProvider({ children }: { children: ReactNode }) {
  const [screenData, setScreenData] = useState<ScreenDataState>({
    page: "dashboard",
    visibleData: {},
    lastUpdated: Date.now(),
  })

  const setPageInfo = useCallback((info: { page: string; pageTitle?: string; seriesId?: string; teamId?: string; playerId?: string; tournamentId?: string; gameId?: string }) => {
    setScreenData(prev => {
      // Only clear visible data if we're changing to a different page type
      // This prevents losing context during navigation
      const isPageChange = prev.page !== info.page
      const isEntityChange = (
        prev.seriesId !== info.seriesId ||
        prev.teamId !== info.teamId ||
        prev.playerId !== info.playerId ||
        prev.tournamentId !== info.tournamentId ||
        prev.gameId !== info.gameId
      )

      return {
        ...prev,
        page: info.page,
        pageTitle: info.pageTitle,
        seriesId: info.seriesId,
        teamId: info.teamId,
        playerId: info.playerId,
        tournamentId: info.tournamentId,
        gameId: info.gameId,
        // Only clear visible data on actual page/entity change
        // Keep previous data briefly to avoid race conditions with chat
        visibleData: (isPageChange || isEntityChange) ? {} : prev.visibleData,
        lastUpdated: Date.now(),
      }
    })
  }, [])

  const pushData = useCallback((key: string, data: unknown) => {
    setScreenData(prev => ({
      ...prev,
      visibleData: {
        ...prev.visibleData,
        [key]: data,
      },
      lastUpdated: Date.now(),
    }))
  }, [])

  const removeData = useCallback((key: string) => {
    setScreenData(prev => {
      const { [key]: _, ...rest } = prev.visibleData
      return {
        ...prev,
        visibleData: rest,
        lastUpdated: Date.now(),
      }
    })
  }, [])

  const clearData = useCallback(() => {
    setScreenData(prev => ({
      ...prev,
      visibleData: {},
      lastUpdated: Date.now(),
    }))
  }, [])

  const getFormattedContext = useCallback(() => {
    const { page, pageTitle, seriesId, teamId, playerId, tournamentId, gameId, visibleData } = screenData

    let context = `## Current Screen: ${pageTitle || page}\n`

    // Add IDs
    if (seriesId) context += `\nSeries ID: ${seriesId}`
    if (teamId) context += `\nTeam ID: ${teamId}`
    if (playerId) context += `\nPlayer ID: ${playerId}`
    if (tournamentId) context += `\nTournament ID: ${tournamentId}`
    if (gameId) context += `\nGame ID: ${gameId}`

    // Add visible data
    if (Object.keys(visibleData).length > 0) {
      context += `\n\n## Data Currently Visible on Screen:\n`

      for (const [key, data] of Object.entries(visibleData)) {
        context += `\n### ${key}:\n`
        context += formatDataForChat(data)
      }
    }

    return context
  }, [screenData])

  return (
    <ScreenDataContext.Provider value={{
      screenData,
      setPageInfo,
      pushData,
      removeData,
      clearData,
      getFormattedContext,
    }}>
      {children}
    </ScreenDataContext.Provider>
  )
}

export function useScreenData() {
  const context = useContext(ScreenDataContext)
  if (!context) {
    throw new Error("useScreenData must be used within a ScreenDataProvider")
  }
  return context
}

// Helper to format data nicely for chat context
function formatDataForChat(data: unknown, depth = 0): string {
  if (depth > 3) return "[nested data]"

  if (data === null || data === undefined) {
    return "N/A"
  }

  if (typeof data === "string" || typeof data === "number" || typeof data === "boolean") {
    return String(data)
  }

  if (Array.isArray(data)) {
    if (data.length === 0) return "[]"
    if (data.length > 10) {
      // Summarize large arrays
      const sample = data.slice(0, 5)
      return `[${sample.map(item => formatDataForChat(item, depth + 1)).join(", ")}... and ${data.length - 5} more]`
    }
    return data.map(item => formatDataForChat(item, depth + 1)).join("\n")
  }

  if (typeof data === "object") {
    const obj = data as Record<string, unknown>
    const entries = Object.entries(obj)

    if (entries.length === 0) return "{}"

    // Format object as key-value pairs
    return entries
      .map(([key, value]) => {
        const formattedKey = key.replace(/_/g, " ").replace(/([A-Z])/g, " $1").trim()
        return `- ${formattedKey}: ${formatDataForChat(value, depth + 1)}`
      })
      .join("\n")
  }

  return String(data)
}
