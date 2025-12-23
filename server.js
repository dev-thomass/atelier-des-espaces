import express from "express";
import "dotenv/config";
import mysql from "mysql2/promise";
import crypto from "crypto";
import path from "path";
import fs from "fs/promises";
import multer from "multer";
import nodemailer from "nodemailer";

const app = express();
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

if (!GROQ_API_KEY) {
  console.warn("GROQ_API_KEY missing. Add it in .env");
}

const ADMIN_CODE = (process.env.ADMIN_CODE || "").trim();
const ADMIN_SECRET = (process.env.ADMIN_SECRET || process.env.ADMIN_CODE || "").trim();
const TOKEN_TTL_SECONDS = Number(process.env.ADMIN_TOKEN_TTL_SECONDS || 60 * 60 * 12);

if (!ADMIN_CODE) {
  console.warn("ADMIN_CODE missing. Admin login will fail.");
}
if (!process.env.ADMIN_SECRET && ADMIN_CODE) {
  console.warn("ADMIN_SECRET missing. Falling back to ADMIN_CODE for token signing.");
}

const historyStore = new Map();

let mysqlPool = null;
const getMySQLPool = () => {
  if (mysqlPool) return mysqlPool;
  const { MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE, MYSQL_PORT } = process.env;
  if (!MYSQL_HOST || !MYSQL_USER || !MYSQL_PASSWORD || !MYSQL_DATABASE) {
    console.warn("MySQL not configured (missing .env variables)");
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

const initDb = async () => {
  const pool = getMySQLPool();
  if (!pool) return;

  const statements = [
    `CREATE TABLE IF NOT EXISTS projets (
      id VARCHAR(64) PRIMARY KEY,
      titre VARCHAR(255) NOT NULL,
      description TEXT,
      categorie VARCHAR(64),
      image_url TEXT,
      image_label VARCHAR(32),
      images_supplementaires JSON,
      images_labels JSON,
      client VARCHAR(255),
      annee VARCHAR(8),
      surface VARCHAR(64),
      duree VARCHAR(64),
      visible TINYINT(1) DEFAULT 1,
      mis_en_avant TINYINT(1) DEFAULT 0,
      ordre INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS prestations (
      id VARCHAR(64) PRIMARY KEY,
      titre VARCHAR(255) NOT NULL,
      description TEXT,
      prix_indicatif VARCHAR(64),
      duree_estimee VARCHAR(64),
      visible TINYINT(1) DEFAULT 1,
      ordre INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS events (
      id VARCHAR(64) PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      start DATETIME NOT NULL,
      end DATETIME,
      color VARCHAR(32),
      ordre INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS liste_courses (
      id VARCHAR(64) PRIMARY KEY,
      titre VARCHAR(255) NOT NULL,
      categorie VARCHAR(64),
      urgence VARCHAR(32),
      fait TINYINT(1) DEFAULT 0,
      ordre INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS chantiers (
      id VARCHAR(64) PRIMARY KEY,
      titre VARCHAR(255) NOT NULL,
      client VARCHAR(255),
      statut VARCHAR(64),
      date_debut DATE,
      date_fin DATE,
      budget_estime VARCHAR(64),
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS taches (
      id VARCHAR(64) PRIMARY KEY,
      titre VARCHAR(255) NOT NULL,
      priorite VARCHAR(32),
      statut VARCHAR(64),
      date_limite DATE,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS compta_urssaf (
      id VARCHAR(64) PRIMARY KEY,
      periode VARCHAR(32),
      ca_encaisse DECIMAL(12,2),
      charges DECIMAL(12,2),
      date_declaration DATE,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
  ];

  for (const sql of statements) {
    await pool.query(sql);
  }
};

const encodeBase64Url = (value) => Buffer.from(value).toString("base64url");
const decodeBase64Url = (value) => Buffer.from(value, "base64url").toString("utf-8");

const signToken = (payload) => {
  if (!ADMIN_SECRET) return null;
  const data = {
    ...payload,
    exp: Date.now() + TOKEN_TTL_SECONDS * 1000,
  };
  const encoded = encodeBase64Url(JSON.stringify(data));
  const signature = crypto.createHmac("sha256", ADMIN_SECRET).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
};

const verifyToken = (token) => {
  if (!token || !ADMIN_SECRET) return null;
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;
  const expected = crypto.createHmac("sha256", ADMIN_SECRET).update(encoded).digest("base64url");
  if (signature.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  const payload = JSON.parse(decodeBase64Url(encoded));
  if (payload.exp && Date.now() > payload.exp) return null;
  return payload;
};

const optionalAuth = (req, _res, next) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const payload = token ? verifyToken(token) : null;
  if (payload) {
    req.admin = payload;
  }
  next();
};

const requireAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const payload = token ? verifyToken(token) : null;
  if (!payload) {
    return res.status(401).json({ error: "unauthorized" });
  }
  req.admin = payload;
  next();
};

const ENTITY_CONFIG = {
  projets: {
    table: "projets",
    public: true,
    defaultSort: "ordre",
    jsonFields: ["images_supplementaires", "images_labels"],
    booleanFields: ["visible", "mis_en_avant"],
    columns: [
      "id",
      "titre",
      "description",
      "categorie",
      "image_url",
      "image_label",
      "images_supplementaires",
      "images_labels",
      "client",
      "annee",
      "surface",
      "duree",
      "visible",
      "mis_en_avant",
      "ordre",
    ],
  },
  prestations: {
    table: "prestations",
    public: true,
    defaultSort: "ordre",
    jsonFields: [],
    booleanFields: ["visible"],
    columns: [
      "id",
      "titre",
      "description",
      "prix_indicatif",
      "duree_estimee",
      "visible",
      "ordre",
    ],
  },
  events: {
    table: "events",
    public: false,
    defaultSort: "start",
    jsonFields: [],
    booleanFields: [],
    columns: ["id", "title", "description", "start", "end", "color", "ordre"],
  },
  "liste-courses": {
    table: "liste_courses",
    public: false,
    defaultSort: "ordre",
    jsonFields: [],
    booleanFields: ["fait"],
    columns: ["id", "titre", "categorie", "urgence", "fait", "ordre"],
  },
  chantiers: {
    table: "chantiers",
    public: false,
    defaultSort: "date_debut",
    jsonFields: [],
    booleanFields: [],
    columns: ["id", "titre", "client", "statut", "date_debut", "date_fin", "budget_estime", "notes"],
  },
  taches: {
    table: "taches",
    public: false,
    defaultSort: "date_limite",
    jsonFields: [],
    booleanFields: [],
    columns: ["id", "titre", "priorite", "statut", "date_limite", "notes"],
  },
  "compta-urssaf": {
    table: "compta_urssaf",
    public: false,
    defaultSort: "periode",
    jsonFields: [],
    booleanFields: [],
    columns: ["id", "periode", "ca_encaisse", "charges", "date_declaration", "notes"],
  },
};

const sanitizePayload = (payload, config) => {
  const clean = {};
  for (const key of config.columns) {
    if (payload[key] !== undefined) {
      clean[key] = payload[key];
    }
  }
  return clean;
};

const normalizeValue = (value, config, key) => {
  if (config.booleanFields.includes(key)) {
    return value ? 1 : 0;
  }
  if (config.jsonFields.includes(key)) {
    return JSON.stringify(Array.isArray(value) ? value : value || []);
  }
  return value;
};

const parseRow = (row, config) => {
  const parsed = { ...row };
  config.booleanFields.forEach((key) => {
    if (parsed[key] !== undefined && parsed[key] !== null) {
      parsed[key] = Boolean(parsed[key]);
    }
  });
  config.jsonFields.forEach((key) => {
    if (parsed[key] === null || parsed[key] === undefined) {
      parsed[key] = [];
    } else if (typeof parsed[key] === "string") {
      try {
        parsed[key] = JSON.parse(parsed[key]);
      } catch {
        parsed[key] = [];
      }
    }
  });
  return parsed;
};

const buildFilters = (query, config, isAdmin) => {
  const filters = [];
  const values = [];

  config.columns.forEach((column) => {
    if (query[column] === undefined) return;
    let value = query[column];
    if (config.booleanFields.includes(column)) {
      value = value === "true" || value === "1" || value === true ? 1 : 0;
    }
    filters.push(`${column} = ?`);
    values.push(value);
  });

  if (config.public && !isAdmin && query.visible === undefined && config.columns.includes("visible")) {
    filters.push("visible = 1");
  }

  return { filters, values };
};

const ensureUploadsDir = async () => {
  const dir = path.join(process.cwd(), "public", "uploads");
  await fs.mkdir(dir, { recursive: true });
  return dir;
};

const storage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    try {
      const dir = await ensureUploadsDir();
      cb(null, dir);
    } catch (err) {
      cb(err, null);
    }
  },
  filename: (_req, file, cb) => {
    const safeName = (file.originalname || "file")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .slice(0, 120);
    const name = `${Date.now()}-${safeName}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: Number(process.env.UPLOAD_MAX_BYTES || 8 * 1024 * 1024) },
});

app.use("/uploads", express.static(path.join(process.cwd(), "public", "uploads")));

app.get("/api/db/health", async (_req, res) => {
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

app.post("/api/admin/login", (req, res) => {
  const { code, email, name } = req.body || {};
  if (!code || code.trim() !== ADMIN_CODE) {
    return res.status(401).json({ error: "invalid_code" });
  }
  const user = {
    email: (email || "admin@site.local").trim(),
    full_name: (name || "Administrateur").trim(),
    role: "admin",
  };
  const token = signToken(user);
  if (!token) {
    return res.status(500).json({ error: "token_error" });
  }
  res.json({ token, user });
});

app.get("/api/admin/me", requireAdmin, (req, res) => {
  res.json({ user: req.admin });
});

app.post("/api/upload", upload.single("file"), (req, res) => {
  if (String(process.env.UPLOAD_REQUIRE_AUTH || "false") === "true") {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!verifyToken(token)) {
      return res.status(401).json({ error: "unauthorized" });
    }
  }
  if (!req.file) {
    return res.status(400).json({ error: "file_missing" });
  }
  const baseUrl = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get("host")}`;
  const fileUrl = `${baseUrl}/uploads/${req.file.filename}`;
  res.json({ file_url: fileUrl });
});

const getMailer = () => {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || "false") === "true";
  if (!host || !user || !pass) {
    return null;
  }
  return nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
};

app.post("/api/email", async (req, res) => {
  const { to, subject, body, replyTo } = req.body || {};
  if (!subject || !body) {
    return res.status(400).json({ error: "missing_subject_or_body" });
  }
  const transporter = getMailer();
  if (!transporter) {
    return res.status(503).json({ error: "smtp_not_configured" });
  }
  const mailFrom = process.env.SMTP_FROM || process.env.SMTP_USER;
  const mailTo = process.env.MAIL_TO || to;
  if (!mailTo) {
    return res.status(400).json({ error: "missing_recipient" });
  }
  try {
    await transporter.sendMail({
      from: mailFrom,
      to: mailTo,
      subject,
      html: body,
      replyTo: replyTo || undefined,
    });
    res.json({ success: true });
  } catch (error) {
    console.error("SMTP error:", error);
    res.status(500).json({ error: "smtp_error" });
  }
});

app.post("/api/llm", async (req, res) => {
  const { prompt, response_json_schema } = req.body || {};
  if (!prompt) {
    return res.status(400).json({ error: "missing_prompt" });
  }
  try {
    const schemaHint = response_json_schema
      ? `Return a JSON object matching this schema: ${JSON.stringify(response_json_schema)}`
      : "Return a JSON object.";

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
          { role: "system", content: schemaHint },
          { role: "user", content: prompt },
        ],
        max_tokens: 800,
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Groq error:", err);
      return res.status(500).json({ error: "llm_error" });
    }

    const data = await response.json();
    const raw = data?.choices?.[0]?.message?.content || "";
    let parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          parsed = JSON.parse(match[0]);
        } catch {
          parsed = null;
        }
      }
    }
    res.json(parsed || { raw });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "llm_error" });
  }
});

app.get("/api/chat", (_req, res) => {
  const list = Array.from(historyStore.entries()).map(([id, record]) => ({
    id,
    conversationId: id,
    messages: record.messages || [],
    summary: record.summary || null,
    agent: record.agent || null,
    created_date: record.createdAt,
    updated_date: record.updatedAt,
  }));
  list.sort((a, b) => new Date(b.updated_date).getTime() - new Date(a.updated_date).getTime());
  res.json(list);
});

app.get("/api/chat/:conversationId", (req, res) => {
  const cid = req.params.conversationId;
  const record = historyStore.get(cid);
  if (!record) {
    return res.status(404).json({ error: "conversation_not_found" });
  }
  res.json({
    conversationId: cid,
    history: record.messages || [],
    summary: record.summary || null,
  });
});

app.post("/api/chat", async (req, res) => {
  const { message, conversationId, context = {}, systemPrompt } = req.body || {};

  if (!message || !message.trim()) {
    return res.status(400).json({ error: "missing_message" });
  }

  const cid = conversationId || crypto.randomUUID();
  const pastRecord = historyStore.get(cid) || { messages: [], summary: null, createdAt: new Date().toISOString() };
  const past = pastRecord.messages || [];
  const limitedPast = past.slice(-6);

  const agentName =
    typeof context === "string"
      ? context
      : context?.agent_name || context?.agent || context?.page || null;

  const basePrompt = `
You are an assistant that helps scope a renovation project.
Return ONLY valid JSON with keys:
{
  "message": "reply",
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
If unknown, keep empty strings or add to pointsOuverts.
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
      return res.status(500).json({ error: "groq_error" });
    }

    const data = await response.json();
    const raw = data?.choices?.[0]?.message?.content || "";

    const tryParse = (text) => {
      try {
        return JSON.parse(text);
      } catch {
        return null;
      }
    };

    let parsed = tryParse(raw);
    if (!parsed) {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = tryParse(match[0]);
      }
    }

    if (!parsed) {
      parsed = { message: raw || "Reply unavailable", summary: null };
    }

    const replyText = (parsed.message || raw || "").toString().trim();
    const updatedMessages = [...limitedPast, { role: "user", content: message }, { role: "assistant", content: replyText }];
    const updatedAt = new Date().toISOString();

    historyStore.set(cid, {
      messages: updatedMessages.slice(-6),
      summary: parsed.summary || pastRecord.summary || null,
      createdAt: pastRecord.createdAt || updatedAt,
      updatedAt,
      agent: agentName || pastRecord.agent || null,
    });

    res.json({
      reply: replyText || "Reply unavailable",
      raw,
      summary: parsed.summary || null,
      conversationId: cid,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "chat_error" });
  }
});

