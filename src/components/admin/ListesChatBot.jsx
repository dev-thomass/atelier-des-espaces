import React, { useState, useEffect, useRef } from "react";
import { api } from "@/api/apiClient";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, Send, Loader2, ShoppingCart, Mic, MicOff } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

const CATEGORIES = ["courses", "materiaux", "outils", "a_retenir", "autre"];

const normalizeText = (value) => (value || "").toString().trim().toLowerCase();

const normalizeCategory = (value) => {
  const raw = normalizeText(value);
  if (!raw) return "autre";
  if (raw.includes("course")) return "courses";
  if (raw.includes("mater")) return "materiaux";
  if (raw.includes("outil")) return "outils";
  if (raw.includes("retenir") || raw.includes("note")) return "a_retenir";
  if (CATEGORIES.includes(raw)) return raw;
  return "autre";
};

const normalizeUrgence = (value) => {
  const raw = normalizeText(value);
  if (raw.includes("urgent")) return "urgente";
  if (raw.includes("import")) return "importante";
  return "normale";
};

const normalizePriorite = (value) => {
  const raw = normalizeText(value);
  if (raw.includes("haute") || raw.includes("urgent")) return "haute";
  if (raw.includes("basse")) return "basse";
  return "normale";
};

const normalizeDate = (value) => {
  const raw = (value || "").toString().trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (match) {
    const [, dd, mm, yyyy] = match;
    return `${yyyy}-${mm}-${dd}`;
  }
  return null;
};

const findItemByTitle = (items, title) => {
  const needle = normalizeText(title);
  if (!needle) return null;
  const exact = items.find((item) => normalizeText(item.titre) === needle);
  if (exact) return exact;
  const included = items.find((item) => normalizeText(item.titre).includes(needle));
  if (included) return included;
  return items.find((item) => needle.includes(normalizeText(item.titre)));
};

