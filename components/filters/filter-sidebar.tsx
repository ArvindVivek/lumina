"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight, X } from "lucide-react"
import { cn } from "@/lib/utils"

export interface FilterOption {
  id: string
  label: string
  count?: number
}

export interface FilterSection {
  id: string
  label: string
  options: FilterOption[]
  multiSelect?: boolean
  defaultExpanded?: boolean
}

interface FilterSidebarProps {
  sections: FilterSection[]
  onFilterChange?: (filters: Record<string, string[]>) => void
  onApply?: () => void
  onReset?: () => void
  className?: string
}

export function FilterSidebar({
  sections,
  onFilterChange,
  onApply,
  onReset,
  className,
}: FilterSidebarProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(
      sections.filter((s) => s.defaultExpanded !== false).map((s) => s.id)
    )
  )
  const [selectedFilters, setSelectedFilters] = useState<
    Record<string, string[]>
  >({})

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections)
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId)
    } else {
      newExpanded.add(sectionId)
    }
    setExpandedSections(newExpanded)
  }

  const handleOptionToggle = (sectionId: string, optionId: string) => {
    const section = sections.find((s) => s.id === sectionId)
    if (!section) return

    const currentSelected = selectedFilters[sectionId] || []

    let newSelected: string[]
    if (section.multiSelect) {
      // Multi-select: toggle option
      if (currentSelected.includes(optionId)) {
        newSelected = currentSelected.filter((id) => id !== optionId)
      } else {
        newSelected = [...currentSelected, optionId]
      }
    } else {
      // Single-select: replace option
      newSelected = currentSelected.includes(optionId) ? [] : [optionId]
    }

    const newFilters = {
      ...selectedFilters,
      [sectionId]: newSelected,
    }
    setSelectedFilters(newFilters)
    onFilterChange?.(newFilters)
  }

  const handleReset = () => {
    setSelectedFilters({})
    onFilterChange?.({})
    onReset?.()
  }

  const activeFilterCount = Object.values(selectedFilters).reduce(
    (acc, arr) => acc + arr.length,
    0
  )

  return (
    <div className={cn("w-[200px] bg-surface border-r border-border h-full flex flex-col", className)}>
      {/* Header */}
      <div className="p-3 border-b border-border flex items-center justify-between">
        <h3 className="label-tactical">Filters</h3>
        {activeFilterCount > 0 && (
          <button
            onClick={handleReset}
            className="text-xs text-text-tertiary hover:text-text-primary transition-fast flex items-center gap-1"
          >
            <X className="h-3 w-3" />
            Clear
          </button>
        )}
      </div>

      {/* Filter Sections */}
      <div className="flex-1 overflow-y-auto">
        {sections.map((section) => {
          const isExpanded = expandedSections.has(section.id)
          const sectionSelected = selectedFilters[section.id] || []

          return (
            <div key={section.id} className="border-b border-border">
              {/* Section Header */}
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center justify-between p-3 hover:bg-surface-hover transition-fast"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-text-secondary uppercase tracking-wide">
                    {section.label}
                  </span>
                  {sectionSelected.length > 0 && (
                    <span className="text-xs text-valorant-accent font-bold">
                      ({sectionSelected.length})
                    </span>
                  )}
                </div>
                {isExpanded ? (
                  <ChevronDown className="h-3 w-3 text-text-tertiary" />
                ) : (
                  <ChevronRight className="h-3 w-3 text-text-tertiary" />
                )}
              </button>

              {/* Section Options */}
              {isExpanded && (
                <div className="px-3 pb-3 space-y-1">
                  {section.options.map((option) => {
                    const isSelected = sectionSelected.includes(option.id)

                    return (
                      <label
                        key={option.id}
                        className="flex items-center gap-2 py-1 cursor-pointer group"
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() =>
                            handleOptionToggle(section.id, option.id)
                          }
                          className="w-3.5 h-3.5 rounded-sm border-border bg-background checked:bg-valorant-accent checked:border-valorant-accent focus:ring-2 focus:ring-valorant-accent focus:ring-offset-1 focus:ring-offset-background transition-fast cursor-pointer"
                        />
                        <span className="text-xs text-text-secondary group-hover:text-text-primary transition-fast flex-1">
                          {option.label}
                        </span>
                        {option.count !== undefined && (
                          <span className="text-xs text-text-muted tabular-nums">
                            {option.count}
                          </span>
                        )}
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Apply Button */}
      {onApply && (
        <div className="p-3 border-t border-border">
          <button
            onClick={onApply}
            className="btn-primary w-full"
            disabled={activeFilterCount === 0}
          >
            Apply
          </button>
        </div>
      )}
    </div>
  )
}