app.use(optionalAuth);

app.get("/api/:entity", async (req, res) => {
  const config = ENTITY_CONFIG[req.params.entity];
  if (!config) {
    return res.status(404).json({ error: "entity_not_found" });
  }

  const isAdmin = Boolean(req.admin);
  if (!config.public && !isAdmin) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const pool = getMySQLPool();
  if (!pool) {
    return res.status(503).json({ error: "db_not_configured" });
  }

  const { filters, values } = buildFilters(req.query, config, isAdmin);
  const sortKey = config.columns.includes(req.query.sort) ? req.query.sort : config.defaultSort;
  const limit = req.query.limit ? Math.min(Number(req.query.limit), 200) : null;

  let sql = `SELECT * FROM ${config.table}`;
  if (filters.length) {
    sql += ` WHERE ${filters.join(" AND ")}`;
  }
  if (sortKey) {
    sql += ` ORDER BY ${sortKey} ASC`;
  }
  if (limit) {
    sql += ` LIMIT ${limit}`;
  }

  try {
    const [rows] = await pool.query(sql, values);
    const data = rows.map((row) => parseRow(row, config));
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "db_error" });
  }
});

app.post("/api/:entity", requireAdmin, async (req, res) => {
  const config = ENTITY_CONFIG[req.params.entity];
  if (!config) {
    return res.status(404).json({ error: "entity_not_found" });
  }

  const pool = getMySQLPool();
  if (!pool) {
    return res.status(503).json({ error: "db_not_configured" });
  }

  const payload = sanitizePayload(req.body || {}, config);
  const id = payload.id || crypto.randomUUID();
  payload.id = id;

  const columns = Object.keys(payload);
  const values = columns.map((key) => normalizeValue(payload[key], config, key));
  const placeholders = columns.map(() => "?").join(",");

  try {
    await pool.query(`INSERT INTO ${config.table} (${columns.join(",")}) VALUES (${placeholders})`, values);
    const created = await pool.query(`SELECT * FROM ${config.table} WHERE id = ?`, [id]);
    const row = created[0][0];
    res.json(parseRow(row, config));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "db_error" });
  }
});

