"use client"

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

export interface PageContext {
  page: string
  title: string
  data?: {
    seriesId?: string
    teamId?: string
    playerId?: string
    tournamentId?: string
    gameId?: string
    teamAName?: string
    teamBName?: string
    playerName?: string
    tournamentName?: string
    mapName?: string
  }
}

interface PageContextValue {
  context: PageContext
  setContext: (context: PageContext) => void
  updateData: (data: Partial<PageContext['data']>) => void
}

const PageContextInstance = createContext<PageContextValue | undefined>(undefined)

export function PageContextProvider({ children }: { children: ReactNode }) {
  const [context, setContextState] = useState<PageContext>({
    page: 'dashboard',
    title: 'Dashboard'
  })

  const setContext = useCallback((newContext: PageContext) => {
    setContextState(newContext)
  }, [])

  const updateData = useCallback((data: Partial<PageContext['data']>) => {
    setContextState(prev => ({
      ...prev,
      data: { ...prev.data, ...data }
    }))
  }, [])

  return (
    <PageContextInstance.Provider value={{ context, setContext, updateData }}>
      {children}
    </PageContextInstance.Provider>
  )
}

export function usePageContext() {
  const ctx = useContext(PageContextInstance)
  if (!ctx) {
    throw new Error('usePageContext must be used within PageContextProvider')
  }
  return ctx
}
