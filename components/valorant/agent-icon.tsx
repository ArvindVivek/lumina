"use client"

import Image from "next/image"
import { User } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  getAgentIcon,
  hasAgentIcon,
  getAgentRole,
  getRoleColors,
  getAgentPlaceholder,
  formatAgentName,
} from "@/lib/valorant-assets"

interface AgentIconProps {
  agentName: string
  size?: "sm" | "md" | "lg" | "xl"
  showRole?: boolean
  showRoleBadge?: boolean
  showGlow?: boolean
  className?: string
}

const sizeConfig = {
  sm: { container: "h-6 w-6", icon: 16, badge: "text-[8px] px-1" },
  md: { container: "h-8 w-8", icon: 24, badge: "text-[9px] px-1.5" },
  lg: { container: "h-12 w-12", icon: 32, badge: "text-[10px] px-2" },
  xl: { container: "h-16 w-16", icon: 48, badge: "text-xs px-2" },
}

export function AgentIcon({
  agentName,
  size = "md",
  showRole = false,
  showRoleBadge = false,
  showGlow = false,
  className,
}: AgentIconProps) {
  const hasIcon = hasAgentIcon(agentName)
  const iconPath = getAgentIcon(agentName)
  const role = getAgentRole(agentName)
  const roleColors = getRoleColors(role)
  const config = sizeConfig[size]

  return (
    <div className={cn("relative inline-flex flex-col items-center", className)}>
      {/* Icon container */}
      <div
        className={cn(
          "relative rounded-lg overflow-hidden flex items-center justify-center",
          config.container,
          showGlow && roleColors.bg,
          !hasIcon && "bg-surface-hover"
        )}
      >
        {hasIcon && iconPath ? (
          <Image
            src={iconPath}
            alt={formatAgentName(agentName)}
            width={config.icon}
            height={config.icon}
            className="object-cover"
          />
        ) : (
          <div className={cn("flex items-center justify-center w-full h-full", roleColors.bg)}>
            <User className={cn("text-text-tertiary", size === "sm" ? "h-3 w-3" : "h-4 w-4")} />
          </div>
        )}

        {/* Role badge in corner */}
        {showRoleBadge && role !== "unknown" && (
          <div
            className={cn(
              "absolute -bottom-0.5 -right-0.5 rounded px-0.5 text-[6px] font-bold uppercase",
              roleColors.bg,
              roleColors.text,
              roleColors.border,
              "border"
            )}
          >
            {role.charAt(0)}
          </div>
        )}
      </div>

      {/* Role label below */}
      {showRole && role !== "unknown" && (
        <span
          className={cn(
            "mt-1 rounded font-medium uppercase",
            config.badge,
            roleColors.bg,
            roleColors.text
          )}
        >
          {role}
        </span>
      )}
    </div>
  )
}

interface AgentGridProps {
  agents: string[]
  maxDisplay?: number
  size?: "sm" | "md" | "lg" | "xl"
  showGlow?: boolean
  className?: string
}

export function AgentGrid({
  agents,
  maxDisplay = 5,
  size = "sm",
  showGlow = false,
  className,
}: AgentGridProps) {
  const displayAgents = agents.slice(0, maxDisplay)
  const overflow = agents.length - maxDisplay

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {displayAgents.map((agent, index) => (
        <div
          key={agent}
          className="transition-transform hover:scale-110"
          style={{ animationDelay: `${index * 50}ms` }}
        >
          <AgentIcon agentName={agent} size={size} showGlow={showGlow} />
        </div>
      ))}
      {overflow > 0 && (
        <span className="text-xs text-text-tertiary ml-1">+{overflow}</span>
      )}
    </div>
  )
}
