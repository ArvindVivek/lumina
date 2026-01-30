'use client'

import { parseAsString, useQueryStates } from 'nuqs'

// Global filters that persist across sections
export function useFilters() {
  return useQueryStates(
    {
      tournament: parseAsString.withDefault(''),
      team: parseAsString.withDefault(''),
    },
    {
      history: 'push',
      shallow: false,
    }
  )
}

// Type for filter values
export type Filters = {
  tournament: string
  team: string
}
