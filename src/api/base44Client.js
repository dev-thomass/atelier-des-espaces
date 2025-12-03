// Local mock of the former Base44 client to keep the UI working without external calls.
// Data is stored in-memory and refreshed on each reload.

const createEntityStore = (name, initialData = []) => {
  let data = [...initialData];

  const sortItems = (items, sortKey) => {
    if (!sortKey) return [...items];
    return [...items].sort((a, b) => {
      const av = a?.[sortKey];
      const bv = b?.[sortKey];
      if (av === undefined) return 1;
      if (bv === undefined) return -1;
      if (av === bv) return 0;
      return av > bv ? 1 : -1;
    });
  };

  return {
    list: async (sortKey) => sortItems(data, sortKey),
    filter: async (criteria = {}, sortKey, limit) => {
      const result = data.filter((item) =>
        Object.entries(criteria).every(([key, value]) => item[key] === value)
      );
      const sorted = sortItems(result, sortKey);
      return typeof limit === "number" ? sorted.slice(0, limit) : sorted;
    },
    create: async (payload) => {
      const item = {
        id: payload?.id || `${name}-${Date.now()}`,
        ...payload,
      };
      data.push(item);
      return item;
    },
    update: async (id, updates) => {
      const index = data.findIndex((item) => item.id === id);
      if (index === -1) {
        throw new Error(`${name}: item with id "${id}" not found`);
      }
      data[index] = { ...data[index], ...updates };
      return data[index];
    },
    delete: async (id) => {
      data = data.filter((item) => item.id !== id);
      return { success: true };
    },
    _debugData: () => data,
  };
};

const samplePrestations = [
  {
    id: "prestation-1",
    titre: "Renovation cuisine sur-mesure",
    description:
      "Conception et realisation complete avec choix des materiaux, eclairage et finitions haut de gamme.",
    duree_estimee: "1 a 2 semaines",
    visible: true,
    ordre: 1,
  },
  {
    id: "prestation-2",
    titre: "Salle de bain cle en main",
    description:
      "Demolition, plomberie, carrelage, mobilier et etancheite pour une piece durable et elegante.",
    duree_estimee: "2 a 3 semaines",
    visible: true,
    ordre: 2,
  },
  {
    id: "prestation-3",
    titre: "Conception 3D & decoration",
    description:
      "Visualisations realistes, selection de teintes, matieres et luminaires pour guider vos choix.",
    duree_estimee: "Quelques jours",
    visible: true,
    ordre: 3,
  },
];

const sampleProjets = [
  {
    id: "projet-1",
    titre: "Cuisine contemporaine",
    categorie: "Cuisine",
    annee: "2024",
    visible: true,
    ordre: 1,
    image_url: "https://placehold.co/800x600?text=Cuisine",
    images_supplementaires: [
      "https://placehold.co/800x600?text=Cuisine+Avant",
      "https://placehold.co/800x600?text=Cuisine+Apres",
    ],
    images_labels: ["avant", "apres"],
    image_label: "apres",
  },
  {
    id: "projet-2",
    titre: "Salle de bain naturelle",
    categorie: "Salle de bain",
    annee: "2023",
    visible: true,
    ordre: 2,
    image_url: "https://placehold.co/800x600?text=Salle+de+bain",
    images_supplementaires: [
      "https://placehold.co/800x600?text=Avant",
      "https://placehold.co/800x600?text=Apres",
    ],
    images_labels: ["avant", "apres"],
    image_label: "apres",
  },
];

const sampleEvents = [
  {
    id: "event-1",
    titre: "Chantier renovation",
    start: new Date().toISOString(),
    end: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    ordre: 1,
  },
];

const entities = {
  Prestation: createEntityStore("prestation", samplePrestations),
  Projet: createEntityStore("projet", sampleProjets),
  Chantier: createEntityStore("chantier"),
  Tache: createEntityStore("tache"),
  ComptaURSSAF: createEntityStore("compta"),
  ListeCourse: createEntityStore("liste-course"),
  Event: createEntityStore("event", sampleEvents),
};

const integrations = {
  Core: {
    UploadFile: async ({ file }) => ({
      file_url: `/uploads/${Date.now()}-${file?.name || "file"}`,
    }),
    UploadPrivateFile: async ({ file }) => ({
      file_url: `/private/${Date.now()}-${file?.name || "file"}`,
    }),
    CreateFileSignedUrl: async ({ path }) => ({
      url: `/signed/${path || "file"}`,
    }),
    SendEmail: async (payload) => ({
      success: true,
      message: "Email simule en local",
      payload,
    }),
    GenerateImage: async ({ prompt }) => ({
      url: `https://placehold.co/800x600?text=${encodeURIComponent(prompt || "Image")}`,
    }),
    ExtractDataFromUploadedFile: async () => ({
      data: {},
    }),
    InvokeLLM: async ({ prompt }) => ({
      data: `Reponse locale a la requete: ${prompt || "..."}`,
    }),
  },
};

const functions = {
  invoke: async (name, payload) => {
    if (name === "invokeAgent") {
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: payload?.userMessage || payload?.message,
            conversationId: payload?.conversationId,
            context: payload?.context || {},
          }),
        });
        if (!res.ok) throw new Error(`invokeAgent error ${res.status}`);
        const data = await res.json();
        return { data };
      } catch (err) {
        console.error("invokeAgent local error", err);
        return {
          data: {
            message: "Assistant indisponible pour le moment.",
            echo: payload,
            conversationId: payload?.conversationId || `conv-${Date.now()}`,
          },
        };
      }
    }

    return {
      data: {
        message: `Reponse locale (${name})`,
        echo: payload,
        conversationId: payload?.conversationId || `conv-${Date.now()}`,
      },
    };
  },
  invokeAgent: async (payload) => functions.invoke("invokeAgent", payload),
};

const agents = {
  listConversations: async () => [],
  subscribeToConversation: (id, callback) => {
    // Simple mock subscription: return an unsubscribe immediately
    return () => {
      if (typeof callback === "function") {
        callback({ conversationId: id, data: [] });
      }
    };
  },
  addMessage: async () => ({ success: true }),
};

const auth = {
  me: async () => ({
    id: "local-user",
    email: "demo@local.test",
    name: "Utilisateur local",
    role: "admin",
  }),
};

export const base44 = {
  entities,
  integrations,
  functions,
  agents,
  auth,
};
