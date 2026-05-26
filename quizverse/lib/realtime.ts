export type RealtimeEventType = "view" | "download" | "review" | "delete" | "dispute" | "upload" | "sync";

export async function broadcastRealtimeEvent({
  type,
  quizId,
  actorId,
}: {
  type: RealtimeEventType;
  quizId?: string | null;
  actorId?: string | null;
}) {
  const baseUrl = process.env.REALTIME_SERVER_URL || "http://localhost:3001";

  try {
    await fetch(`${baseUrl}/emit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, quizId, actorId }),
      cache: "no-store",
    });
  } catch (error) {
    console.warn("REALTIME_BROADCAST_SKIPPED:", error);
  }
}
