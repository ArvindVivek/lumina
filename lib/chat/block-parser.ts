/**
 * Block Parser for Structured Chat Responses
 * Parses custom block syntax like :::blockType{props}content
 *
 * Example:
 * :::stat{label="Win Rate" value="67%" trend="up" confidence="HIGH"}
 * :::insight{type="weakness" title="Poor Trading" priority="high"}Content here
 * :::counter{confidence="HIGH" title="Stack B Site"}Detailed recommendation...
 */

export interface ParsedBlock {
  type: 'text' | 'stat' | 'insight' | 'counter' | 'player' | 'section' | 'list' | 'recommendation' | 'round' | 'map'
  props: Record<string, string>
  content: string
}

export interface StatBlockProps {
  label: string
  value: string
  trend?: 'up' | 'down' | 'neutral'
  confidence?: 'HIGH' | 'MEDIUM' | 'LOW'
  subtext?: string
}

export interface InsightBlockProps {
  type: 'weakness' | 'strength' | 'opportunity' | 'warning' | 'info'
  title: string
  priority?: 'high' | 'medium' | 'low'
  content: string
}

export interface CounterBlockProps {
  title: string
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
  content: string
}

export interface PlayerBlockProps {
  name: string
  role?: string
  acs?: string
  kd?: string
  agents?: string
}

export interface SectionBlockProps {
  title: string
  icon?: string
}

export interface ListBlockProps {
  title?: string
  type?: 'warning' | 'success' | 'info' | 'neutral'
  content: string
}

export interface RecommendationBlockProps {
  title?: string
  priority: 'high' | 'medium' | 'low'
  category?: string
  content: string
}

export interface RoundBlockProps {
  number: string
  outcome: 'win' | 'loss'
  economy?: string
  spike?: string
  content: string
}

export interface MapBlockProps {
  name: string
  score?: string
  winRate?: string
  content: string
}

// Parse props from block header like {key="value" key2="value2"}
function parseProps(propsString: string): Record<string, string> {
  const props: Record<string, string> = {}

  // Match key="value" or key='value' patterns
  const regex = /(\w+)=["']([^"']*)["']/g
  let match

  while ((match = regex.exec(propsString)) !== null) {
    props[match[1]] = match[2]
  }

  return props
}

// Parse content into blocks and text segments
export function parseBlocks(content: string): ParsedBlock[] {
  const blocks: ParsedBlock[] = []

  // Pattern: :::blockType{props}content (multiline support)
  // Block ends at next ::: or end of string
  const blockPattern = /:::(stat|insight|counter|player|section|list|recommendation|round|map)\{([^}]*)\}([\s\S]*?)(?=:::|$)/g

  let lastIndex = 0
  let match

  while ((match = blockPattern.exec(content)) !== null) {
    // Add any text before this block
    if (match.index > lastIndex) {
      const textBefore = content.slice(lastIndex, match.index).trim()
      if (textBefore) {
        blocks.push({
          type: 'text',
          props: {},
          content: textBefore
        })
      }
    }

    const blockType = match[1] as ParsedBlock['type']
    const propsString = match[2]
    const blockContent = match[3].trim()

    blocks.push({
      type: blockType,
      props: parseProps(propsString),
      content: blockContent
    })

    lastIndex = match.index + match[0].length
  }

  // Add any remaining text after last block
  if (lastIndex < content.length) {
    const remainingText = content.slice(lastIndex).trim()
    if (remainingText) {
      blocks.push({
        type: 'text',
        props: {},
        content: remainingText
      })
    }
  }

  // If no blocks found, return the entire content as text
  if (blocks.length === 0 && content.trim()) {
    blocks.push({
      type: 'text',
      props: {},
      content: content.trim()
    })
  }

  return blocks
}

// Check if content contains structured blocks
export function hasStructuredBlocks(content: string): boolean {
  return /:::(stat|insight|counter|player|section|list|recommendation|round|map)\{/.test(content)
}
