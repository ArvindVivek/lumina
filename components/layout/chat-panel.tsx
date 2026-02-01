"use client"

import { motion, AnimatePresence } from "framer-motion"
import { X, Send, Bot, Sparkles, Database } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { useState, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"
import { useScreenData } from "@/lib/context/screen-data-context"
import { parseBlocks, hasStructuredBlocks } from "@/lib/chat/block-parser"
import { ChatBlockRenderer } from "@/components/chat/chat-blocks"

interface ChatPanelProps {
  isOpen: boolean
  onClose: () => void
  pageContext?: {
    page: string
    title: string
    description?: string
    data?: Record<string, string | undefined>
    richContext?: Record<string, unknown>
  }
}

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  toolInProgress?: string
}

// Message Content Renderer - handles structured blocks
function MessageContent({ content }: { content: string }) {
  // Check if content has structured blocks
  if (hasStructuredBlocks(content)) {
    const blocks = parseBlocks(content)
    return (
      <div className="space-y-3">
        {blocks.map((block, index) => (
          <ChatBlockRenderer key={index} block={block} />
        ))}
      </div>
    )
  }

  // Fallback to simple text rendering for non-structured content
  return <ChatBlockRenderer block={{ type: 'text', props: {}, content }} />
}

export function ChatPanel({ isOpen, onClose, pageContext }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content: "Hi! I'm your VALORANT analytics assistant with **full database access**. I can see exactly what's on your screen and answer questions about the data you're viewing.\n\nTry asking:\n- \"What am I looking at?\"\n- \"Tell me about **bang**\" (or any player name)\n- \"Summarize this data\"\n\nI'll give you insights based on real numbers!",
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const { screenData, getFormattedContext } = useScreenData()

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)

    try {
      // Get full screen context including all visible data
      const fullScreenContext = getFormattedContext()

      // Build screen data object with IDs and visible data
      const screenDataPayload = {
        page: screenData.page,
        pageTitle: screenData.pageTitle,
        seriesId: screenData.seriesId,
        teamId: screenData.teamId,
        playerId: screenData.playerId,
        tournamentId: screenData.tournamentId,
        gameId: screenData.gameId,
        visibleData: screenData.visibleData,
        // Also include rich context from pageContext if available
        ...(pageContext?.richContext || {}),
        ...(pageContext?.data || {}),
      }

      // Call streaming API with full context
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.content,
          })),
          context: fullScreenContext,
          screenData: screenDataPayload,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to get response")
      }

      // Handle streaming response
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      const assistantMessageId = (Date.now() + 1).toString()
      let accumulatedContent = ""

      // Add initial assistant message
      const initialMessage: Message = {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, initialMessage])

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value)
          const lines = chunk.split("\n")

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6)
              if (data === "[DONE]") {
                setIsLoading(false)
                break
              }

              try {
                const parsed = JSON.parse(data)
                if (parsed.text) {
                  accumulatedContent += parsed.text
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMessageId
                        ? { ...msg, content: accumulatedContent, toolInProgress: undefined }
                        : msg
                    )
                  )
                }
                // Handle tool call notifications
                if (parsed.type === 'tool_call' && parsed.tool) {
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMessageId
                        ? { ...msg, toolInProgress: parsed.tool }
                        : msg
                    )
                  )
                }
              } catch {
                // Ignore parse errors
              }
            }
          }
        }
      }

      setIsLoading(false)
    } catch (error) {
      console.error("Chat error:", error)
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
      setIsLoading(false)
    }
  }

  const suggestedPrompts = pageContext?.page === 'analytics' ? [
    "What were the key turning points?",
    "Analyze the economy management",
    "Which player had the highest impact?",
    "What should we improve?",
  ] : pageContext?.page === 'player' ? [
    "Analyze opening duel performance",
    "What are the trading patterns?",
    "Show clutch situation stats",
    "Identify areas for improvement",
  ] : pageContext?.page === 'team' ? [
    "Analyze team composition",
    "Show win rate by map",
    "What are the team's strengths?",
    "Identify strategic patterns",
  ] : [
    "Analyze player performance",
    "Show economy trends",
    "Team composition insights",
    "Critical round analysis",
  ]

  return (
    <>
      {/* Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 h-full w-full sm:w-[420px] bg-card border-l border-border shadow-2xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-valorant-accent/20 flex items-center justify-center">
                  <Bot className="h-5 w-5 text-valorant-accent" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">AI Assistant</h3>
                  <p className="text-xs text-muted-foreground">VALORANT Analytics</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Context Badge */}
            {pageContext && (
              <div className="px-4 py-2 bg-surface border-b border-border">
                <div className="flex flex-col gap-1 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Context:</span>
                    <span className="px-2 py-0.5 rounded bg-valorant-accent/10 text-valorant-accent font-medium">
                      {pageContext.title}
                    </span>
                  </div>
                  {/* Rich context details */}
                  {pageContext.richContext && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      {pageContext.richContext.type === 'series' ? (
                        <>
                          <span>{pageContext.richContext.teamA as string} vs {pageContext.richContext.teamB as string}</span>
                          {pageContext.richContext.tournamentName ? (
                            <>
                              <span className="text-border">•</span>
                              <span>{pageContext.richContext.tournamentName as string}</span>
                            </>
                          ) : null}
                        </>
                      ) : null}
                      {pageContext.richContext.type === 'tournament' && pageContext.richContext.matchCount ? (
                        <span>{pageContext.richContext.matchCount as number} matches</span>
                      ) : null}
                      {pageContext.richContext.type === 'team' && pageContext.richContext.players ? (
                        <span>{(pageContext.richContext.players as string[]).length} players</span>
                      ) : null}
                      {pageContext.richContext.type === 'player' && pageContext.richContext.teamName ? (
                        <span>Team: {pageContext.richContext.teamName as string}</span>
                      ) : null}
                    </div>
                  )}
                  {pageContext.description && !pageContext.richContext && (
                    <span className="text-muted-foreground">{pageContext.description}</span>
                  )}
                </div>
              </div>
            )}

            {/* Messages */}
            <ScrollArea className="flex-1 p-4" ref={scrollRef}>
              <div className="space-y-4">
                {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className={cn(
                      "flex gap-3",
                      message.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    {message.role === "assistant" && (
                      <div className="w-8 h-8 rounded-lg bg-valorant-accent/20 flex items-center justify-center shrink-0">
                        <Bot className="h-4 w-4 text-valorant-accent" />
                      </div>
                    )}
                    <div
                      className={cn(
                        "rounded-lg max-w-[85%]",
                        message.role === "user"
                          ? "bg-valorant-accent text-white px-4 py-2"
                          : "bg-surface text-foreground px-4 py-3"
                      )}
                    >
                      {message.role === "assistant" ? (
                        <div className="text-sm">
                          {message.toolInProgress && (
                            <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                              <Database className="w-3 h-3 animate-pulse" />
                              <span>Querying: {message.toolInProgress}</span>
                            </div>
                          )}
                          <MessageContent content={message.content} />
                        </div>
                      ) : (
                        <p className="text-sm">{message.content}</p>
                      )}
                    </div>
                  </motion.div>
                ))}

                {isLoading && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex gap-3"
                  >
                    <div className="w-8 h-8 rounded-lg bg-valorant-accent/20 flex items-center justify-center">
                      <Bot className="h-4 w-4 text-valorant-accent animate-pulse" />
                    </div>
                    <div className="bg-surface rounded-lg px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          <div className="w-2 h-2 bg-valorant-accent rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                          <div className="w-2 h-2 bg-valorant-accent rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                          <div className="w-2 h-2 bg-valorant-accent rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                        <span className="text-xs text-muted-foreground">Querying database...</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            </ScrollArea>

            {/* Suggested Prompts */}
            {messages.length <= 2 && (
              <div className="px-4 pb-2">
                <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  Try asking...
                </p>
                <div className="flex flex-wrap gap-2">
                  {suggestedPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => setInput(prompt)}
                      className="text-xs px-2 py-1 rounded-full bg-surface hover:bg-surface-hover text-foreground border border-border transition-colors"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            {/* Input */}
            <div className="p-4">
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  handleSend()
                }}
                className="flex gap-2"
              >
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about VALORANT analytics..."
                  className="flex-1"
                  disabled={isLoading}
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={!input.trim() || isLoading}
                  className="shrink-0 bg-valorant-accent hover:bg-valorant-accent/80"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
