
import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Zap,
  Send,
  Terminal,
  BookOpen,
  MessageSquare,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Play,
  Code,
  Copy,
  Trash2,
  Activity,
  TrendingUp,
  Database,
  ArrowLeftRight,
  Download,
  Upload,
  Bot
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";

const N8N_WEBHOOK_URL = "https://atelierdesespaces.app.n8n.cloud/webhook/741d7444-695c-46a3-92c1-ad6375fd7025";

// Workflows disponibles
const workflows = [
  {
    id: "chatbot",
    name: "Assistant Chatbot",
    description: "Posez vos questions à l'assistant IA",
    icon: MessageSquare,
    color: "purple",
    type: "chat",
    endpoint: N8N_WEBHOOK_URL,
    examplePrompt: "Crée un chantier pour la rénovation Dupont le 15 novembre"
  },
  {
    id: "chantier_create",
    name: "Créer un chantier",
    description: "Créer automatiquement un nouveau chantier",
    icon: Play,
    color: "blue",
    type: "webhook",
    endpoint: N8N_WEBHOOK_URL,
    examplePayload: {
      event: "chantier_created",
      payload: {
        titre: "Rénovation Dupont",
        client: "M. Dupont",
        statut: "devis"
      }
    }
  },
  {
    id: "tache_create",
    name: "Créer une tâche",
    description: "Ajouter une tâche urgente",
    icon: CheckCircle2,
    color: "green",
    type: "webhook",
    endpoint: N8N_WEBHOOK_URL,
    examplePayload: {
      event: "tache_created",
      payload: {
        titre: "Vérifier pompe urgente",
        priorite: "haute",
        statut: "a_faire"
      }
    }
  }
];

