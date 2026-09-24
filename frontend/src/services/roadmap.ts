import client from "./client";
import { RoadmapResponse } from "@/types";

export const generateRoadmap = async (
    targetRole: string,
    skillGaps: string[],
    provider?: string,
    experienceLevel?: string,
    language: "zh" | "en" = "en"
): Promise<RoadmapResponse> => {
    const activeProvider = provider || localStorage.getItem("preferred_provider") || "groq";
    const { data } = await client.post(
        "/roadmap/generate",
        { 
            target_role: targetRole, 
            skill_gaps: skillGaps, 
            provider: activeProvider,
            experience_level: experienceLevel,
            language
        },
        { timeout: 300_000 }
    );
    return data as RoadmapResponse;
};

export const getRoadmapHistory = async () => {
    const { data } = await client.get("/roadmap/history");
    return data;
};

export const deleteRoadmap = async (roadmapId: string) => {
    const { data } = await client.delete(`/roadmap/${roadmapId}`);
    return data;
};

export const toggleRoadmapWeek = async (roadmapId: string, weekNumber: number, completed?: boolean) => {
    const url = `/roadmap/${roadmapId}/toggle-week/${weekNumber}` + (completed !== undefined ? `?completed=${completed}` : "");
    const { data } = await client.put(url);
    return data;
};

