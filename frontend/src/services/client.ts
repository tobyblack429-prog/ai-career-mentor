import axios from "axios";
import { toast } from "react-hot-toast";

const client = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
    headers: { "Content-Type": "application/json" },
});

// Global response interceptor
client.interceptors.response.use(
    (response) => response,
    async (error) => {
        const url = error.config?.url || "";
        if (error.response?.status === 429) {
            const detail = error.response?.data?.detail || "Daily limit reached. Try again tomorrow.";
            toast.error(`🚫 ${detail}`, {
                duration: 6000, position: "top-center",
                style: { background: "#1e1e2e", color: "#fff", borderRadius: "10px", border: "1px solid #ef4444", maxWidth: "420px" },
            });
            error.message = detail;
        } else if (error.response?.status === 401 && !url.includes("/auth/")) {
            toast.error("The local workspace could not access this feature.", {
                style: { background: "#333", color: "#fff" },
            });
        }
        return Promise.reject(error);
    }
);

export default client;

/** Returns the base API URL for use with native fetch() SSE calls. */
export const getBaseUrl = (): string =>
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/** Returns Authorization header for use with native fetch() calls. */
export const getAuthHeaders = (): Record<string, string> => {
    return {};
};
