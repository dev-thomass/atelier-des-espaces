const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const TOKEN_KEY = "admin_token";

const getToken = () => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
};

const setToken = (token) => {
  if (typeof window === "undefined") return;
  if (!token) {
    localStorage.removeItem(TOKEN_KEY);
  } else {
    localStorage.setItem(TOKEN_KEY, token);
  }
};

const buildQuery = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    query.set(key, String(value));
  });
  const qs = query.toString();
  return qs ? `?${qs}` : "";
};

const request = async (path, options = {}) => {
  const { method = "GET", body, params, auth = true, headers = {} } = options;
  const url = `${API_BASE}${path}${params ? buildQuery(params) : ""}`;

  const finalHeaders = { ...headers };
  let finalBody = body;

  if (auth) {
    const token = getToken();
    if (token) {
      finalHeaders.Authorization = `Bearer ${token}`;
    }
  }

  if (body && !(body instanceof FormData)) {
    finalHeaders["Content-Type"] = "application/json";
    finalBody = JSON.stringify(body);
  }

  const res = await fetch(url, { method, headers: finalHeaders, body: finalBody });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || `API error ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
};

const entityClient = (endpoint) => ({
  list: async (sortKey) => request(`/api/${endpoint}`, { params: { sort: sortKey } }),
  filter: async (criteria = {}, sortKey, limit) =>
    request(`/api/${endpoint}`, { params: { ...criteria, sort: sortKey, limit } }),
  create: async (payload) => request(`/api/${endpoint}`, { method: "POST", body: payload, auth: true }),
  update: async (id, updates) =>
    request(`/api/${endpoint}/${id}`, { method: "PUT", body: updates, auth: true }),
  delete: async (id) => request(`/api/${endpoint}/${id}`, { method: "DELETE", auth: true }),
});

const entities = {
  Prestation: entityClient("prestations"),
  Projet: entityClient("projets"),
  Chantier: entityClient("chantiers"),
  Tache: entityClient("taches"),
  ComptaURSSAF: entityClient("compta-urssaf"),
  ListeCourse: entityClient("liste-courses"),
  Event: entityClient("events"),
};

const integrations = {
  Core: {
    UploadFile: async ({ file }) => {
      const formData = new FormData();
      formData.append("file", file);
      return request("/api/upload", { method: "POST", body: formData, auth: true });
    },
    SendEmail: async ({ to, subject, body, replyTo }) =>
      request("/api/email", { method: "POST", body: { to, subject, body, replyTo }, auth: false }),
    InvokeLLM: async ({ prompt, response_json_schema }) =>
      request("/api/llm", { method: "POST", body: { prompt, response_json_schema }, auth: false }),
  },
};

const functions = {
  invoke: async (name, payload) => {
    if (name === "invokeAgent") {
      const data = await request("/api/chat", {
        method: "POST",
        body: {
          message: payload?.userMessage || payload?.message,
          conversationId: payload?.conversationId,
          context: payload?.context || {},
        },
        auth: false,
      });
      return { data };
    }

    const data = await request("/api/chat", {
      method: "POST",
      body: {
        message: payload?.userMessage || payload?.message || "",
        conversationId: payload?.conversationId,
        context: payload?.context || {},
      },
      auth: false,
    });
    return { data };
  },
  invokeAgent: async (payload) => functions.invoke("invokeAgent", payload),
};

const agents = {
  listConversations: async ({ agent_name } = {}) => {
    const list = await request("/api/chat", { auth: true });
    if (!agent_name) return list;
    return list.filter((conv) => conv.agent === agent_name);
  },
  subscribeToConversation: (id, callback) => {
    let active = true;
    const poll = async () => {
      if (!active) return;
      try {
        const data = await request(`/api/chat/${id}`, { auth: true });
        callback({ conversationId: id, messages: data.history || [] });
      } catch {
        // ignore polling errors
      }
      if (active) {
        setTimeout(poll, 2000);
      }
    };
    poll();
    return () => {
      active = false;
    };
  },
  addMessage: async (conversation, message) => {
    const data = await request("/api/chat", {
      method: "POST",
      body: {
        message: message?.content || "",
        conversationId: conversation?.id || conversation?.conversationId,
        context: conversation?.agent ? { agent: conversation.agent } : {},
      },
      auth: false,
    });
    return { success: true, data };
  },
};

const auth = {
  login: async ({ code, email, name }) => {
    const res = await request("/api/admin/login", {
      method: "POST",
      body: { code, email, name },
      auth: false,
    });
    setToken(res.token);
    return res.user;
  },
  me: async () => {
    const token = getToken();
    if (!token) {
      throw new Error("no_token");
    }
    const res = await request("/api/admin/me", { auth: true });
    return res.user;
  },
  logout: () => {
    setToken(null);
  },
  getToken,
};

const leads = {
  list: async (limit) => request("/api/leads", { params: limit ? { limit } : undefined, auth: true }),
  createPublic: async (payload) => request("/api/leads", { method: "POST", body: payload, auth: false }),
};

export const api = {
  entities,
  integrations,
  functions,
  agents,
  leads,
  auth,
};
