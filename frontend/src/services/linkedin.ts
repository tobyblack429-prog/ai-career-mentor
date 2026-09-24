import client from "./client";

export const optimizeLinkedin = async (
    targetRole: string,
    provider?: string,
    language: "zh" | "en" = "en"
) => {
    const activeProvider = provider || localStorage.getItem("preferred_provider") || "groq";
    const { data } = await client.post("/linkedin/optimize", { 
        target_role: targetRole,
        provider: activeProvider,
        language
    });
    return data;
};
