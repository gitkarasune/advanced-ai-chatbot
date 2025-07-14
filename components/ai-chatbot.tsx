"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { PlaceholdersAndVanishInput } from "./ui/placeholders-and-vanish-input"
import { Bot, User, Sparkles, MessageCircle, RefreshCw, AlertCircle, Maximize2, Minimize2, X } from "lucide-react"
import { Button } from "./ui/button"
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "./ui/tooltip"

const STORAGE_KEY = "aiChatbot_isExpanded"


interface Message {
    id: string
    role: "user" | "assistant"
    content: string
    timestamp: Date
    isError?: boolean
}

export function AIChatbot() {
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [isTyping, setIsTyping] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const [isExpanded, setIsExpanded] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false) // Prevent duplicate submissions
    const abortControllerRef = useRef<AbortController | null>(null)

    // -- Persist expand/collapse state in localStorage --
    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored !== null) setIsExpanded(stored === "true")
    }, [])

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, isExpanded.toString())
    }, [isExpanded])

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "end",
        })
    }

    useEffect(() => {
        const timer = setTimeout(scrollToBottom, 100)
        return () => clearTimeout(timer)
    }, [messages, isLoading])

    // Handle escape key to exit fullscreen
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape" && isExpanded) {
                setIsExpanded(false)
            }
        }

        document.addEventListener("keydown", handleEscape)
        return () => document.removeEventListener("keydown", handleEscape)
    }, [isExpanded])

    const typewriterEffect = async (text: string, callback: (partial: string) => void) => {
        setIsTyping(true)
        const words = text.split(" ")
        let currentText = ""

        for (let i = 0; i < words.length; i++) {
            currentText += (i > 0 ? " " : "") + words[i]
            callback(currentText)
            await new Promise((resolve) => setTimeout(resolve, 50 + Math.random() * 50))
        }
        setIsTyping(false)
    }

    const handleSubmit = async (messageText: string) => {
        if (!messageText.trim() || isLoading || isSubmitting) return

        // Prevent duplicate submissions
        setIsSubmitting(true)

        // Clear any previous errors
        setError(null)

        // Generate unique ID using timestamp + random number
        const userMessageId = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

        const userMessage: Message = {
            id: userMessageId,
            role: "user",
            content: messageText.trim(),
            timestamp: new Date(),
        }

        setMessages((prev) => [...prev, userMessage])
        setInput("")
        setIsLoading(true)

        // Create abort controller for this request
        abortControllerRef.current = new AbortController()

        try {
            // console.log("Sending message:", messageText)

            const response = await fetch("/api/ai-chat", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    message: messageText.trim(),
                    conversationHistory: messages.slice(-10), // Send last 10 messages for context
                }),
                signal: abortControllerRef.current.signal,
            })

            // console.log("Response status:", response.status)

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.error || `HTTP ${response.status}`)
            }

            const data = await response.json()
            // console.log("Response data:", data)

            if (!data.response) {
                throw new Error("No response received from AI")
            }

            // Create placeholder message for typewriter effect
            const aiMessageId = `ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
            const aiMessage: Message = {
                id: aiMessageId,
                role: "assistant",
                content: "",
                timestamp: new Date(),
            }

            setMessages((prev) => [...prev, aiMessage])

            // Typewriter effect
            await typewriterEffect(data.response, (partialText) => {
                setMessages((prev) => prev.map((msg) => (msg.id === aiMessageId ? { ...msg, content: partialText } : msg)))
            })
        } catch (error: unknown) {
            const err = error as Error
            console.error("Chat Error:", err)

            // Don't show error if request was aborted
            if (err.name === "AbortError") {
                return
            }

            setError(err.message)

            const errorMessageId = `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
            const errorMessage: Message = {
                id: errorMessageId,
                role: "assistant",
                content:
                    "I apologize, but I'm experiencing some technical difficulties right now. Please try again in a moment! 🤖",
                timestamp: new Date(),
                isError: true,
            }
            setMessages((prev) => [...prev, errorMessage])
        } finally {
            setIsLoading(false)
            setIsSubmitting(false)
            abortControllerRef.current = null
        }
    }

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (input.trim() && !isSubmitting) {
            handleSubmit(input)
        }
    }

    const handleVanishSubmit = () => {
        // Only handle vanish submit if form submit hasn't been triggered
        if (input.trim() && !isSubmitting) {
            handleSubmit(input)
        }
    }

    const clearChat = () => {
        // Abort any ongoing request
        if (abortControllerRef.current) {
            abortControllerRef.current.abort()
        }
        setMessages([])
        setInput("")
        setError(null)
        setIsLoading(false)
        setIsSubmitting(false)
    }

    const retryLastMessage = () => {
        if (messages.length >= 2) {
            const lastUserMessage = messages[messages.length - 2]
            if (lastUserMessage.role === "user") {
                // Remove the last two messages (user and error response)
                setMessages((prev) => prev.slice(0, -2))
                handleSubmit(lastUserMessage.content)
            }
        }
    }

    //   const toggleExpanded = () => {
    //     setIsExpanded(!isExpanded)
    //   }

    const toggleExpanded = () => setIsExpanded((prev) => !prev)

    const suggestedQuestions = [
        "Tell me about the Software Developement...",
        "What are top tools for Software Developement ",
        "How do I start building my dreams",
        "Who are the CTO, Co-Founders of many startup",
        "What are the best programming language in 2025",
        "How can I join Freecodecamp as a student?",
    ]

    // expand part - check to see if the z-50 is not covered by the header
    const chatContainerClass = isExpanded
        ? "fixed inset-0 z-50 w-full h-full bg-white dark:bg-gray-900"
        : "w-full max-w-4xl mx-auto h-[75vh] bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm rounded-3xl shadow-3xl border border-white/20 dark:border-gray-700/50"

    return (
        <AnimatePresence>
            <motion.div
                initial={false}
                animate={{
                    scale: isExpanded ? 1 : 1,
                    borderRadius: isExpanded ? 0 : 24,
                }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className={cn("flex flex-col", chatContainerClass)}
            >
                {/* Chat header */}
                <div
                    className={cn(
                        "bg-gradient-to-r from-purple-600 via-blue-600 to-cyan-600 rounded-t-3xl p-6 text-white relative overflow-hidden",
                        isExpanded ? "rounded-none" : "rounded-t-3xl",
                    )}
                >
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 via-blue-600/20 to-cyan-600/20 backdrop-blur-sm"></div>
                    <div className="relative z-10 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <motion.div
                                className="bg-white/20 p-3 rounded-full backdrop-blur-sm"
                                animate={{
                                    scale: [1, 1.05, 1],
                                    rotate: [0, 5, -5, 0],
                                }}
                                transition={{
                                    duration: 2,
                                    repeat: Number.POSITIVE_INFINITY,
                                    repeatType: "reverse",
                                }}
                            >
                                <Bot className="h-8 w-8" />
                            </motion.div>
                            <div>
                                <h2 className="font-bold text-2xl flex items-center gap-2">
                                    Advanced AI Chatbot
                                    <Sparkles className="h-5 w-5 text-yellow-300" />
                                </h2>
                                <p className="text-sm opacity-90">
                                    {isLoading ? "Thinking..." : "Ask anything about tech community space"}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {messages.length > 0 && (
                                <Button
                                    onClick={clearChat}
                                    variant="ghost"
                                    size="sm"
                                    className="text-white hover:bg-white/20 backdrop-blur-sm"
                                    disabled={isLoading}
                                >
                                    <RefreshCw className="h-4 w-4 mr-2" />
                                    Clear
                                </Button>
                            )}
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            onClick={toggleExpanded}
                                            variant="ghost"
                                            size="sm"
                                            className="text-white hover:bg-white/20 backdrop-blur-sm"
                                        >
                                            {isExpanded ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                        {isExpanded ? "Exit Fullscreen" : "Expand to Fullscreen"}
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                            {isExpanded && (
                                <Button
                                    onClick={() => setIsExpanded(false)}
                                    variant="ghost"
                                    size="sm"
                                    className="text-white hover:bg-white/20 backdrop-blur-sm"
                                    title="Close Fullscreen"
                                >
                                    <X className="h-5 w-5" />
                                </Button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Error Display */}
                {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-400 p-4 mx-6 mt-4 rounded">
                        <div className="flex items-center">
                            <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
                            <div>
                                <p className="text-sm text-red-700 dark:text-red-400">Connection Error: {error}</p>
                                <Button
                                    onClick={retryLastMessage}
                                    variant="outline"
                                    size="lg"
                                    className="mt-2 text-red-600 border-red-300 hover:bg-red-50 bg-transparent"
                                >
                                    Retry
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Chat messages */}
                <div
                    className={cn("flex-1 overflow-y-auto p-6 space-y-4 bg-gradient-to-b from-purple-50/30 via-blue-50/30 to-cyan-50/30 dark:from-gray-900/30 dark:via-gray-800/30 dark:to-gray-900/30",
                        isExpanded && "max-h-none",
                    )}
                >
                    <AnimatePresence mode="popLayout">
                        {messages.length === 0 ? (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="h-full flex flex-col items-center justify-center text-center p-8"
                            >
                                <motion.div
                                    className="bg-gradient-to-r from-purple-500 to-blue-500 mt-7 p-6 rounded-full mb-6 shadow-2xl"
                                    animate={{
                                        boxShadow: [
                                            "0 0 20px rgba(147, 51, 234, 0.3)",
                                            "0 0 40px rgba(59, 130, 246, 0.4)",
                                            "0 0 20px rgba(147, 51, 234, 0.3)",
                                        ],
                                    }}
                                    transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
                                >
                                    <Bot className="h-16 w-16 text-white" />
                                </motion.div>
                                <h3 className="text-3xl font-bold mb-4 bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                                    How can I help you today?
                                </h3>
                                <p className="text-gray-600 dark:text-gray-400 max-w-md mb-8">
                                    Ask about top events, software development, python programming or anything related tech space.
                                </p>

                                {/* Suggested Questions */}
                                <div
                                    className={cn("grid gap-3 max-w-2xl",
                                        isExpanded ? "grid-cols-1 md:grid-cols-3" : "grid-cols-1 md:grid-cols-2"
                                    )}
                                >
                                    {suggestedQuestions.slice(0, isExpanded ? 6 : 4).map((question, index) => (
                                        <motion.button
                                            key={`suggestion-${index}`} // fixed the unique key, typescript and code is now free
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: index * 0.1 }}
                                            onClick={() => handleSubmit(question)}
                                            disabled={isLoading || isSubmitting}
                                            className="p-3 text-sm bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-xl border border-white/30 dark:border-gray-600/50 hover:bg-white/90 dark:hover:bg-gray-700/90 transition-all duration-200 text-left hover:shadow-lg hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <MessageCircle className="h-4 w-4 inline mr-2 text-blue-500" />
                                            {question}
                                        </motion.button>
                                    ))}
                                </div>
                            </motion.div>
                        ) : (
                            <div className="space-y-6">
                                {messages.map((message, index) => (
                                    <motion.div
                                        key={message.id} // Using the unique message ID
                                        initial={{ opacity: 0, y: 30, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        transition={{
                                            duration: 0.4,
                                            delay: index * 0.1,
                                            type: "spring",
                                            stiffness: 100,
                                        }}
                                        className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}
                                    >
                                        <div
                                            className={cn(
                                                "max-w-[85%] rounded-3xl p-5 shadow-lg backdrop-blur-sm relative",
                                                isExpanded && "max-w-[75%]", // Wider messages in fullscreen
                                                message.role === "user"
                                                    ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-br-lg ml-12"
                                                    : message.isError
                                                        ? "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 rounded-bl-lg mr-12"
                                                        : "bg-white/80 dark:bg-gray-800/80 border border-white/30 dark:border-gray-600/50 text-gray-800 dark:text-gray-200 rounded-bl-lg mr-12",
                                            )}
                                        >
                                            <div className="flex items-start gap-3">
                                                {message.role === "assistant" && (
                                                    <motion.div
                                                        className={cn(
                                                            "p-2 rounded-full mt-1 flex-shrink-0",
                                                            message.isError ? "bg-red-500" : "bg-gradient-to-r from-purple-500 to-blue-500",
                                                        )}
                                                        animate={{ rotate: message.isError ? 0 : [0, 360] }}
                                                        transition={{ duration: 20, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
                                                    >
                                                        {message.isError ? (
                                                            <AlertCircle className="h-5 w-5 text-white" />
                                                        ) : (
                                                            <Bot className="h-5 w-5 text-white" />
                                                        )}
                                                    </motion.div>
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <div className="whitespace-pre-wrap break-words leading-relaxed">
                                                        {message.content}
                                                        {isTyping && message === messages[messages.length - 1] && message.role === "assistant" && (
                                                            <motion.span
                                                                animate={{ opacity: [0, 1, 0] }}
                                                                transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY }}
                                                                className="inline-block w-2 h-5 bg-current ml-1"
                                                            />
                                                        )}
                                                    </div>
                                                    <div className="text-xs mt-3 opacity-60 flex items-center gap-2">
                                                        <span>
                                                            {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                                        </span>
                                                        {message.role === "assistant" && !message.isError && (
                                                            <span className="flex items-center gap-1">
                                                                <Sparkles className="h-3 w-3" />
                                                                AI Generated
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                {message.role === "user" && (
                                                    <div className="bg-gradient-to-r from-blue-400 to-cyan-400 p-2 rounded-full mt-1 flex-shrink-0">
                                                        {/* that individual user  */}
                                                        <User className="h-5 w-5 text-white" />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}

                                {/* Loading indicator */}
                                {isLoading && (
                                    <motion.div
                                        key="loading-indicator" // Fixed unique key
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0 }}
                                        className="flex justify-start"
                                    >
                                        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-white/30 dark:border-gray-600/50 rounded-3xl rounded-bl-lg p-5 mr-12">
                                            <div className="flex items-center gap-3">
                                                <motion.div
                                                    className="bg-gradient-to-r from-purple-500 to-blue-500 p-2 rounded-full"
                                                    animate={{ rotate: 360 }}
                                                    transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
                                                >
                                                    <Bot className="h-5 w-5 text-white" />
                                                </motion.div>
                                                <div className="flex items-center gap-1">
                                                    <span className="text-sm text-gray-600 dark:text-gray-400 mr-2">Thinking</span>
                                                    {[0, 1, 2].map((i) => (
                                                        <motion.div
                                                            key={`dot-${i}`} // Fixed unique key
                                                            className="h-2 w-2 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full"
                                                            animate={{
                                                                scale: [1, 1.5, 1],
                                                                opacity: [0.5, 1, 0.5],
                                                            }}
                                                            transition={{
                                                                duration: 1,
                                                                repeat: Number.POSITIVE_INFINITY,
                                                                delay: i * 0.2,
                                                            }}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Advanced AI Chatbot  */}

                {/* Input area */}
                <div
                    className={cn("p-6 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm rounded-b-3xl border-t border-white/20 dark:border-gray-700/50",
                        isExpanded ? "rounded-none" : "rounded-b-3xl"
                    )}
                >
                    <PlaceholdersAndVanishInput
                        placeholders={[
                            "Tell me about the Software Developement...",
                            "What are top tools for Software Developement ",
                            "How do I start building my dreams",
                            "Who are the CTO, Co-Founders of many startup",
                            "What are the best programming language in 2025",
                            "How can I join Freecodecamp as a student?",
                        ]}
                        onChange={(e) => setInput(e.target.value)}
                        onSubmit={handleFormSubmit}
                        onVanishSubmit={handleVanishSubmit}
                        value={input}
                        disabled={isLoading || isSubmitting}
                    />
                    <p className="text-center text-xs text-gray-500 dark:text-gray-400 mt-3 flex items-center justify-center gap-2">
                        <Sparkles className="h-3 w-3" />
                        Advanced AI Chatbot · Powered by Gemini · {isLoading ? "Processing your question..." : "Ask anything"}
                        {isExpanded && <span className="ml-2">• Press ESC to exit fullscreen</span>}
                    </p>
                </div>
            </motion.div>
        </AnimatePresence>
    )
}
