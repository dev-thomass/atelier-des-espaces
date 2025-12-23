// Client pour appeler le proxy Groq local (voir server.js).
// Il attend une route POST /api/chat qui retourne {reply, summary, conversationId}.
const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

export async function sendAssistantMessage({
  message,
  conversationId,
  context = {},
  systemPrompt,
  signal,
}) {
  if (!message || !message.trim()) {
    throw new Error("Message vide");
  }

  const res = await fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      conversationId,
      context,
      systemPrompt,
    }),
    signal,
  });

  if (!res.ok) {
    throw new Error(`API chat error ${res.status}`);
  }

  const data = await res.json();
  const reply = (data.reply || data.message || "").toString().trim();

  return {
    reply: reply || data.raw || "Reponse indisponible",
    summary: data.summary || null,
    conversationId: data.conversationId || conversationId || null,
  };
}
