"use client"

import Image from "next/image"
import { Map } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  getMapImage,
  hasMapImage,
  getMapGradient,
  formatMapName,
} from "@/lib/valorant-assets"

interface MapImageProps {
  mapName: string
  size?: "sm" | "md" | "lg" | "full"
  showOverlay?: boolean
  showName?: boolean
  className?: string
  children?: React.ReactNode
}

const sizeConfig = {
  sm: { container: "h-16 w-24", text: "text-xs" },
  md: { container: "h-24 w-36", text: "text-sm" },
  lg: { container: "h-32 w-48", text: "text-base" },
  full: { container: "h-full w-full", text: "text-lg" },
}

export function MapImage({
  mapName,
  size = "md",
  showOverlay = true,
  showName = true,
  className,
  children,
}: MapImageProps) {
  const hasImage = hasMapImage(mapName)
  const imagePath = getMapImage(mapName)
  const gradient = getMapGradient(mapName)
  const config = sizeConfig[size]

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg group",
        config.container,
        className
      )}
    >
      {/* Background */}
      {hasImage && imagePath ? (
        <Image
          src={imagePath}
          alt={formatMapName(mapName)}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-300"
        />
      ) : (
        <div className={cn("absolute inset-0 bg-gradient-to-br", gradient)} />
      )}

      {/* Overlay gradient for text readability */}
      {showOverlay && (
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
      )}

      {/* Fallback icon when no image */}
      {!hasImage && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Map className="h-8 w-8 text-text-tertiary opacity-50" />
        </div>
      )}

      {/* Map name */}
      {showName && (
        <div className="absolute bottom-2 left-2 right-2">
          <span className={cn("font-semibold text-white", config.text)}>
            {formatMapName(mapName)}
          </span>
        </div>
      )}

      {/* Custom children for overlays */}
      {children}
    </div>
  )
}

interface MapCardProps {
  mapName: string
  wins?: number
  losses?: number
  winRate?: number
  onClick?: () => void
  className?: string
}

export function MapCard({
  mapName,
  wins,
  losses,
  winRate,
  onClick,
  className,
}: MapCardProps) {
  const hasWinData = wins !== undefined && losses !== undefined

  // Determine border color based on win rate
  const getBorderColor = () => {
    if (!winRate) return "border-border"
    if (winRate >= 60) return "border-win/50"
    if (winRate < 40) return "border-loss/50"
    return "border-warning/50"
  }

  return (
    <div
      onClick={onClick}
      className={cn(
        "relative overflow-hidden rounded-xl border transition-all cursor-pointer",
        "hover:scale-[1.02] hover:shadow-lg",
        getBorderColor(),
        className
      )}
    >
      <MapImage mapName={mapName} size="lg" showName={false}>
        {/* Stats overlay */}
        <div className="absolute inset-0 flex flex-col justify-between p-3">
          {/* Top row - games count */}
          {hasWinData && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/70">
                {wins! + losses!} games
              </span>
              {winRate !== undefined && (
                <span
                  className={cn(
                    "text-xs font-bold px-1.5 py-0.5 rounded",
                    winRate >= 60 ? "bg-win/20 text-win" :
                    winRate < 40 ? "bg-loss/20 text-loss" :
                    "bg-warning/20 text-warning"
                  )}
                >
                  {winRate.toFixed(0)}%
                </span>
              )}
            </div>
          )}

          {/* Bottom row - map name and record */}
          <div>
            <h3 className="text-lg font-bold text-white mb-1">
              {formatMapName(mapName)}
            </h3>
            {hasWinData && (
              <span className="text-sm text-white/70">
                {wins}W - {losses}L
              </span>
            )}
          </div>
        </div>
      </MapImage>
    </div>
  )
}
