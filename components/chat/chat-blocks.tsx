"use client"

import Image from "next/image"
import { cn } from "@/lib/utils"
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Shield,
  Zap,
  AlertCircle,
  Info,
  Target,
  User,
  Map,
  Clock,
  CheckCircle2,
  Crosshair,
  Swords,
  Trophy,
  XCircle,
  BarChart3,
  Layout
} from "lucide-react"
import type { ParsedBlock } from "@/lib/chat/block-parser"
import ReactMarkdown from "react-markdown"
import {
  getAgentIcon,
  hasAgentIcon,
  getMapImage,
  hasMapImage,
  getMapGradient,
  formatAgentName,
  formatMapName,
  getAgentRole,
  getRoleColors,
} from "@/lib/valorant-assets"
import { TeamLogo } from "@/components/valorant/team-logo"

// Stat Block Component - displays key metrics
export function StatBlock({ props }: { props: Record<string, string> }) {
  const { label, value, trend, confidence, subtext } = props

  const trendIcon = trend === 'up' ? (
    <TrendingUp className="w-4 h-4 text-green-400" />
  ) : trend === 'down' ? (
    <TrendingDown className="w-4 h-4 text-red-400" />
  ) : (
    <Minus className="w-4 h-4 text-muted-foreground" />
  )

  const confidenceColors = {
    HIGH: 'bg-green-500/20 text-green-400 border-green-500/30',
    MEDIUM: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    LOW: 'bg-red-500/20 text-red-400 border-red-500/30',
  }

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20">
      <div className="p-2 rounded-lg bg-purple-500/20">
        <BarChart3 className="w-4 h-4 text-purple-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="flex items-center gap-2">
          <p className="text-lg font-bold text-foreground">{value}</p>
          {trend && trendIcon}
        </div>
        {subtext && <p className="text-xs text-muted-foreground">{subtext}</p>}
      </div>
      {confidence && (
        <span className={cn(
          "px-2 py-0.5 text-xs rounded border",
          confidenceColors[confidence as keyof typeof confidenceColors] || confidenceColors.LOW
        )}>
          {confidence}
        </span>
      )}
    </div>
  )
}

