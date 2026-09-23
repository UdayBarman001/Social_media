import { request } from "./client";

// Submits a report for a post or comment
export async function createReport(targetType, targetId, userId, reason) {
  await request(`/reports`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetType, targetId, userId, reason }),
  });
}