// Composant Message Bubble
function MessageBubble({ message, isUser }) {
  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'} mb-4 animate-in fade-in`}>
      {!isUser && (
        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-purple-600 to-purple-800 flex items-center justify-center flex-shrink-0 shadow-lg">
          <Zap className="w-5 h-5 text-white" />
        </div>
      )}
      <div className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-md ${
        isUser 
          ? 'bg-gradient-to-br from-amber-700 to-amber-800 text-white' 
          : 'bg-white border-2 border-stone-200 text-stone-800'
      }`}>
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{message}</p>
      </div>
    </div>
  );
}

// Composant pour afficher une réponse structurée de n8n
function N8nResponseDisplay({ response }) {
  const [showRaw, setShowRaw] = useState(false);
  
  // Détecter si la réponse contient des entités à créer
  const hasEntities = response?.entities || response?.data?.entities;
  const entities = hasEntities ? (response.entities || response.data.entities) : null;
  
  // Message de retour
  const message = response?.message || response?.output || response?.data?.message;
  
  // Données structurées
  const structuredData = response?.data || response;

  return (
    <div className="space-y-3">
      {/* Message principal */}
      {message && (
        <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-green-900 font-medium mb-1">Réponse de n8n</p>
              <p className="text-sm text-green-800 whitespace-pre-wrap">{message}</p>
            </div>
          </div>
        </div>
      )}

      {/* Entités créées/à créer */}
      {entities && Array.isArray(entities) && entities.length > 0 && (
        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Database className="w-5 h-5 text-blue-600" />
            <h4 className="font-semibold text-blue-900">Entités détectées ({entities.length})</h4>
          </div>
          <div className="space-y-2">
            {entities.map((entity, idx) => (
              <div key={idx} className="bg-white rounded-lg p-3 border border-blue-200">
                <div className="flex items-center justify-between mb-2">
                  <Badge className="bg-blue-600 text-white">{entity.type || 'Unknown'}</Badge>
                  {entity.created && (
                    <Badge className="bg-green-600 text-white">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Créé
                    </Badge>
                  )}
                </div>
                <pre className="text-xs text-stone-700 overflow-auto bg-stone-50 p-2 rounded">
                  {JSON.stringify(entity.data, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Données structurées */}
      {structuredData && Object.keys(structuredData).length > 0 && (
        <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Code className="w-5 h-5 text-purple-600" />
              <h4 className="font-semibold text-purple-900">Données structurées</h4>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowRaw(!showRaw)}
              className="text-xs"
            >
              {showRaw ? "Masquer JSON" : "Voir JSON"}
            </Button>
          </div>
          
          {showRaw ? (
            <pre className="text-xs text-purple-900 overflow-auto bg-white p-3 rounded border border-purple-200 max-h-64">
              {JSON.stringify(structuredData, null, 2)}
            </pre>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(structuredData).map(([key, value]) => {
                if (key === 'entities' || key === 'message') return null;
                return (
                  <div key={key} className="bg-white rounded p-2 border border-purple-200">
                    <div className="text-xs text-purple-600 font-medium mb-1">{key}</div>
                    <div className="text-xs text-stone-700 truncate">
                      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Bouton de copie */}
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          navigator.clipboard.writeText(JSON.stringify(response, null, 2));
          toast.success("Réponse copiée !");
        }}
        className="w-full"
      >
        <Copy className="w-4 h-4 mr-2" />
        Copier la réponse complète
      </Button>
    </div>
  );
}

export default function N8nHub() {
  const [activeWorkflow, setActiveWorkflow] = useState(null);
  const [chatInput, setChatInput] = useState("");
  const [jsonInput, setJsonInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState({ total: 0, success: 0, errors: 0 });
  const [lastResponse, setLastResponse] = useState(null);
  const [autoCreateEntities, setAutoCreateEntities] = useState(true);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fonction pour créer automatiquement les entités depuis la réponse n8n
  const createEntitiesFromResponse = async (responseData) => {
    if (!autoCreateEntities) return { created: [], errors: [] };
    
    const entities = responseData?.entities || responseData?.data?.entities;
    if (!entities || !Array.isArray(entities) || entities.length === 0) {
      return { created: [], errors: [] };
    }

    const created = [];
    const errors = [];

    for (const entity of entities) {
      try {
        const entityType = entity.type;
        const entityData = entity.data;

        if (!entityType || !entityData) {
          errors.push({ entity, error: "Type ou données manquants" });
          continue;
        }

        // Créer l'entité dans Base44
        let result;
        switch (entityType) {
          case 'Chantier':
            result = await base44.entities.Chantier.create(entityData);
            break;
          case 'Tache':
            result = await base44.entities.Tache.create(entityData);
            break;
          case 'Event':
            result = await base44.entities.Event.create(entityData);
            break;
          case 'ListeCourse':
            result = await base44.entities.ListeCourse.create(entityData);
            break;
          case 'ComptaURSSAF':
            result = await base44.entities.ComptaURSSAF.create(entityData);
            break;
          default:
            errors.push({ entity, error: `Type d'entité non supporté: ${entityType}` });
            continue;
        }

        created.push({ ...entity, id: result.id, created: true });
        toast.success(`${entityType} créé avec succès !`);
      } catch (error) {
        console.error("Erreur création entité:", error);
        errors.push({ entity, error: error.message });
        toast.error(`Erreur: ${error.message}`);
      }
    }

    return { created, errors };
  };

  // Envoyer une requête à n8n
  const sendToN8n = async (data, type = "webhook") => {
    setIsLoading(true);
    setLastResponse(null);
    const startTime = Date.now();

    try {
      const payload = type === "chat" 
        ? { chatInput: data }
        : {
            timestamp: new Date().toISOString(),
            source: 'base44_hub',
            ...data
          };

      const response = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`n8n error: ${response.status}`);
      }

      const result = await response.json();
      const duration = Date.now() - startTime;

      // Stocker la dernière réponse
      setLastResponse(result);

      // Créer automatiquement les entités si activé
      const { created, errors } = await createEntitiesFromResponse(result);
      
      // Enrichir la réponse avec les infos de création
      const enrichedResult = {
        ...result,
        entities: created.length > 0 ? created : (result.entities || []),
        creation_errors: errors
      };

      // Historique
      const historyItem = {
        workflow: activeWorkflow?.name || "Direct",
        success: true,
        timestamp: new Date().toISOString(),
        duration: `${duration}ms`,
        request: payload,
        response: enrichedResult,
        entitiesCreated: created.length
      };

      setHistory(prev => [historyItem, ...prev.slice(0, 19)]);
      setStats(prev => ({
        total: prev.total + 1,
        success: prev.success + 1,
        errors: prev.errors
      }));

      return enrichedResult;
    } catch (error) {
      console.error('Error:', error);
      
      const historyItem = {
        workflow: activeWorkflow?.name || "Direct",
        success: false,
        timestamp: new Date().toISOString(),
        error: error.message
      };

      setHistory(prev => [historyItem, ...prev.slice(0, 19)]);
      setStats(prev => ({
        total: prev.total + 1,
        success: prev.success,
        errors: prev.errors + 1
      }));

      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Envoyer un message chat
  const handleSendChat = async () => {
    if (!chatInput.trim() || isLoading) return;

    const userMessage = chatInput.trim();
    setMessages(prev => [...prev, { text: userMessage, isUser: true }]);
    setChatInput("");

    try {
      const response = await sendToN8n(userMessage, "chat");
      
      let botResponse = "Réponse reçue";
      if (response.output) {
        botResponse = response.output;
      } else if (response.message) {
        botResponse = response.message;
      } else if (typeof response === 'string') {
        botResponse = response;
      } else {
        botResponse = JSON.stringify(response, null, 2);
      }

      setMessages(prev => [...prev, { text: botResponse, isUser: false }]);
      toast.success("Message envoyé !");
    } catch (error) {
      setMessages(prev => [...prev, { 
        text: `Erreur : ${error.message}`, 
        isUser: false 
      }]);
      toast.error("Erreur lors de l'envoi");
    }
  };

  // Envoyer un JSON
  const handleSendJson = async () => {
    if (!jsonInput.trim() || isLoading) return;

    try {
      const data = JSON.parse(jsonInput);
      const response = await sendToN8n(data, "webhook");
      toast.success("Requête envoyée avec succès !");
      setJsonInput("");
    } catch (error) {
      if (error instanceof SyntaxError) {
        toast.error("JSON invalide");
      } else {
        toast.error(`Erreur : ${error.message}`);
      }
    }
  };

  // Sélectionner un workflow
  const handleSelectWorkflow = (workflow) => {
    setActiveWorkflow(workflow);
    setLastResponse(null);
    
    if (workflow.type === "chat" && workflow.examplePrompt) {
      setChatInput(workflow.examplePrompt);
    } else if (workflow.examplePayload) {
      setJsonInput(JSON.stringify(workflow.examplePayload, null, 2));
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <Card className="border-2 border-purple-600 shadow-2xl">
          <CardHeader className="bg-gradient-to-r from-purple-600 via-purple-700 to-indigo-700 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                  <Zap className="w-7 h-7" />
                </div>
                <div>
                  <CardTitle className="text-2xl">Centre de Contrôle n8n</CardTitle>
                  <p className="text-purple-100 text-sm flex items-center gap-2">
                    <ArrowLeftRight className="w-4 h-4" />
                    Test et monitoring de vos workflows
                  </p>
                </div>
              </div>
              
              {/* Navigation rapide */}
              <div className="hidden md:flex items-center gap-2">
                <Link to={createPageUrl("N8nAgent")}>
                  <Button variant="ghost" size="sm" className="text-white hover:bg-white/20">
                    <Bot className="w-4 h-4 mr-2" />
                    Doc Agent
                  </Button>
                </Link>
                <Link to={createPageUrl("N8nTest")}>
                  <Button variant="ghost" size="sm" className="text-white hover:bg-white/20">
                    <BookOpen className="w-4 h-4 mr-2" />
                    API Base44
                  </Button>
                </Link>
                <Link to={createPageUrl("N8nInterface")}>
                  <Button variant="ghost" size="sm" className="text-white hover:bg-white/20">
                    <Terminal className="w-4 h-4 mr-2" />
                    Actions Rapides
                  </Button>
                </Link>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Alert Info */}
        <Alert className="bg-blue-50 border-2 border-blue-300">
          <MessageSquare className="w-5 h-5 text-blue-600" />
          <AlertDescription>
            <strong>💡 Nouveau !</strong> Utilisez maintenant l'<strong>Agent Base44</strong> pour des interactions en langage naturel. 
            <Link to={createPageUrl("N8nAgent")} className="text-blue-700 underline ml-2">
              Voir la documentation →
            </Link>
          </AlertDescription>
        </Alert>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-stone-500 mb-1">Requêtes Totales</p>
                  <p className="text-2xl font-bold text-stone-800">{stats.total}</p>
                </div>
                <Activity className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-stone-500 mb-1">Succès</p>
                  <p className="text-2xl font-bold text-green-600">{stats.success}</p>
                </div>
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-stone-500 mb-1">Erreurs</p>
                  <p className="text-2xl font-bold text-red-600">{stats.errors}</p>
                </div>
                <XCircle className="w-8 h-8 text-red-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-stone-500 mb-1">Taux Réussite</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {stats.total > 0 ? Math.round((stats.success / stats.total) * 100) : 0}%
                  </p>
                </div>
                <TrendingUp className="w-8 h-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-4 gap-6">
          {/* Sidebar - Workflows disponibles */}
          <div className="lg:col-span-1">
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle className="text-lg">Workflows</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {workflows.map((workflow) => {
                  const Icon = workflow.icon;
                  const isActive = activeWorkflow?.id === workflow.id;
                  
                  return (
                    <button
                      key={workflow.id}
                      onClick={() => handleSelectWorkflow(workflow)}
                      className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
                        isActive
                          ? 'border-purple-600 bg-purple-50'
                          : 'border-stone-200 hover:border-purple-300 hover:bg-purple-50/50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          isActive ? 'bg-purple-600' : 'bg-stone-100'
                        }`}>
                          <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-stone-600'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-sm text-stone-800 mb-1">{workflow.name}</h4>
                          <p className="text-xs text-stone-600 line-clamp-2">{workflow.description}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}

                <div className="pt-4 mt-4 border-t border-stone-200">
                  {/* Toggle auto-création */}
                  <div className="mb-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-medium text-blue-900 flex items-center gap-1">
                        <Database className="w-3 h-3" />
                        Auto-création
                      </label>
                      <input
                        type="checkbox"
                        checked={autoCreateEntities}
                        onChange={(e) => setAutoCreateEntities(e.target.checked)}
                        className="w-4 h-4 rounded"
                      />
                    </div>
                    <p className="text-xs text-blue-700">
                      Créer automatiquement les entités retournées par n8n
                    </p>
                  </div>

                  <Link to={createPageUrl("N8nTest")}>
                    <Button variant="outline" className="w-full mb-2" size="sm">
                      <BookOpen className="w-4 h-4 mr-2" />
                      Documentation API
                    </Button>
                  </Link>
                  <Link to={createPageUrl("N8nInterface")}>
                    <Button variant="outline" className="w-full" size="sm">
                      <Terminal className="w-4 h-4 mr-2" />
                      Actions Rapides
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            <Tabs defaultValue="execute" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="execute">Exécuter</TabsTrigger>
                <TabsTrigger value="history">Historique</TabsTrigger>
              </TabsList>

              {/* Tab Exécution */}
              <TabsContent value="execute" className="space-y-6">
                {!activeWorkflow ? (
                  <Alert>
                    <MessageSquare className="w-4 h-4" />
                    <AlertDescription>
                      👈 Sélectionnez un workflow dans la liste pour commencer
                    </AlertDescription>
                  </Alert>
                ) : (
                  <>
                    {/* Info workflow sélectionné */}
                    <Card className="border-2 border-purple-200 bg-purple-50">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <activeWorkflow.icon className="w-6 h-6 text-purple-600" />
                            <div>
                              <h3 className="font-bold text-purple-900">{activeWorkflow.name}</h3>
                              <p className="text-sm text-purple-700">{activeWorkflow.description}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Upload className="w-4 h-4 text-purple-600" />
                            <ArrowLeftRight className="w-4 h-4 text-purple-600" />
                            <Download className="w-4 h-4 text-purple-600" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Interface Chat */}
                    {activeWorkflow.type === "chat" && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <MessageSquare className="w-5 h-5" />
                            Chat Interface
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          {/* Messages */}
                          <div className="h-[400px] overflow-y-auto p-4 bg-gradient-to-b from-stone-50 to-white rounded-lg border-2 border-stone-200 mb-4">
                            {messages.length === 0 && (
                              <div className="flex items-center justify-center h-full text-stone-400">
                                <div className="text-center">
                                  <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                  <p className="text-sm">Aucun message pour le moment</p>
                                </div>
                              </div>
                            )}
                            
                            {messages.map((message, index) => (
                              <MessageBubble key={index} message={message.text} isUser={message.isUser} />
                            ))}
                            
                            {isLoading && (
                              <div className="flex gap-3 justify-start mb-4">
                                <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-purple-600 to-purple-800 flex items-center justify-center flex-shrink-0 shadow-lg">
                                  <Zap className="w-5 h-5 text-white" />
                                </div>
                                <div className="bg-white border-2 border-stone-200 rounded-2xl px-4 py-3 shadow-md">
                                  <div className="flex gap-1">
                                    <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce"></div>
                                    <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                    <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                                  </div>
                                </div>
                              </div>
                            )}
                            
                            <div ref={messagesEndRef} />
                          </div>

                          {/* Input */}
                          <div className="flex gap-3">
                            <Textarea
                              value={chatInput}
                              onChange={(e) => setChatInput(e.target.value)}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault();
                                  handleSendChat();
                                }
                              }}
                              placeholder="Tapez votre message..."
                              className="resize-none border-2 border-stone-300 focus:border-purple-600"
                              rows={2}
                              disabled={isLoading}
                            />
                            <Button
                              onClick={handleSendChat}
                              disabled={!chatInput.trim() || isLoading}
                              className="bg-gradient-to-br from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900 px-6 shadow-lg"
                            >
                              {isLoading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                              ) : (
                                <Send className="w-5 h-5" />
                              )}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Interface JSON/Webhook */}
                    {activeWorkflow.type === "webhook" && (
                      <div className="space-y-6">
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <Code className="w-5 h-5" />
                              JSON Payload
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div>
                              <label className="block text-sm font-semibold text-stone-700 mb-2">
                                Payload JSON
                              </label>
                              <Textarea
                                value={jsonInput}
                                onChange={(e) => setJsonInput(e.target.value)}
                                className="font-mono text-xs resize-none border-2 border-stone-300 focus:border-purple-600"
                                rows={12}
                                disabled={isLoading}
                              />
                            </div>

                            <div className="flex gap-3">
                              <Button
                                onClick={handleSendJson}
                                disabled={!jsonInput.trim() || isLoading}
                                className="flex-1 bg-gradient-to-br from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900 shadow-lg"
                              >
                                {isLoading ? (
                                  <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Envoi...
                                  </>
                                ) : (
                                  <>
                                    <Send className="w-4 h-4 mr-2" />
                                    Envoyer
                                  </>
                                )}
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => {
                                  navigator.clipboard.writeText(jsonInput);
                                  toast.success("Copié !");
                                }}
                              >
                                <Copy className="w-4 h-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Affichage de la dernière réponse */}
                        {lastResponse && (
                          <Card className="border-2 border-green-200">
                            <CardHeader className="bg-green-50 border-b border-green-200">
                              <CardTitle className="flex items-center gap-2 text-green-900">
                                <Download className="w-5 h-5" />
                                Réponse de n8n
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="p-6">
                              <N8nResponseDisplay response={lastResponse} />
                            </CardContent>
                          </Card>
                        )}
                      </div>
                    )}
                  </>
                )}
              </TabsContent>

              {/* Tab Historique */}
              <TabsContent value="history" className="space-y-4">
                {history.length === 0 ? (
                  <Alert>
                    <Clock className="w-4 h-4" />
                    <AlertDescription>
                      Aucune requête effectuée pour le moment. L'historique des 20 dernières requêtes s'affichera ici.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold text-stone-800">
                        Historique ({history.length})
                      </h3>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setHistory([]);
                          setStats({ total: 0, success: 0, errors: 0 });
                        }}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Effacer
                      </Button>
                    </div>

                    <div className="space-y-3">
                      {history.map((item, index) => (
                        <Card key={index} className={`border-2 ${
                          item.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                        }`}>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                {item.success ? (
                                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                                ) : (
                                  <XCircle className="w-5 h-5 text-red-600" />
                                )}
                                <span className="font-semibold text-sm">{item.workflow}</span>
                                {item.duration && (
                                  <Badge variant="outline" className="text-xs">
                                    {item.duration}
                                  </Badge>
                                )}
                                {item.entitiesCreated > 0 && (
                                  <Badge className="bg-blue-600 text-white text-xs">
                                    <Database className="w-3 h-3 mr-1" />
                                    {item.entitiesCreated} créées
                                  </Badge>
                                )}
                              </div>
                              <span className="text-xs text-stone-500">
                                {new Date(item.timestamp).toLocaleString('fr-FR', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit'
                                })}
                              </span>
                            </div>
                            
                            {item.error && (
                              <p className="text-xs text-red-700 mb-2">{item.error}</p>
                            )}
                            
                            {item.request && (
                              <details className="mt-2">
                                <summary className="text-xs text-stone-600 cursor-pointer hover:text-stone-800">
                                  Voir les détails
                                </summary>
                                <div className="mt-2 space-y-2">
                                  <div>
                                    <p className="text-xs font-semibold text-stone-700 mb-1">Requête :</p>
                                    <pre className="text-xs bg-white p-2 rounded overflow-auto max-h-32">
                                      {JSON.stringify(item.request, null, 2)}
                                    </pre>
                                  </div>
                                  {item.response && (
                                    <div>
                                      <p className="text-xs font-semibold text-stone-700 mb-1">Réponse :</p>
                                      <N8nResponseDisplay response={item.response} />
                                    </div>
                                  )}
                                </div>
                              </details>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}
