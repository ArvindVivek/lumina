"use client"

import { useEffect, useRef, useMemo } from "react"
import { useScreenData } from "@/lib/context/screen-data-context"

/**
 * Hook for components to push their visible data to the screen context.
 * Data is automatically removed when the component unmounts.
 *
 * @param key - Unique key for this data (e.g., "player-stats", "match-overview")
 * @param data - The data to make available to the chat
 * @param enabled - Whether to push data (useful for conditional rendering)
 */
export function usePushScreenData(key: string, data: unknown, enabled = true) {
  const { pushData, removeData } = useScreenData()

  // Memoize the serialized data to get a stable reference
  const serializedData = useMemo(() => {
    if (!enabled || data === undefined || data === null) {
      return null
    }
    return JSON.stringify(data)
  }, [enabled, data])

  // Track what we've pushed
  const pushedRef = useRef<string | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true

    // Only update if the serialized data actually changed
    if (serializedData !== pushedRef.current) {
      pushedRef.current = serializedData

      if (serializedData !== null) {
        pushData(key, data)
      }
    }

    return () => {
      mountedRef.current = false
      // Only clean up on unmount
      removeData(key)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, serializedData])
}

/**
 * Hook for page components to set page-level info.
 * Call this at the top of page components.
 */
export function useSetPageInfo(info: {
  page: string
  pageTitle?: string
  seriesId?: string
  teamId?: string
  playerId?: string
  tournamentId?: string
  gameId?: string
}) {
  const { setPageInfo } = useScreenData()

  useEffect(() => {
    setPageInfo(info)
  }, [
    info.page,
    info.pageTitle,
    info.seriesId,
    info.teamId,
    info.playerId,
    info.tournamentId,
    info.gameId,
    setPageInfo,
  ])
}