app.put("/api/:entity/:id", requireAdmin, async (req, res) => {
  const config = ENTITY_CONFIG[req.params.entity];
  if (!config) {
    return res.status(404).json({ error: "entity_not_found" });
  }

  const pool = getMySQLPool();
  if (!pool) {
    return res.status(503).json({ error: "db_not_configured" });
  }

  const payload = sanitizePayload(req.body || {}, config);
  const columns = Object.keys(payload);
  if (!columns.length) {
    return res.status(400).json({ error: "no_updates" });
  }

  const values = columns.map((key) => normalizeValue(payload[key], config, key));
  const sets = columns.map((key) => `${key} = ?`).join(", ");

  try {
    await pool.query(`UPDATE ${config.table} SET ${sets} WHERE id = ?`, [...values, req.params.id]);
    const updated = await pool.query(`SELECT * FROM ${config.table} WHERE id = ?`, [req.params.id]);
    const row = updated[0][0];
    res.json(parseRow(row, config));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "db_error" });
  }
});

app.delete("/api/:entity/:id", requireAdmin, async (req, res) => {
  const config = ENTITY_CONFIG[req.params.entity];
  if (!config) {
    return res.status(404).json({ error: "entity_not_found" });
  }

  const pool = getMySQLPool();
  if (!pool) {
    return res.status(503).json({ error: "db_not_configured" });
  }

  try {
    await pool.query(`DELETE FROM ${config.table} WHERE id = ?`, [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "db_error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  await initDb();
  console.log(`API server running on http://localhost:${PORT}`);
});
