// Minimal Groq-backed chat proxy for the frontend assistant.
// Usage:
// 1) Crée un fichier .env à la racine avec GROQ_API_KEY=gsk_xxx
// 2) npm install (si besoin) puis: node server.js
// 3) Le front peut appeler POST /api/chat

import express from "express";
import "dotenv/config";
import mysql from "mysql2/promise";

const app = express();
app.use(express.json());

const GROQ_API_KEY = process.env.GROQ_API_KEY;
// Modèle par défaut : remplacer si besoin (3.1-70b est déprécié)
const MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

if (!GROQ_API_KEY) {
  console.warn("⚠️ GROQ_API_KEY manquant. Ajoute-le dans .env");
}

// Historique en memoire: conserve les 3 derniers messages (user/assistant) + dernier summary par conversation
// Structure: { messages: [{role, content}, ...], summary: null|object }
const historyStore = new Map();

// Pool MySQL (optionnel) - configure via .env
let mysqlPool = null;
const getMySQLPool = () => {
  if (mysqlPool) return mysqlPool;
  const { MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE, MYSQL_PORT } = process.env;
  if (!MYSQL_HOST || !MYSQL_USER || !MYSQL_PASSWORD || !MYSQL_DATABASE) {
    console.warn("MySQL non configure (variables .env manquantes)");
    return null;
  }
  mysqlPool = mysql.createPool({
    host: MYSQL_HOST,
    user: MYSQL_USER,
    password: MYSQL_PASSWORD,
    database: MYSQL_DATABASE,
    port: MYSQL_PORT ? Number(MYSQL_PORT) : 3306,
    connectionLimit: 5,
  });
  return mysqlPool;
};

app.get("/api/chat/:conversationId", (req, res) => {
  const cid = req.params.conversationId;
  const record = historyStore.get(cid);
  if (!record) {
    return res.status(404).json({ error: "Conversation introuvable" });
  }
  res.json({
    conversationId: cid,
    history: record.messages || [],
    summary: record.summary || null,
  });
});

// Health check MySQL
app.get("/api/db/health", async (req, res) => {
  try {
    const pool = getMySQLPool();
    if (!pool) {
      return res.status(503).json({ status: "mysql_not_configured" });
    }
    const [rows] = await pool.query("SELECT 1 AS ok");
    res.json({ status: "ok", result: rows[0] });
  } catch (error) {
    console.error("MySQL health error:", error);
    res.status(500).json({ status: "error", error: error.message });
  }
});

app.post("/api/chat", async (req, res) => {
  const { message, conversationId, context = {}, systemPrompt } = req.body || {};

  if (!message || !message.trim()) {
    return res.status(400).json({ error: "Message manquant" });
  }

  const cid = conversationId || crypto.randomUUID();
  const pastRecord = historyStore.get(cid) || { messages: [], summary: null };
  const past = pastRecord.messages || [];

  // Limite a 3 derniers messages (user/assistant)
  const limitedPast = past.slice(-6);

  const basePrompt = `
Tu es un assistant qui aide a cadrer un projet de renovation/amenagement.
Reponds en renvoyant STRICTEMENT un JSON valide avec les cles:
{
  "message": "reponse utilisateur",
  "summary": {
    "typeProjet": "",
    "typeBien": "",
    "surface": "",
    "budget": "",
    "delai": "",
    "adresse": "",
    "description": "",
    "coordonnees": { "nom": "", "email": "", "telephone": "" },
    "pointsOuverts": []
  }
}
Si une info est inconnue, laisse une chaine vide ou ajoute dans pointsOuverts.
Context: ${JSON.stringify(context)}
ConversationId: ${cid}
`;
  const finalSystemPrompt = systemPrompt && systemPrompt.trim() ? systemPrompt : basePrompt;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: finalSystemPrompt },
          ...limitedPast,
          { role: "user", content: message },
        ],
        max_tokens: 800,
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Groq error:", err);
      return res.status(500).json({ error: "Erreur API Groq" });
    }

    const data = await response.json();
    const raw = data?.choices?.[0]?.message?.content || "";

    const tryParse = (text) => {
      try {
        return JSON.parse(text);
      } catch (e) {
        return null;
      }
    };

    let parsed = tryParse(raw);

    // Si la réponse contient un bloc de code ou du texte autour, extraire le premier JSON.
    if (!parsed) {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = tryParse(match[0]);
      }
    }

    if (!parsed) {
      parsed = { message: raw || "Reponse indisponible", summary: null };
    }

    const replyText = (parsed.message || raw || "").toString().trim();

    // Met a jour l'historique (limite 3 derniers messages utilisateur/assistant) + summary
    const updatedMessages = [...limitedPast, { role: "user", content: message }, { role: "assistant", content: replyText }];
    historyStore.set(cid, {
      messages: updatedMessages.slice(-6),
      summary: parsed.summary || pastRecord.summary || null,
    });

    const payload = {
      reply: replyText || "Reponse indisponible",
      raw,
      summary: parsed.summary || null,
      conversationId: cid,
    };

    res.json(payload);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur API" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend Groq sur http://localhost:${PORT}`));
