import React from "react";
import { Bot, User } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";

interface Props {
    msg: {
        role: string;
        content: string;
        type?: string;
    };
    isSpeaking?: boolean;
}

function renderMessageContent(content: string): React.ReactNode {
    if (!content) return null;
    const codeBlockRegex = /```(?:([a-zA-Z0-9+#-]+)\n)?([\s\S]*?)```/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = codeBlockRegex.exec(content)) !== null) {
        const textBefore = content.slice(lastIndex, match.index);
        if (textBefore) {
            parts.push(
                <span key={`text-${lastIndex}`} style={{ whiteSpace: "pre-wrap" }}>
                    {textBefore}
                </span>
            );
        }

        parts.push(
            <pre
                key={`code-${match.index}`}
                style={{
                    background: "var(--bg-base)",
                    padding: "14px 18px",
                    borderRadius: "var(--radius-lg)",
                    overflowX: "auto",
                    margin: "12px 0",
                    whiteSpace: "pre",
                    fontFamily: "var(--font-mono), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                    fontSize: "0.8125rem",
                    border: "1px solid var(--border-default)",
                    color: "var(--fg-secondary)"
                }}
            >
                <code>{match[2]}</code>
            </pre>
        );

        lastIndex = match.index + match[0].length;
    }

    const textAfter = content.slice(lastIndex);
    if (textAfter) {
        parts.push(
            <span key={`text-${lastIndex}`} style={{ whiteSpace: "pre-wrap" }}>
                {textAfter}
            </span>
        );
    }

    return <>{parts}</>;
}

export const ChatMessage = React.memo(({ msg, isSpeaking }: Props) => {
    const { locale } = useLanguage();
    if (msg.role === "system" || !msg.content.trim()) return null;

    const isInterviewer = msg.role === "interviewer" || msg.role === "interviewer_stream";
    const isCandidate = msg.role === "candidate";
    const visibleContent = locale === "zh" && isInterviewer && !/[\u3400-\u9fff]/.test(msg.content) && /[A-Za-z]{4}/.test(msg.content)
        ? "这条历史面试内容没有中文版本，请重新开始面试以生成中文问题。"
        : msg.content;

    return (
        <div
            className="animate-fade-in"
            style={{
                display: "flex",
                gap: "12px",
                marginBottom: "20px",
                maxWidth: isCandidate ? "80%" : "85%",
                alignSelf: isCandidate ? "flex-end" : "flex-start",
                flexDirection: isCandidate ? "row-reverse" : "row",
            }}
        >
            <div style={{ flexShrink: 0, marginTop: "2px" }}>
                {isInterviewer ? (
                    <div
                        className={isSpeaking ? "speaking-pulse" : ""}
                        style={{
                            width: "32px", height: "32px",
                            background: "var(--brand-gradient)",
                            borderRadius: "var(--radius-md)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            color: "white",
                            boxShadow: isSpeaking ? "0 0 12px rgba(59, 130, 246, 0.3)" : "none"
                        }}
                    >
                        <Bot size={16} />
                    </div>
                ) : (
                    <div style={{
                        width: "32px", height: "32px",
                        background: "var(--bg-muted)",
                        borderRadius: "var(--radius-md)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: "var(--fg-muted)"
                    }}>
                        <User size={16} />
                    </div>
                )}
            </div>
            <div
                style={{
                    flex: 1, minWidth: 0,
                    padding: "12px 16px",
                    background: isCandidate ? "var(--brand)" : "var(--bg-surface)",
                    borderRadius: isCandidate ? "var(--radius-lg) var(--radius-lg) var(--radius-sm) var(--radius-lg)" : "var(--radius-lg) var(--radius-lg) var(--radius-lg) var(--radius-sm)",
                    border: isCandidate ? "none" : "1px solid var(--border-subtle)",
                }}
            >
                <div style={{
                    color: isCandidate ? "#ffffff" : "var(--fg-primary)",
                    fontSize: "0.875rem", lineHeight: "1.65", wordBreak: "break-word"
                }}>
                    {renderMessageContent(visibleContent)}
                </div>
            </div>
        </div>
    );
});

ChatMessage.displayName = "ChatMessage";
