import { useState, useCallback } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

export interface ChatMessage {
  role: "user" | "assistant" | "system"
  content: string
}

export interface ChatSession {
  id: string
  series_id?: string
  team_id?: string
  messages: ChatMessage[]
  created_at: string
}

export interface UseChatOptions {
  sessionId?: string
  seriesId?: string
  teamId?: string
}

export function useChat(options: UseChatOptions = {}) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [sessionId, setSessionId] = useState<string | undefined>(options.sessionId)
  const queryClient = useQueryClient()

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      const userMessage: ChatMessage = { role: "user", content }

      // Optimistically add user message
      setMessages(prev => [...prev, userMessage])

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.content,
          })),
          context: options.seriesId
            ? `Analyzing series ${options.seriesId}${options.teamId ? ` for team ${options.teamId}` : ""}`
            : "General VALORANT analytics",
          stream: false,
          sessionId,
        }),
      })

      if (!res.ok) {
        throw new Error("Failed to send message")
      }

      const data = await res.json()

      // Update session ID if new
      if (data.sessionId && !sessionId) {
        setSessionId(data.sessionId)
      }

      return data.message as string
    },
    onSuccess: (assistantContent) => {
      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: assistantContent,
      }
      setMessages(prev => [...prev, assistantMessage])
    },
    onError: () => {
      // Remove optimistic user message on error
      setMessages(prev => prev.slice(0, -1))
    },
  })

  const sendMessage = useCallback(
    (content: string) => sendMessageMutation.mutate(content),
    [sendMessageMutation]
  )

  const clearMessages = useCallback(() => {
    setMessages([])
    setSessionId(undefined)
  }, [])

  return {
    messages,
    sendMessage,
    clearMessages,
    isLoading: sendMessageMutation.isPending,
    error: sendMessageMutation.error,
    sessionId,
  }
}

export function useChatSession(sessionId: string) {
  return useQuery({
    queryKey: ["chat-session", sessionId],
    queryFn: async () => {
      const res = await fetch(`/api/chat/session/${sessionId}`)

      if (!res.ok) {
        throw new Error("Failed to fetch chat session")
      }

      return res.json() as Promise<ChatSession>
    },
    enabled: !!sessionId,
    staleTime: 30 * 1000, // 30 seconds
  })
}

export function useCreateChatSession() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: { seriesId?: string; teamId?: string }) => {
      const res = await fetch("/api/chat/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      })

      if (!res.ok) {
        throw new Error("Failed to create chat session")
      }

      return res.json() as Promise<{ sessionId: string }>
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["chat-sessions"] })
    },
  })
}
