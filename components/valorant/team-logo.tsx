"use client"

import Image from "next/image"
import { Users } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  getTeamLogo,
  getTeamInfo,
  getTeamShortName,
  getTeamColors,
} from "@/lib/valorant-assets"

interface TeamLogoProps {
  teamName: string
  size?: "sm" | "md" | "lg" | "xl"
  showName?: boolean
  showShortName?: boolean
  className?: string
}

const sizeConfig = {
  sm: { container: "h-6 w-6", icon: 16, text: "text-xs" },
  md: { container: "h-10 w-10", icon: 24, text: "text-sm" },
  lg: { container: "h-14 w-14", icon: 32, text: "text-base" },
  xl: { container: "h-20 w-20", icon: 48, text: "text-lg" },
}

export function TeamLogo({
  teamName,
  size = "md",
  showName = false,
  showShortName = false,
  className,
}: TeamLogoProps) {
  const logoPath = getTeamLogo(teamName)
  const teamInfo = getTeamInfo(teamName)
  const shortName = getTeamShortName(teamName)
  const colors = getTeamColors(teamName)
  const config = sizeConfig[size]

  const hasLogo = !!logoPath

  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      {/* Logo container */}
      <div
        className={cn(
          "relative rounded-lg overflow-hidden flex items-center justify-center border border-border/50",
          config.container,
          !hasLogo && "bg-surface-hover"
        )}
        style={
          hasLogo
            ? undefined
            : {
                background: `linear-gradient(135deg, ${colors.primary}20, ${colors.secondary}20)`,
              }
        }
      >
        {hasLogo ? (
          <Image
            src={logoPath}
            alt={teamName}
            width={config.icon}
            height={config.icon}
            className="object-contain"
          />
        ) : (
          <div className="flex items-center justify-center w-full h-full">
            {teamInfo ? (
              <span
                className={cn("font-bold", config.text)}
                style={{ color: colors.primary }}
              >
                {shortName.substring(0, 2)}
              </span>
            ) : (
              <Users
                className="text-text-tertiary"
                style={{ width: config.icon / 2, height: config.icon / 2 }}
              />
            )}
          </div>
        )}
      </div>

      {/* Team name */}
      {(showName || showShortName) && (
        <div className="flex flex-col">
          {showName && (
            <span className={cn("font-semibold text-text-primary", config.text)}>
              {teamName}
            </span>
          )}
          {showShortName && !showName && (
            <span className={cn("font-bold text-text-primary", config.text)}>
              {shortName}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

interface TeamBadgeProps {
  teamName: string
  isWinner?: boolean
  score?: number
  className?: string
}

export function TeamBadge({
  teamName,
  isWinner = false,
  score,
  className,
}: TeamBadgeProps) {
  const shortName = getTeamShortName(teamName)
  const colors = getTeamColors(teamName)

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border",
        isWinner ? "border-win/30 bg-win/10" : "border-border/50 bg-surface",
        className
      )}
    >
      <TeamLogo teamName={teamName} size="sm" />
      <span className={cn("font-bold", isWinner ? "text-win" : "text-text-primary")}>
        {shortName}
      </span>
      {score !== undefined && (
        <span
          className={cn(
            "font-bold text-lg tabular-nums ml-1",
            isWinner ? "text-win" : "text-text-secondary"
          )}
        >
          {score}
        </span>
      )}
    </div>
  )
}

interface TeamVsProps {
  teamA: string
  teamB: string
  scoreA?: number
  scoreB?: number
  winnerId?: string
  teamAId?: string
  teamBId?: string
  className?: string
}

export function TeamVs({
  teamA,
  teamB,
  scoreA,
  scoreB,
  winnerId,
  teamAId,
  teamBId,
  className,
}: TeamVsProps) {
  const teamAWon = winnerId === teamAId
  const teamBWon = winnerId === teamBId
  const hasScore = scoreA !== undefined && scoreB !== undefined

  return (
    <div className={cn("flex items-center justify-center gap-4", className)}>
      <div className={cn("flex-1 text-right", teamAWon && "text-win")}>
        <TeamBadge
          teamName={teamA}
          isWinner={teamAWon}
          score={hasScore ? scoreA : undefined}
        />
      </div>

      <span className="text-text-tertiary font-bold">VS</span>

      <div className={cn("flex-1 text-left", teamBWon && "text-win")}>
        <TeamBadge
          teamName={teamB}
          isWinner={teamBWon}
          score={hasScore ? scoreB : undefined}
        />
      </div>
    </div>
  )
}
