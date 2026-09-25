import client from "./client";

export const checkAdminAccess = async () => {
    const { data } = await client.get("/admin/access");
    return data.authorized === true;
};

export const getAdminMetrics = async () => {
    const { data } = await client.get("/admin/metrics");
    return data;
};