export default function ListesChatBot({ onItemCreated, items = [] }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const endRef = useRef(null);
  const recognitionRef = useRef(null);
  const queryClient = useQueryClient();
  const headerGradient = "linear-gradient(135deg, var(--color-accent-warm-100), var(--color-accent-warm-300))";
  const actionGradient = "linear-gradient(135deg, var(--color-accent-warm-300), var(--color-accent-warm-500))";

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{
        role: 'assistant',
        text: `Je gere tes listes et tes taches.

Exemples :
- Ajoute lait et pain aux courses
- Ajoute ciment 20kg aux materiaux
- Coche le pain
- Supprime les items coches
- Cree une tache: rappeler le client Dupont demain

Que veux-tu faire ?`
      }]);
    }
  }, [isOpen]);

  // Initialiser la reconnaissance vocale
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'fr-FR';

      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInput(prev => prev + (prev ? ' ' : '') + transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = () => {
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const toggleVoiceInput = () => {
    if (!recognitionRef.current) {
      alert("La reconnaissance vocale n'est pas supportée par votre navigateur");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const getAiPlan = async (userMsg) => {
    const knownItems = items
      .slice(0, 40)
      .map((item) => `${item.titre} [${item.categorie || "autre"}] ${item.fait ? "(fait)" : ""}`)
      .join("\n");

    const prompt = `Tu es un assistant pour les listes et taches internes.
Tu dois proposer des actions a executer.

Regles:
- Reponds en JSON uniquement.
- Actions possibles: add_list_item, toggle_list_item, delete_list_item, clear_done, add_task.
- Pour add_list_item: item, categorie (courses|materiaux|outils|a_retenir|autre), urgence (normale|importante|urgente).
- Pour toggle_list_item/delete_list_item: item.
- Pour add_task: task { titre, priorite (basse|normale|haute), date_limite (YYYY-MM-DD ou dd/mm/yyyy), notes }.
- Si aucune action, retourne actions: [].

Liste actuelle:
${knownItems || "vide"}

Message utilisateur: "${userMsg}"`;

    const response = await api.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: "object",
        properties: {
          reply: { type: "string" },
          actions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                type: { type: "string" },
                item: { type: "string" },
                categorie: { type: "string" },
                urgence: { type: "string" },
                task: {
                  type: "object",
                  properties: {
                    titre: { type: "string" },
                    priorite: { type: "string" },
                    date_limite: { type: "string" },
                    notes: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    });

    return {
      reply: response?.reply || response?.raw || "Ok, je m'en occupe.",
      actions: Array.isArray(response?.actions) ? response.actions : [],
    };
  };

  const executeActions = async (actions) => {
    const results = [];
    let itemsCreated = 0;
    let tasksCreated = 0;
    let listTouched = false;

    for (const action of actions) {
      const type = normalizeText(action?.type || "");

      if (type === "add_list_item") {
        const itemTitle = (action?.item || "").toString().trim();
        if (!itemTitle) continue;
        const categorie = normalizeCategory(action?.categorie);
        const urgence = normalizeUrgence(action?.urgence);
        await api.entities.ListeCourse.create({
          titre: itemTitle,
          categorie,
          urgence,
          fait: false,
          ordre: items.length + itemsCreated,
        });
        itemsCreated += 1;
        listTouched = true;
        results.push(`Ajoute: ${itemTitle}`);
      }

      if (type === "toggle_list_item") {
        const target = findItemByTitle(items, action?.item);
        if (!target) continue;
        await api.entities.ListeCourse.update(target.id, { ...target, fait: !target.fait });
        listTouched = true;
        results.push(`Coche: ${target.titre}`);
      }

      if (type === "delete_list_item") {
        const target = findItemByTitle(items, action?.item);
        if (!target) continue;
        await api.entities.ListeCourse.delete(target.id);
        listTouched = true;
        results.push(`Supprime: ${target.titre}`);
      }

      if (type === "clear_done") {
        const doneItems = items.filter((item) => item.fait);
        for (const doneItem of doneItems) {
          await api.entities.ListeCourse.delete(doneItem.id);
        }
        if (doneItems.length) {
          listTouched = true;
          results.push(`Supprime ${doneItems.length} item(s) coches`);
        }
      }

      if (type === "add_task") {
        const taskTitle = action?.task?.titre || action?.item;
        if (!taskTitle) continue;
        const priorite = normalizePriorite(action?.task?.priorite);
        const dateLimite = normalizeDate(action?.task?.date_limite);
        await api.entities.Tache.create({
          titre: taskTitle,
          priorite,
          statut: "a_faire",
          date_limite: dateLimite,
          notes: action?.task?.notes || null,
        });
        tasksCreated += 1;
        results.push(`Tache: ${taskTitle}`);
      }
    }

    if (listTouched) {
      queryClient.invalidateQueries({ queryKey: ['liste-courses'] });
      if (onItemCreated) onItemCreated();
    }
    if (tasksCreated > 0) {
      queryClient.invalidateQueries({ queryKey: ['taches'] });
    }

    return results;
  };

  const send = async () => {
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput("");
    setMessages(m => [...m, { role: 'user', text: userMsg }]);
    setLoading(true);

    try {
      const aiPlan = await getAiPlan(userMsg);
      const actionSummary = await executeActions(aiPlan.actions);
      const replyLines = [aiPlan.reply];
      if (actionSummary.length) {
        replyLines.push("", "Actions:", ...actionSummary.map((line) => `- ${line}`));
      }
      setMessages(m => [...m, { role: 'assistant', text: replyLines.join("\n") }]);
    } catch (err) {
      console.error('Erreur:', err);
      setMessages(m => [...m, {
        role: 'assistant',
        text: `Erreur: ${err?.message || "Action impossible"}`
      }]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all hover:scale-110"
        style={{ background: actionGradient }}
      >
        <ShoppingCart className="w-6 h-6" style={{ color: "var(--color-warning-text)" }} />
      </button>
    );
  }

  return (
    <Card
      className="fixed bottom-6 right-6 z-50 w-96 shadow-2xl border-2 border-yellow-300"
      style={isDark ? { borderColor: "var(--color-border-medium)" } : undefined}
    >
      <CardHeader className="p-4 border-b" style={{ background: headerGradient }}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2" style={{ color: "var(--color-warning-text)" }}>
            <ShoppingCart className="w-5 h-5" />
            Listes IA
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        <div
          className="h-96 overflow-y-auto p-4 bg-yellow-50/30"
          style={isDark ? { backgroundColor: "var(--color-bg-surface-hover)" } : undefined}
        >
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-2 mb-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] rounded-xl px-3 py-2 ${
                  msg.role === 'user' 
                    ? 'bg-amber-600 text-white' 
                    : 'bg-white border-2 border-yellow-200'
                }`}
                style={msg.role === "user" || !isDark ? undefined : {
                  backgroundColor: "var(--color-bg-surface)",
                  borderColor: "var(--color-border-medium)",
                  color: "var(--color-text-primary)",
                }}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-2 mb-3">
              <div
                className="bg-white border-2 border-yellow-200 rounded-xl px-3 py-2"
                style={!isDark ? undefined : {
                  backgroundColor: "var(--color-bg-surface)",
                  borderColor: "var(--color-border-medium)",
                  color: "var(--color-text-primary)",
                }}
              >
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-amber-600 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-amber-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  <div className="w-2 h-2 bg-amber-600 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                </div>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div
          className="p-3 border-t-2 border-yellow-200 bg-white"
          style={isDark ? { backgroundColor: "var(--color-bg-surface)", borderColor: "var(--color-border-medium)" } : undefined}
        >
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
              placeholder="Ton message... 🎤"
              rows={2}
              disabled={loading}
              className="text-sm"
            />
            <div className="flex flex-col gap-2">
              <Button
                onClick={toggleVoiceInput}
                disabled={loading}
                className={`${
                  isListening 
                    ? 'bg-red-600 hover:bg-red-700 animate-pulse' 
                    : 'bg-amber-500 hover:bg-amber-600'
                }`}
                title={isListening ? "Arrêter" : "Parler"}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </Button>
              <Button
                onClick={send}
                disabled={!input.trim() || loading}
                style={{ background: actionGradient }}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
