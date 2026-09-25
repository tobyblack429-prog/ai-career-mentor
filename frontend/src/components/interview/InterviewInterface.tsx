import React, { useState, useEffect, useRef, useCallback } from "react";
import { Send, Square, Code, Clock, Star, Target, MessageSquare, Loader2, Sparkles, Bot } from "lucide-react";
import dynamic from "next/dynamic";
import { ChatMessage } from "./ChatMessage";
import { useLanguage } from "@/components/LanguageProvider";

const Editor = dynamic(
    () => import("@monaco-editor/react").catch((err) => {
        console.error("Failed to load Monaco Editor:", err);
        if (typeof window !== "undefined") {
            window.location.reload();
        }
        return { default: () => <div style={{ padding: "20px", color: "var(--fg-muted)" }}>Reloading editor...</div> };
    }),
    { ssr: false }
);

const LiveTimer = React.memo(() => {
    const [elapsed, setElapsed] = useState(0);
    useEffect(() => {
        const t = setInterval(() => setElapsed(p => p + 1), 1000);
        return () => clearInterval(t);
    }, []);
    return (
        <span style={{ fontSize: "1rem", color: "var(--fg-primary)", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
            {Math.floor(elapsed / 60)}:{(elapsed % 60).toString().padStart(2, "0")}
        </span>
    );
});
LiveTimer.displayName = "LiveTimer";

const MessageList = React.memo(({ messages, isSpeaking }: {
    messages: any[];
    isSpeaking: boolean;
}) => (
    <>
        {messages.map((m, i) => (
            <ChatMessage
                key={i}
                msg={m}
                isSpeaking={isSpeaking && i === messages.length - 1}
            />
        ))}
    </>
));
MessageList.displayName = "MessageList";

const CSS_KEYFRAMES = `
@keyframes interview-bounce {
    0%, 100% { transform: scaleY(0.3); }
    50% { transform: scaleY(1.3); }
}
@keyframes interview-pulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.5); }
    50% { box-shadow: 0 0 16px 6px rgba(59, 130, 246, 0.2); }
}
.custom-scrollbar::-webkit-scrollbar { width: 4px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.06); border-radius: 99px; }
.custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.12); }
`;

interface Props {
    role: string;
    company: any;
    type: string;
    roleLevel?: string;
    onEnd: (score: number, feedback: string) => void;
    onBack?: () => void;
}

export default function InterviewInterface({ role, company, type, roleLevel, onEnd, onBack }: Props) {
    const { t, locale } = useLanguage();
    const [messages, setMessages] = useState<any[]>([]);
    const [streamingMessage, setStreamingMessage] = useState("");
    const [inputVal, setInputVal] = useState("");
    const [codingMode, setCodingMode] = useState(false);
    const [codeVal, setCodeVal] = useState("// Write your code here...\n");
    const [language, setLanguage] = useState("python");
    const [isThinking, setIsThinking] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [questionCount, setQuestionCount] = useState(0);
    const [totalQuestions, setTotalQuestions] = useState(10);
    const [phaseName, setPhaseName] = useState("");
    const [status, setStatus] = useState("Initializing...");
    const [showEndModal, setShowEndModal] = useState(false);
    const [isFinished, setIsFinished] = useState(false);
    const [isInputFocused, setIsInputFocused] = useState(false);
    const [isInputBlocked, setIsInputBlocked] = useState(false);
    const [rateLimitMessage, setRateLimitMessage] = useState<string | null>(null);
    const [connectionError, setConnectionError] = useState<string | null>(null);

    const wsRef = useRef<WebSocket | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messageFeedRef = useRef<HTMLDivElement>(null);
    const currentAudioRef = useRef<HTMLAudioElement | null>(null);
    const audioQueueRef = useRef<any[]>([]);
    const isPlayingRef = useRef(false);
    const isConnectingRef = useRef(false);
    const finalScoreRef = useRef<number | null>(null);
    const finalFeedbackRef = useRef<string>("");
    const sessionIdRef = useRef<string | null>(null);
    const reconnectAttemptsRef = useRef(0);
    const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isClosedByUserRef = useRef(false);
    const isFinishedRef = useRef(false);
    const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const wsUrlRef = useRef<string>("");
    const onMessageRef = useRef<((event: MessageEvent) => void) | null>(null);
    const onOpenRef = useRef<(() => void) | null>(null);
    const onCloseRef = useRef<((event: CloseEvent) => void) | null>(null);
    const onErrorRef = useRef<((event: Event) => void) | null>(null);
    const isMountedRef = useRef(true);
    const isReconnectingRef = useRef(false);
    const hasReceivedQuestionRef = useRef(false);
    const waitingForInterviewerRef = useRef(true);
    const lastMessageTimeRef = useRef(0);
    const startupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const staleCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const STALE_WS_TIMEOUT = 60000; // 60s without any message = stale
    const MAX_RECONNECT_ATTEMPTS = 5;
    const RECONNECT_DELAY_MS = 3000;

    const streamBufferRef = useRef("");
    const streamRafRef = useRef<number | null>(null);

    const flushStreamBuffer = useCallback(() => {
        if (streamBufferRef.current) {
            const chunk = streamBufferRef.current;
            streamBufferRef.current = "";
            setStreamingMessage(prev => prev + chunk);
        }
        streamRafRef.current = null;
    }, []);

    const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const scrollToBottom = useCallback(() => {
        if (scrollTimeoutRef.current) return;
        scrollTimeoutRef.current = setTimeout(() => {
            if (messageFeedRef.current) {
                messageFeedRef.current.scrollTo({
                    top: messageFeedRef.current.scrollHeight,
                    behavior: "smooth"
                });
            }
            scrollTimeoutRef.current = null;
        }, 150);
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages, isInputBlocked, isFinished, scrollToBottom]);

    useEffect(() => {
        if (streamingMessage) scrollToBottom();
    }, [streamingMessage, scrollToBottom]);

    const processAudioQueueRef = useRef<(() => void) | null>(null);

    const processAudioQueue = useCallback(async () => {
        if (isPlayingRef.current || audioQueueRef.current.length === 0) return;
        isPlayingRef.current = true;
        setIsSpeaking(true);
        const audioBase64 = audioQueueRef.current.shift();
        const audio = new Audio(`data:audio/mp3;base64,${audioBase64}`);
        currentAudioRef.current = audio;
        const handleQueueNext = () => {
            isPlayingRef.current = false;
            setIsSpeaking(false);
            if (finalScoreRef.current !== null && audioQueueRef.current.length === 0) {
                console.log("Audio ended. User can click 'View Your Score'.");
            } else if (processAudioQueueRef.current) {
                processAudioQueueRef.current();
            }
        };
        audio.onended = handleQueueNext;
        audio.onerror = () => {
            console.warn("Audio chunk failed to decode, skipping to next.");
            handleQueueNext();
        };
        try {
            await new Promise(resolve => setTimeout(resolve, 200));
            await audio.play();
        } catch {
            handleQueueNext();
        }
    }, []);

    // Keep a stable ref to processAudioQueue for use in the WebSocket handler
    processAudioQueueRef.current = processAudioQueue;

    // ── WebSocket Connection with Auto-Reconnect ──────────────────────────
    useEffect(() => {
        isMountedRef.current = true;
        isClosedByUserRef.current = false;
        isFinishedRef.current = false;
        reconnectAttemptsRef.current = 0;
        hasReceivedQuestionRef.current = false;
        waitingForInterviewerRef.current = true;
        lastMessageTimeRef.current = Date.now();

        const activeProvider = localStorage.getItem("preferred_provider") || "groq";
        if (!sessionIdRef.current) {
            sessionIdRef.current = Date.now().toString();
        }
        const sessionId = sessionIdRef.current;
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV === "production" ? "/api" : "http://localhost:8000");
        const absoluteApiUrl = apiUrl.startsWith("/") ? `${window.location.origin}${apiUrl}` : apiUrl;
        const wsUrl = absoluteApiUrl.replace(/^http/, "ws") + `/interview/ws/${sessionId}?role=${encodeURIComponent(role)}&company=${encodeURIComponent(company.name)}&company_tier=${company.tier}&company_style=${encodeURIComponent(company.interviewStyle)}&type=${encodeURIComponent(type)}&provider=${activeProvider}&language=${locale}${roleLevel ? `&role_level=${encodeURIComponent(roleLevel)}` : ""}`;
        wsUrlRef.current = wsUrl;

        // ── Message handler (shared across reconnects) ──
        onMessageRef.current = (event) => {
            if (event.data === "__pong__") return;

            let data;
            try {
                data = JSON.parse(event.data);
            } catch {
                console.error("Failed to parse WS message:", event.data);
                return;
            }

            // Record the latest server activity for in-flight response checks.
            lastMessageTimeRef.current = Date.now();
            reconnectAttemptsRef.current = 0; // Reset reconnect counter on successful message

            if (data.audio) {
                audioQueueRef.current.push(data.audio);
                if (processAudioQueueRef.current) {
                    processAudioQueueRef.current();
                }
            }

            if (data.role === "interviewer_stream") {
                streamBufferRef.current += data.content;
                if (!streamRafRef.current) {
                    streamRafRef.current = requestAnimationFrame(flushStreamBuffer);
                }
                setIsThinking(false);
            } else if (data.role === "interviewer") {
                if (data.type === "question" || data.type === "concluding") {
                    hasReceivedQuestionRef.current = true;
                    waitingForInterviewerRef.current = false;
                    setIsThinking(false);
                    if (typeof data.question_number === "number") {
                        setQuestionCount(data.question_number);
                    } else {
                        setQuestionCount(p => p + 1);
                    }
                    if (typeof data.total_questions === "number") {
                        setTotalQuestions(data.total_questions);
                    }
                    if (data.phase_name) {
                        setPhaseName(data.phase_name);
                    }
                }
                if (data.type === "feedback") {
                    waitingForInterviewerRef.current = false;
                    setIsThinking(false);
                    const scoreMatch = data.content.match(/OVERALL SCORE\s*:\s*(\d+)/i);
                    if (scoreMatch) finalScoreRef.current = parseInt(scoreMatch[1]);
                    finalFeedbackRef.current = data.content;
                    isFinishedRef.current = true;
                    setIsFinished(true);
                    setStatus("Completed");
                    setStreamingMessage("");
                    streamBufferRef.current = "";
                    return;
                }
                if (data.content) {
                    setMessages(prev => {
                        const last = prev[prev.length - 1];
                        return last?.role === "interviewer" && last.content === data.content
                            ? prev
                            : [...prev, { role: "interviewer", content: data.content }];
                    });
                    setStreamingMessage("");
                    streamBufferRef.current = "";
                }
            } else if (data.role === "system") {
                if (data.type === "error") {
                    isClosedByUserRef.current = true;
                    setConnectionError(data.content || (locale === "zh" ? "面试服务暂时不可用。" : "The interview service is unavailable."));
                    setStatus("Connection Lost");
                    setIsThinking(false);
                    setStreamingMessage("");
                    streamBufferRef.current = "";
                    wsRef.current?.close();
                    return;
                }
                if (data.type === "rate_limit") {
                    // Blocked by daily/gap rate limit — stop reconnecting and surface the message
                    isClosedByUserRef.current = true;
                    isFinishedRef.current = true;
                    setRateLimitMessage(data.content || "Your interview limit has been reached.");
                    setStatus("Limit Reached");
                    setStreamingMessage("");
                    streamBufferRef.current = "";
                    if (wsRef.current) {
                        try { wsRef.current.close(); } catch { /* ignore */ }
                    }
                    return;
                }
                if (data.type === "concluding" || data.content === "Interview Concluding...") {
                    setIsInputBlocked(true);
                } else if (data.type === "completed" || data.content === "Interview Completed.") {
                    isFinishedRef.current = true;
                    setIsFinished(true);
                    setIsInputBlocked(true);
                    setStatus("Completed");
                    if (data.score !== undefined) {
                        finalScoreRef.current = data.score;
                    }
                }
            }
        };

        // ── Open handler ──
        onOpenRef.current = () => {
            setStatus("Active Session");
            reconnectAttemptsRef.current = 0;
            if (typeof window !== "undefined") {
                window.dispatchEvent(new Event("rateLimitUpdated"));
            }
        };

        // ── Close handler with auto-reconnect ──
        onCloseRef.current = (event) => {
            if (isClosedByUserRef.current || isFinishedRef.current || !isMountedRef.current) return;

            // Normal close (1000) after interview completion — don't reconnect
            if (event.code === 1000 && isFinishedRef.current) return;

            // Don't reconnect if interview is already finished
            if (isFinishedRef.current) return;

            // Attempt reconnect
            if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
                reconnectAttemptsRef.current += 1;
                const delay = RECONNECT_DELAY_MS * reconnectAttemptsRef.current;
                setStatus(`Reconnecting (${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})...`);
                if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
                reconnectTimerRef.current = setTimeout(() => {
                    if (isMountedRef.current && !isClosedByUserRef.current && !isFinishedRef.current) {
                        connectWebSocket();
                    }
                }, delay);
            } else {
                setStatus("Connection Lost");
                setConnectionError(locale === "zh" ? "面试连接已中断，请返回后重新开始。" : "The interview connection was lost. Go back and start again.");
            }
        };

        // ── Error handler ──
        onErrorRef.current = () => {
            // WebSocket errors are followed by close events — handle in onClose
        };

        // ── Connect function ──
        const connectWebSocket = () => {
            if (!isMountedRef.current || isClosedByUserRef.current || isFinishedRef.current) return;
            if (isReconnectingRef.current) return;
            isReconnectingRef.current = true;

            try {
                const ws = new WebSocket(wsUrlRef.current);
                wsRef.current = ws;

                ws.onopen = () => {
                    isReconnectingRef.current = false;
                    if (onOpenRef.current) onOpenRef.current();
                };

                ws.onmessage = (event) => {
                    if (onMessageRef.current) onMessageRef.current(event);
                };

                ws.onclose = (event) => {
                    isReconnectingRef.current = false;
                    if (onCloseRef.current) onCloseRef.current(event);
                };

                ws.onerror = (event) => {
                    if (onErrorRef.current) onErrorRef.current(event);
                };
            } catch (e) {
                console.error("Failed to create WebSocket:", e);
                isReconnectingRef.current = false;
            }
        };

        // ── Ping keep-alive ──
        pingIntervalRef.current = setInterval(() => {
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send("__ping__");
            }
        }, 25000);

        // ── Stale connection detection ──
        staleCheckIntervalRef.current = setInterval(() => {
            if (isFinishedRef.current || isClosedByUserRef.current) return;
            const now = Date.now();
            // An idle candidate may spend minutes thinking. Reconnect only
            // while an answer is actually waiting for the interviewer.
            if (hasReceivedQuestionRef.current && waitingForInterviewerRef.current &&
                (now - lastMessageTimeRef.current) > STALE_WS_TIMEOUT) {
                console.warn("WebSocket appears stale — forcing reconnect");
                if (wsRef.current) {
                    try { wsRef.current.close(); } catch { /* ignore */ }
                }
                // onclose handler will trigger reconnect
            }
        }, 15000);

        // Initial connection
        connectWebSocket();
        startupTimeoutRef.current = setTimeout(() => {
            if (isMountedRef.current && !hasReceivedQuestionRef.current &&
                !isClosedByUserRef.current && !isFinishedRef.current) {
                isClosedByUserRef.current = true;
                setConnectionError(locale === "zh"
                    ? "面试题目等待超时，请返回面试设置后重试。"
                    : "The interview question timed out. Go back and try again.");
                setStatus("Connection Lost");
                setIsThinking(false);
                wsRef.current?.close();
            }
        }, 60000);

        // ── Cleanup ──
        return () => {
            isMountedRef.current = false;
            isClosedByUserRef.current = true;
            if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
            if (staleCheckIntervalRef.current) clearInterval(staleCheckIntervalRef.current);
            if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
            if (startupTimeoutRef.current) clearTimeout(startupTimeoutRef.current);
            if (wsRef.current) {
                try { wsRef.current.close(); } catch { /* ignore */ }
            }
            isConnectingRef.current = false;
            if (streamRafRef.current) cancelAnimationFrame(streamRafRef.current);
            if (typeof window !== "undefined") {
                window.dispatchEvent(new Event("rateLimitUpdated"));
            }
        };
    }, [role, type, roleLevel, company.name, company.tier, company.interviewStyle, locale, flushStreamBuffer]);

    const stopAudio = useCallback(() => {
        if (currentAudioRef.current) {
            currentAudioRef.current.pause();
            currentAudioRef.current.currentTime = 0;
            currentAudioRef.current = null;
        }
        audioQueueRef.current = [];
        isPlayingRef.current = false;
        setIsSpeaking(false);
    }, []);

    const handleSend = useCallback(() => {
        if (wsRef.current?.readyState !== 1) return;
        const cleanCode = codeVal.trim();
        const hasCode = cleanCode &&
            cleanCode !== "// Write your code here..." &&
            cleanCode !== "// Write your code here...\n";

        if (!inputVal.trim() && !hasCode) return;

        stopAudio();

        const parts: string[] = [];
        if (inputVal.trim()) {
            parts.push(inputVal.trim());
        }
        if (hasCode) {
            parts.push(`Code Solution:\n\`\`\`${language}\n${codeVal}\n\`\`\``);
        }
        const fullMsg = parts.join("\n\n");

        wsRef.current?.send(fullMsg);
        waitingForInterviewerRef.current = true;
        lastMessageTimeRef.current = Date.now();
        setMessages(prev => [...prev, { role: "candidate", content: fullMsg }]);
        setInputVal("");
        setCodeVal("// Write your code here...\n");
        setCodingMode(false);
        setIsThinking(true);
    }, [inputVal, codeVal, language, stopAudio]);

    const isDisabled = isThinking || isSpeaking || isInputBlocked || !!connectionError || !!rateLimitMessage || wsRef.current?.readyState !== 1;
    const isSessionOver = isFinished || isInputBlocked || !!connectionError || !!rateLimitMessage;

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey && !isDisabled) {
            e.preventDefault();
            handleSend();
        }
    }, [handleSend, isDisabled]);

    return (
        <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "20px", minHeight: "calc(100vh - 100px)", padding: "0 0 48px 0", position: "relative", zIndex: 1 }}>
            <style dangerouslySetInnerHTML={{ __html: CSS_KEYFRAMES }} />

            {/* Interview unavailable / limit overlay */}
            {(rateLimitMessage || connectionError) && (
                <div style={{
                    position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
                    background: "rgba(0, 0, 0, 0.72)", backdropFilter: "blur(12px)",
                    zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px"
                }}>
                    <div className="card animate-scale-in" style={{ width: "100%", maxWidth: "440px", padding: "36px", textAlign: "center" }}>
                        <div style={{
                            width: "64px", height: "64px", borderRadius: "var(--radius-xl)",
                            background: "rgba(245, 158, 11, 0.08)", border: "1px solid rgba(245, 158, 11, 0.18)",
                            display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px"
                        }}>
                            <Clock size={28} style={{ color: "var(--accent-amber)" }} />
                        </div>
                        <h3 className="font-display" style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--fg-primary)", marginBottom: "10px" }}>
                            {connectionError ? (locale === "zh" ? "面试服务暂时不可用" : "Interview Unavailable") : (locale === "zh" ? "面试次数已达上限" : "Daily Limit Reached")}
                        </h3>
                        <p style={{ color: "var(--fg-secondary)", lineHeight: 1.65, fontSize: "0.875rem", marginBottom: "24px" }}>
                            {connectionError || rateLimitMessage}
                        </p>
                        <div className="flex" style={{ gap: "10px" }}>
                            {onBack && (
                                <button
                                    onClick={onBack}
                                    className="btn btn-primary"
                                    style={{ flex: 1, padding: "12px", borderRadius: "var(--radius-md)", fontWeight: 600 }}
                                >
                                    {locale === "zh" ? "返回面试设置" : "Back to Wizard"}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="card" style={{ padding: "20px 28px", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
                <div className="flex items-center" style={{ gap: "16px" }}>
                    <div style={{
                        width: "44px", height: "44px", borderRadius: "var(--radius-lg)",
                        background: "var(--brand-gradient)", display: "flex", alignItems: "center", justifyContent: "center",
                        boxShadow: "0 4px 12px rgba(59, 130, 246, 0.2)"
                    }}>
                        <Bot size={22} color="white" />
                    </div>
                    <div>
                        <h2 className="font-display" style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--fg-primary)", margin: 0, marginBottom: "2px" }}>{t("AI Interviewer")}</h2>
                        <div className="flex items-center" style={{ gap: "10px" }}>
                            <div className="flex items-center" style={{ gap: "5px" }}>
                                <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--accent-emerald)", boxShadow: "0 0 8px var(--accent-emerald)" }} />
                                <span style={{ fontSize: "0.75rem", color: "var(--accent-emerald)", fontWeight: 600 }}>{t(status)}</span>
                            </div>
                            <span style={{ color: "var(--fg-disabled)", fontSize: "0.75rem" }}>|</span>
                            <span style={{ fontSize: "0.8125rem", color: "var(--fg-secondary)" }}>
                                {role} <span style={{ color: "var(--brand)" }}>@</span> {company?.name || "Company"}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center" style={{ gap: "12px" }}>
                    {isSpeaking && (
                        <div className="flex items-center" style={{
                            gap: "6px", padding: "6px 14px", borderRadius: "99px",
                            background: "var(--brand-glow)", border: "1px solid rgba(59, 130, 246, 0.15)"
                        }}>
                            <Sparkles size={14} style={{ color: "var(--brand)" }} />
                            <span style={{ fontSize: "0.7rem", color: "var(--brand-light)", fontWeight: 700 }}>{t("SPEAKING")}</span>
                            <div className="flex items-center" style={{ gap: "2px", height: "12px" }}>
                                <div style={{ width: "2px", height: "6px", background: "var(--brand)", borderRadius: "1px", animation: "interview-bounce 0.8s ease-in-out infinite" }} />
                                <div style={{ width: "2px", height: "10px", background: "var(--accent-cyan)", borderRadius: "1px", animation: "interview-bounce 0.8s ease-in-out infinite 0.15s" }} />
                                <div style={{ width: "2px", height: "7px", background: "var(--brand)", borderRadius: "1px", animation: "interview-bounce 0.8s ease-in-out infinite 0.3s" }} />
                                <div style={{ width: "2px", height: "4px", background: "var(--accent-cyan)", borderRadius: "1px", animation: "interview-bounce 0.8s ease-in-out infinite 0.45s" }} />
                            </div>
                        </div>
                    )}
                    <button
                        onClick={() => setShowEndModal(true)}
                        className="btn btn-ghost"
                        style={{ color: "var(--accent-rose)", padding: "8px 14px", fontSize: "0.8125rem" }}
                    >
                        <Square size={14} /> {t("End")}
                    </button>
                </div>
            </div>

            {/* Split Grid */}
            <div className="interview-workspace-grid" style={{ display: "grid", gap: "20px", flex: 1, alignItems: "start" }}>

                {/* Left: Chat Panel */}
                <div className="card" style={{
                    display: "flex", flexDirection: "column", overflow: "hidden",
                    position: "sticky", top: "24px", height: "calc(100vh - 220px)", minHeight: "calc(100vh - 220px)", minWidth: 0
                }}>
                    <div style={{
                        padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)",
                        display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0
                    }}>
                        <div className="flex items-center" style={{ gap: "8px" }}>
                            <MessageSquare size={15} style={{ color: "var(--brand)" }} />
                            <span style={{ fontWeight: 600, color: "var(--fg-primary)", fontSize: "0.875rem" }}>{t("Interview Record")}</span>
                        </div>
                        <span className="badge badge-brand">{Math.min(questionCount, totalQuestions)} / {totalQuestions}</span>
                    </div>

                    <div ref={messageFeedRef} data-lenis-prevent className="custom-scrollbar" style={{
                        flex: 1, overflowY: "auto", padding: "20px",
                        display: "flex", flexDirection: "column", minHeight: 0
                    }}>
                        {messages.length === 0 && !streamingMessage && (
                            <div className="flex flex-col items-center justify-center" style={{ flex: 1, color: "var(--fg-muted)", gap: "10px", padding: "40px" }}>
                                <Loader2 className="animate-spin" size={24} style={{ color: "var(--brand)" }} />
                                <span style={{ fontSize: "0.8125rem", fontWeight: 500 }}>{t("Spawning Interview Agent...")}</span>
                            </div>
                        )}

                        <MessageList messages={messages} isSpeaking={isSpeaking} />

                        {streamingMessage && (
                            <ChatMessage
                                msg={{ role: "interviewer_stream", content: streamingMessage }}
                                isSpeaking={true}
                            />
                        )}

                        {isThinking && (
                            <div className="flex items-center" style={{ gap: "6px", color: "var(--brand)", fontSize: "0.8125rem", fontWeight: 500, marginLeft: "44px", marginTop: "4px" }}>
                                <Loader2 size={12} className="animate-spin" />
                                <span style={{ fontStyle: "italic" }}>{t("Agent is thinking...")}</span>
                            </div>
                        )}

                        {isInputBlocked && !isFinished && (
                            <div
                                className="animate-pulse"
                                style={{
                                    display: "flex", alignItems: "center", gap: "10px",
                                    color: "var(--accent-cyan)", fontSize: "0.875rem", fontWeight: 600,
                                    background: "rgba(6, 182, 212, 0.05)", border: "1px solid rgba(6, 182, 212, 0.12)",
                                    padding: "14px 18px", borderRadius: "var(--radius-lg)", margin: "12px 0"
                                }}
                            >
                                <Loader2 size={16} className="animate-spin" />
                                <span>{t("Generating your detailed feedback...")}</span>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                </div>

                {/* Right Panel */}
                <div className="flex flex-col" style={{ gap: "16px", minHeight: 0, minWidth: 0 }}>
                    {/* Stats */}
                    <div className="grid grid-cols-2" style={{ gap: "12px", flexShrink: 0 }}>
                        <div className="card" style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: "12px" }}>
                            <div style={{
                                width: "34px", height: "34px", borderRadius: "var(--radius-md)",
                                background: "rgba(6, 182, 212, 0.08)", display: "flex", alignItems: "center", justifyContent: "center"
                            }}>
                                <Clock size={16} style={{ color: "var(--accent-cyan)" }} />
                            </div>
                            <div>
                                <div style={{ fontSize: "0.65rem", color: "var(--fg-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{t("Elapsed")}</div>
                                <LiveTimer />
                            </div>
                        </div>
                        <div className="card" style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: "12px" }}>
                            <div style={{
                                width: "34px", height: "34px", borderRadius: "var(--radius-md)",
                                background: "var(--brand-glow)", display: "flex", alignItems: "center", justifyContent: "center"
                            }}>
                                <Target size={16} style={{ color: "var(--brand)" }} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: "0.65rem", color: "var(--fg-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{t("Progress")}</div>
                                <div style={{ fontSize: "1rem", color: "var(--fg-primary)", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                                    Q {Math.min(questionCount, totalQuestions)}/{totalQuestions}
                                </div>
                                {phaseName && (
                                    <div style={{ fontSize: "0.7rem", color: "var(--brand)", fontWeight: 500, marginTop: "1px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={phaseName}>
                                        {phaseName}
                                    </div>
                                )}
                                <div style={{ width: "100%", height: "3px", background: "rgba(255,255,255,0.08)", borderRadius: "2px", marginTop: "5px", overflow: "hidden" }}>
                                    <div style={{
                                        width: `${Math.min(Math.round((questionCount / totalQuestions) * 100), 100)}%`,
                                        height: "100%",
                                        background: "linear-gradient(90deg, var(--brand) 0%, var(--accent-cyan) 100%)",
                                        transition: "width 0.4s ease"
                                    }} />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Input Area */}
                    {!codingMode ? (
                        <div className="card" style={{
                            display: "flex", flexDirection: "column", overflow: "hidden", minHeight: "240px",
                            borderColor: isInputFocused ? "rgba(59, 130, 246, 0.3)" : undefined,
                            transition: "border-color 0.2s"
                        }}>
                            <div style={{ padding: "14px 18px 8px", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
                                <span style={{ fontWeight: 600, color: "var(--fg-primary)", fontSize: "0.875rem" }}>{t("Your Response")}</span>
                                <div className="flex items-center" style={{ gap: "10px" }}>
                                    <span className="badge badge-green">
                                        <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "var(--accent-emerald)" }} />
                                        {t("LIVE")}
                                    </span>
                                    <span style={{ fontSize: "0.7rem", color: "var(--fg-disabled)" }}>{t("Shift+Enter new line")}</span>
                                </div>
                            </div>
                            <textarea
                                value={inputVal}
                                onChange={(e) => setInputVal(e.target.value)}
                                disabled={isSessionOver}
                                onFocus={() => setIsInputFocused(true)}
                                onBlur={() => setIsInputFocused(false)}
                                onKeyDown={handleKeyDown}
                                onWheel={(e) => e.stopPropagation()}
                                onTouchMove={(e) => e.stopPropagation()}
                                placeholder={t(isSessionOver ? "Interview concluding..." : questionCount >= totalQuestions ? "Ask the interviewer any questions about the company or team..." : "Type your answer here...")}
                                data-lenis-prevent
                                className="custom-scrollbar"
                                style={{
                                    flex: 1, padding: "12px 18px 18px", background: "transparent",
                                    border: "none", color: "var(--fg-primary)", resize: "none", outline: "none",
                                    minHeight: "140px", fontFamily: "inherit", fontSize: "0.875rem",
                                    lineHeight: "1.65", opacity: isSessionOver ? 0.4 : 1, caretColor: "var(--brand)",
                                    overflowY: "auto"
                                }}
                            />
                        </div>
                    ) : (
                        <div className="card animate-fade-up" style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
                            <div style={{
                                padding: "12px 18px", borderBottom: "1px solid var(--border-subtle)",
                                display: "flex", justifyContent: "space-between", alignItems: "center"
                            }}>
                                <div className="flex items-center" style={{ gap: "6px" }}>
                                    <Code size={15} style={{ color: "var(--accent-cyan)" }} />
                                <span style={{ color: "var(--fg-secondary)", fontSize: "0.8125rem", fontWeight: 600 }}>{t("Code Workspace")}</span>
                                </div>
                                <select
                                    value={language}
                                    onChange={e => setLanguage(e.target.value)}
                                    className="input"
                                    style={{ padding: "5px 10px", fontSize: "0.75rem", width: "auto", cursor: "pointer" }}
                                >
                                    <option value="python">Python</option>
                                    <option value="java">Java</option>
                                    <option value="cpp">C++</option>
                                </select>
                            </div>
                            <div style={{ height: "340px" }}>
                                <Editor
                                    height="100%"
                                    theme="vs-dark"
                                    language={language}
                                    value={codeVal}
                                    onChange={(v) => setCodeVal(v || "")}
                                    options={{
                                        fontSize: 13,
                                        minimap: { enabled: false },
                                        padding: { top: 12 },
                                        scrollbar: { vertical: "visible", horizontal: "visible" }
                                    }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex" style={{ gap: "12px", flexShrink: 0 }}>
                        {isFinished ? (
                            <button
                                onClick={() => {
                                    stopAudio();
                                    onEnd(finalScoreRef.current || 90, finalFeedbackRef.current);
                                }}
                                className="btn-glow"
                                style={{
                                    flex: 1, padding: "16px", borderRadius: "var(--radius-lg)",
                                    fontSize: "1rem", fontWeight: 700, animation: "interview-pulse 2.5s infinite"
                                }}
                            >
                                <Star size={18} /> {t("View Score & Evaluation")}
                            </button>
                        ) : (
                            <>
                                <button
                                    onClick={() => setCodingMode(!codingMode)}
                                    disabled={isInputBlocked}
                                    className="btn btn-secondary"
                                    style={{
                                        padding: "14px 18px", borderRadius: "var(--radius-lg)",
                                        opacity: isInputBlocked ? 0.4 : 1, cursor: isInputBlocked ? "not-allowed" : "pointer"
                                    }}
                                >
                                    <Code size={18} />
                                </button>
                                <button
                                    onClick={handleSend}
                                    disabled={isDisabled}
                                    className={isDisabled ? "btn btn-secondary" : "btn-glow"}
                                    style={{
                                        flex: 1, padding: "14px", borderRadius: "var(--radius-lg)",
                                        fontSize: "0.9375rem", fontWeight: 700,
                                        ...(isDisabled ? { opacity: 0.5, cursor: "not-allowed" } : {})
                                    }}
                                >
                                    {isThinking ? t("Thinking...") : t("Submit Answer")} <Send size={15} />
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* End Session Modal */}
            {showEndModal && (
                <div style={{
                    position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
                    background: "rgba(0, 0, 0, 0.7)", backdropFilter: "blur(12px)",
                    zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px"
                }}>
                    <div className="card animate-scale-in" style={{ width: "100%", maxWidth: "400px", padding: "32px", textAlign: "center" }}>
                        <div style={{
                            width: "56px", height: "56px", borderRadius: "var(--radius-xl)",
                            background: "rgba(244, 63, 94, 0.08)", display: "flex", alignItems: "center", justifyContent: "center",
                            margin: "0 auto 20px", border: "1px solid rgba(244, 63, 94, 0.15)"
                        }}>
                            <Square size={24} style={{ color: "var(--accent-rose)" }} />
                        </div>
                        <h3 className="font-display" style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--fg-primary)", marginBottom: "8px" }}>{t("End Simulation?")}</h3>
                        <p style={{ color: "var(--fg-secondary)", marginBottom: "28px", lineHeight: 1.6, fontSize: "0.8125rem" }}>
                            {t("Your results will be saved but the evaluation will be incomplete.")}
                        </p>
                        <div className="flex" style={{ gap: "10px" }}>
                            <button
                                onClick={() => setShowEndModal(false)}
                                className="btn btn-secondary"
                                style={{ flex: 1, padding: "12px", borderRadius: "var(--radius-md)" }}
                            >
                                {t("Resume")}
                            </button>
                            <button
                                onClick={() => {
                                    wsRef.current?.close();
                                    onEnd(0, "Interview terminated early by the candidate.");
                                }}
                                className="btn"
                                style={{
                                    flex: 1, padding: "12px", borderRadius: "var(--radius-md)",
                                    background: "var(--accent-rose)", color: "white", fontWeight: 700
                                }}
                            >
                                {t("End Session")}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