// Insight Block Component - displays analysis insights
export function InsightBlock({ props, content }: { props: Record<string, string>; content: string }) {
  const { type, title, priority } = props

  const typeConfig = {
    weakness: {
      bg: 'bg-gradient-to-r from-red-500/10 to-red-500/5',
      border: 'border-l-4 border-l-red-500 border border-red-500/20',
      icon: AlertTriangle,
      iconBg: 'bg-red-500/20',
      iconColor: 'text-red-400'
    },
    strength: {
      bg: 'bg-gradient-to-r from-green-500/10 to-green-500/5',
      border: 'border-l-4 border-l-green-500 border border-green-500/20',
      icon: Shield,
      iconBg: 'bg-green-500/20',
      iconColor: 'text-green-400'
    },
    opportunity: {
      bg: 'bg-gradient-to-r from-blue-500/10 to-blue-500/5',
      border: 'border-l-4 border-l-blue-500 border border-blue-500/20',
      icon: Zap,
      iconBg: 'bg-blue-500/20',
      iconColor: 'text-blue-400'
    },
    warning: {
      bg: 'bg-gradient-to-r from-amber-500/10 to-amber-500/5',
      border: 'border-l-4 border-l-amber-500 border border-amber-500/20',
      icon: AlertCircle,
      iconBg: 'bg-amber-500/20',
      iconColor: 'text-amber-400'
    },
    info: {
      bg: 'bg-gradient-to-r from-cyan-500/10 to-cyan-500/5',
      border: 'border-l-4 border-l-cyan-500 border border-cyan-500/20',
      icon: Info,
      iconBg: 'bg-cyan-500/20',
      iconColor: 'text-cyan-400'
    }
  }

  const config = typeConfig[type as keyof typeof typeConfig] || typeConfig.info
  const Icon = config.icon

  const priorityColors = {
    high: 'bg-red-500/20 text-red-400 border-red-500/30',
    medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    low: 'bg-green-500/20 text-green-400 border-green-500/30',
  }

  return (
    <div className={cn("rounded-lg p-4", config.bg, config.border)}>
      <div className="flex items-start gap-3">
        <div className={cn("p-2 rounded-lg shrink-0", config.iconBg)}>
          <Icon className={cn("w-4 h-4", config.iconColor)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold text-sm text-foreground">{title}</h4>
            {priority && (
              <span className={cn(
                "px-2 py-0.5 text-xs rounded border uppercase",
                priorityColors[priority as keyof typeof priorityColors] || priorityColors.low
              )}>
                {priority}
              </span>
            )}
          </div>
          <div className="text-sm text-muted-foreground prose prose-sm prose-invert max-w-none">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  )
}

// Counter Strategy Block - specific actionable recommendations
export function CounterBlock({ props, content }: { props: Record<string, string>; content: string }) {
  const { title, confidence } = props

  const confidenceColors = {
    HIGH: 'bg-green-500/20 text-green-400 border-green-500/30',
    MEDIUM: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    LOW: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  }

  return (
    <div className="rounded-lg p-4 bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-500/20">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-orange-500/20 shrink-0">
          <Target className="w-4 h-4 text-orange-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold text-sm text-foreground">{title}</h4>
            {confidence && (
              <span className={cn(
                "px-2 py-0.5 text-xs rounded border",
                confidenceColors[confidence as keyof typeof confidenceColors] || confidenceColors.LOW
              )}>
                {confidence}
              </span>
            )}
          </div>
          <div className="text-sm text-muted-foreground prose prose-sm prose-invert max-w-none">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  )
}

// Agent Icon for chat - small inline display
function ChatAgentIcon({ agentName }: { agentName: string }) {
  const hasIcon = hasAgentIcon(agentName)
  const iconPath = getAgentIcon(agentName)
  const role = getAgentRole(agentName)
  const roleColors = getRoleColors(role)

  return (
    <div className={cn(
      "relative w-7 h-7 rounded overflow-hidden border",
      roleColors.border,
      roleColors.bg
    )}>
      {hasIcon && iconPath ? (
        <Image
          src={iconPath}
          alt={formatAgentName(agentName)}
          width={28}
          height={28}
          className="object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <User className="w-3 h-3 text-muted-foreground" />
        </div>
      )}
    </div>
  )
}

// Player Block - player performance card with agent icons
export function PlayerBlock({ props }: { props: Record<string, string> }) {
  const { name, role, acs, kd, agents, team } = props
  const agentList = agents?.split(',').map(a => a.trim()).filter(Boolean) || []

  return (
    <div className="rounded-lg p-4 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/20">
      <div className="flex items-center gap-3">
        {team ? (
          <TeamLogo teamName={team} size="md" />
        ) : (
          <div className="p-2 rounded-lg bg-blue-500/20">
            <Crosshair className="w-5 h-5 text-blue-400" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-foreground">{name}</h4>
            {role && (
              <span className="px-2 py-0.5 text-xs rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                {role}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 mt-1 text-sm">
            {acs && (
              <span className="text-muted-foreground">
                LCS: <span className="text-foreground font-medium">{acs}</span>
              </span>
            )}
            {kd && (
              <span className="text-muted-foreground">
                K/D: <span className="text-foreground font-medium">{kd}</span>
              </span>
            )}
          </div>
          {agentList.length > 0 && (
            <div className="flex items-center gap-1.5 mt-2">
              {agentList.slice(0, 5).map(agent => (
                <div key={agent} className="flex items-center gap-1">
                  <ChatAgentIcon agentName={agent} />
                </div>
              ))}
              {agentList.length > 5 && (
                <span className="text-xs text-muted-foreground">+{agentList.length - 5}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Section Block - group header
export function SectionBlock({ props, content }: { props: Record<string, string>; content: string }) {
  const { title, icon } = props

  const iconMap: Record<string, typeof Target> = {
    target: Target,
    crosshair: Crosshair,
    swords: Swords,
    trophy: Trophy,
    map: Map,
    clock: Clock,
    user: User,
    chart: BarChart3,
    layout: Layout
  }

  const Icon = iconMap[icon?.toLowerCase() || 'target'] || Target

  return (
    <div className="mb-3">
      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border">
        <Icon className="w-4 h-4 text-valorant-accent" />
        <h3 className="font-semibold text-foreground">{title}</h3>
      </div>
      {content && (
        <div className="text-sm text-muted-foreground prose prose-sm prose-invert max-w-none">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      )}
    </div>
  )
}

// List Block - grouped items
export function ListBlock({ props, content }: { props: Record<string, string>; content: string }) {
  const { title, type } = props

  const typeColors = {
    warning: 'border-l-amber-500 bg-amber-500/5',
    success: 'border-l-green-500 bg-green-500/5',
    info: 'border-l-blue-500 bg-blue-500/5',
    neutral: 'border-l-gray-500 bg-gray-500/5',
  }

  return (
    <div className={cn(
      "rounded-lg p-3 border-l-4 border border-border/50",
      typeColors[type as keyof typeof typeColors] || typeColors.neutral
    )}>
      {title && <h4 className="font-medium text-sm text-foreground mb-2">{title}</h4>}
      <div className="text-sm text-muted-foreground prose prose-sm prose-invert max-w-none">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    </div>
  )
}

// Recommendation Block - action items
export function RecommendationBlock({ props, content }: { props: Record<string, string>; content: string }) {
  const { title, priority, category } = props

  const priorityColors = {
    high: 'from-red-500/10 to-pink-500/10 border-red-500/20',
    medium: 'from-yellow-500/10 to-orange-500/10 border-yellow-500/20',
    low: 'from-green-500/10 to-emerald-500/10 border-green-500/20',
  }

  return (
    <div className={cn(
      "rounded-lg p-4 bg-gradient-to-r border",
      priorityColors[priority as keyof typeof priorityColors] || priorityColors.low
    )}>
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-purple-500/20 shrink-0">
          <CheckCircle2 className="w-4 h-4 text-purple-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {title && <h4 className="font-semibold text-sm text-foreground">{title}</h4>}
            {priority && (
              <span className={cn(
                "px-2 py-0.5 text-xs rounded border uppercase",
                priority === 'high' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                'bg-green-500/20 text-green-400 border-green-500/30'
              )}>
                {priority}
              </span>
            )}
            {category && (
              <span className="px-2 py-0.5 text-xs rounded bg-surface text-muted-foreground">
                {category}
              </span>
            )}
          </div>
          <div className="text-sm text-muted-foreground prose prose-sm prose-invert max-w-none">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  )
}

// Round Block - round-specific analysis
export function RoundBlock({ props, content }: { props: Record<string, string>; content: string }) {
  const { number, outcome, economy, spike } = props
  const isWin = outcome === 'win'

  return (
    <div className={cn(
      "rounded-lg p-3 border-l-4 border",
      isWin
        ? "border-l-green-500 bg-green-500/5 border-green-500/20"
        : "border-l-red-500 bg-red-500/5 border-red-500/20"
    )}>
      <div className="flex items-center gap-3 mb-2">
        <div className={cn(
          "p-1.5 rounded",
          isWin ? "bg-green-500/20" : "bg-red-500/20"
        )}>
          {isWin ? (
            <Trophy className="w-4 h-4 text-green-400" />
          ) : (
            <XCircle className="w-4 h-4 text-red-400" />
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-foreground">Round {number}</span>
          <span className={cn(
            "px-2 py-0.5 text-xs rounded",
            isWin ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
          )}>
            {isWin ? 'WIN' : 'LOSS'}
          </span>
        </div>
        <div className="flex items-center gap-2 ml-auto text-xs text-muted-foreground">
          {economy && <span>Economy: {economy}</span>}
          {spike && <span>Spike: {spike}</span>}
        </div>
      </div>
      <div className="text-sm text-muted-foreground prose prose-sm prose-invert max-w-none">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    </div>
  )
}

// Map Block - map-specific stats with map image
export function MapBlock({ props, content }: { props: Record<string, string>; content: string }) {
  const { name, score, winRate } = props
  const mapImage = getMapImage(name)
  const hasImage = hasMapImage(name)
  const gradientClass = getMapGradient(name)

  return (
    <div className="relative overflow-hidden rounded-lg border border-indigo-500/20">
      {/* Map Background */}
      <div className="absolute inset-0">
        {hasImage && mapImage ? (
          <Image
            src={mapImage}
            alt={formatMapName(name)}
            fill
            className="object-cover opacity-20"
          />
        ) : (
          <div className={cn("absolute inset-0 bg-gradient-to-br opacity-30", gradientClass)} />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-background/95 to-background/70" />
      </div>

      <div className="relative p-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="relative w-12 h-8 rounded overflow-hidden border border-indigo-500/30">
            {hasImage && mapImage ? (
              <Image
                src={mapImage}
                alt={formatMapName(name)}
                fill
                className="object-cover"
              />
            ) : (
              <div className={cn("w-full h-full bg-gradient-to-br flex items-center justify-center", gradientClass)}>
                <Map className="w-3 h-3 text-indigo-400" />
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">{formatMapName(name)}</span>
            {score && <span className="text-sm text-muted-foreground">{score}</span>}
            {winRate && (
              <span className={cn(
                "px-2 py-0.5 text-xs rounded font-medium",
                parseFloat(winRate) >= 50
                  ? "bg-green-500/20 text-green-400"
                  : "bg-red-500/20 text-red-400"
              )}>
                {winRate}
              </span>
            )}
          </div>
        </div>
        {content && (
          <div className="text-sm text-muted-foreground prose prose-sm prose-invert max-w-none">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  )
}

// Main Block Renderer
export function ChatBlockRenderer({ block }: { block: ParsedBlock }) {
  switch (block.type) {
    case 'stat':
      return <StatBlock props={block.props} />
    case 'insight':
      return <InsightBlock props={block.props} content={block.content} />
    case 'counter':
      return <CounterBlock props={block.props} content={block.content} />
    case 'player':
      return <PlayerBlock props={block.props} />
    case 'section':
      return <SectionBlock props={block.props} content={block.content} />
    case 'list':
      return <ListBlock props={block.props} content={block.content} />
    case 'recommendation':
      return <RecommendationBlock props={block.props} content={block.content} />
    case 'round':
      return <RoundBlock props={block.props} content={block.content} />
    case 'map':
      return <MapBlock props={block.props} content={block.content} />
    case 'text':
    default:
      return (
        <div className="text-sm prose prose-invert prose-sm max-w-none">
          <ReactMarkdown
            components={{
              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
              ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
              li: ({ children }) => <li className="text-sm">{children}</li>,
              strong: ({ children }) => <strong className="font-semibold text-valorant-accent">{children}</strong>,
              code: ({ children }) => <code className="px-1 py-0.5 bg-background rounded text-xs font-mono">{children}</code>,
            }}
          >
            {block.content}
          </ReactMarkdown>
        </div>
      )
  }
}
