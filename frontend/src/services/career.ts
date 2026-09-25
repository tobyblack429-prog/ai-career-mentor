import client, { getBaseUrl, getAuthHeaders } from "./client";
import { FullAnalysisResponse } from "@/types";

export const runFullAnalysisNew = async (
    resumeText: string,
    targetRole: string,
    location: string,
    provider?: string,
    experienceLevel?: string | ((msg: string) => void),
    learningStyle?: string,
    onLog?: (msg: string) => void,
): Promise<FullAnalysisResponse> => {
    const activeProvider = provider || localStorage.getItem("preferred_provider") || "groq";

    let realExpLevel: string | undefined = undefined;
    let realLearnStyle: string | undefined = undefined;
    let realOnLog: ((msg: string) => void) | undefined = undefined;

    console.log("runFullAnalysis inputs:", {
        experienceLevel,
        experienceLevelType: typeof experienceLevel,
        learningStyle,
        learningStyleType: typeof learningStyle,
        onLog,
        onLogType: typeof onLog,
    });

    // Dynamically detect callback and settings to avoid issues with cached client-side code / parameter shifts
    if (typeof experienceLevel === "function") {
        realOnLog = experienceLevel;
    } else if (typeof learningStyle === "function") {
        realOnLog = learningStyle;
        realExpLevel = experienceLevel;
    } else {
        realExpLevel = experienceLevel;
        realLearnStyle = learningStyle;
        if (typeof onLog === "function") {
            realOnLog = onLog;
        }
    }

    console.log("runFullAnalysis resolved:", {
        realExpLevel,
        realLearnStyle,
        realOnLogType: typeof realOnLog,
    });


    const response = await fetch(`${getBaseUrl()}/career/full-analysis/stream`, {
        method: "POST",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
        },
        body: JSON.stringify({
            resume_text: resumeText,
            target_role: targetRole,
            location,
            provider: activeProvider,
            experience_level: realExpLevel,
            learning_style: realLearnStyle,
        }),
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: "Analysis failed" }));
        throw new Error(err.detail || `HTTP ${response.status}`);
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const raw = line.slice(6).trim();
            if (!raw) continue;
            
            let event: any;
            try {
                event = JSON.parse(raw);
            } catch {
                // Ignore parse errors for partial chunks
                continue;
            }

            if (event.type === "log" && realOnLog) {
                realOnLog(event.message);
            } else if (event.type === "result") {
                return event.payload as FullAnalysisResponse;
            } else if (event.type === "error") {
                throw new Error(event.message || "Analysis stream error");
            }
        }
    }

    throw new Error("Stream ended without a result.");
};

export const runFullAnalysis = runFullAnalysisNew;

export const getCareerAnalysisHistory = async (): Promise<any[]> => {
    const { data } = await client.get("/career/history");
    return data;
};

export const deleteCareerAnalysis = async (id: string): Promise<any> => {
    const { data } = await client.delete(`/career/history/${id}`);
    return data;
};
