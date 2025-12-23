
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Bot,
  Code,
  Copy,
  CheckCircle2,
  ArrowRight,
  Zap,
  Terminal,
  BookOpen,
  MessageSquare,
  Database,
  Send,
  Sparkles, // Added Sparkles import
  X // Added X import
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

const INVOKE_AGENT_URL = "https://votre-app.api.com/api/functions/invokeAgent";

export default function N8nAgent() {
  const [activeExample, setActiveExample] = useState(null);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success("Copié dans le presse-papier !");
  };

  const examples = {
    simple: {
      titre: "Exemple Simple - Ajouter à une liste",
      description: "L'agent comprend et crée automatiquement les items",
      request: {
        userMessage: "Ajoute lait, pain et huile moteur",
        context: "listes",
        conversationId: null
      },
      response: {
        success: true,
        conversationId: "conv_abc123",
        message: "✅ Ajouté :\n• Lait (courses)\n• Pain (courses)\n• Huile moteur (outils)",
        actions: [
          {
            type: "create",
            entity: "ListeCourse",
            data: { titre: "Lait", categorie: "courses" },
            status: "success"
          },
          {
            type: "create",
            entity: "ListeCourse",
            data: { titre: "Pain", categorie: "courses" },
            status: "success"
          },
          {
            type: "create",
            entity: "ListeCourse",
            data: { titre: "Huile moteur", categorie: "outils" },
            status: "success"
          }
        ]
      }
    },
    planning: {
      titre: "Planning - L'agent gère directement",
      description: "L'agent crée l'événement dans le planning",
      request: {
        userMessage: "Crée un RDV avec Martin demain à 14h pour 2 heures",
        context: "planning",
        conversationId: null
      },
      response: {
        success: true,
        conversationId: "conv_def456",
        message: "✅ RDV créé : Martin demain 14h-16h",
        actions: [
          {
            type: "create",
            entity: "Event",
            data: {
              title: "RDV Martin",
              start: "2025-11-08T14:00:00",
              end: "2025-11-08T16:00:00"
            },
            status: "success"
          }
        ]
      }
    },
    chantier: {
      titre: "Créer un Chantier",
      description: "L'agent crée automatiquement le chantier",
      request: {
        userMessage: "Crée un chantier chez Dupont, rénovation cuisine, budget 15000€",
        context: "chantiers",
        conversationId: null
      },
      response: {
        success: true,
        conversationId: "conv_xyz789",
        message: "✅ Chantier créé : Rénovation cuisine Dupont (15000€)",
        actions: [
          {
            type: "create",
            entity: "Chantier",
            data: {
              titre: "Rénovation cuisine Dupont",
              client: "Dupont",
              budget_estime: "15000€",
              statut: "devis"
            },
            status: "success"
          }
        ]
      }
    },
    conversation: {
      titre: "Continuer une Conversation",
      description: "L'agent se souvient du contexte précédent",
      request: {
        userMessage: "Et ajoute aussi des œufs",
        context: "listes",
        conversationId: "conv_abc123"
      },
      response: {
        success: true,
        conversationId: "conv_abc123",
        message: "✅ Ajouté : Œufs (courses)",
        actions: [
          {
            type: "create",
            entity: "ListeCourse",
            data: { titre: "Œufs", categorie: "courses" },
            status: "success"
          }
        ]
      }
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
                  <Bot className="w-7 h-7" />
                </div>
                <div>
                  <CardTitle className="text-2xl">Architecture Agent Maître</CardTitle>
                  <p className="text-purple-100 text-sm">Le frontend appelle directement l'agent</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Link to={createPageUrl("N8nTest")}>
                  <Button variant="ghost" size="sm" className="text-white hover:bg-white/20">
                    <BookOpen className="w-4 h-4 mr-2" />
                    API Base44
                  </Button>
                </Link>
                <Link to={createPageUrl("N8nHub")}>
                  <Button variant="ghost" size="sm" className="text-white hover:bg-white/20">
                    <Zap className="w-4 h-4 mr-2" />
                    Centre n8n
                  </Button>
                </Link>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Alert Important */}
        <Alert className="bg-blue-50 border-2 border-blue-300">
          <MessageSquare className="w-5 h-5 text-blue-600" />
          <AlertDescription>
            <strong>🚀 Architecture simplifiée :</strong> Le frontend appelle <strong>directement</strong> l'agent maître.
            L'agent décide lui-même s'il a besoin d'appeler n8n pour des intégrations externes.
          </AlertDescription>
        </Alert>

        <Tabs defaultValue="guide" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="guide">Architecture</TabsTrigger>
            <TabsTrigger value="exemples">Exemples</TabsTrigger>
            <TabsTrigger value="workflow">Intégration n8n</TabsTrigger>
          </TabsList>

          {/* TAB 1: GUIDE */}
          <TabsContent value="guide" className="space-y-6">
            {/* Vue d'ensemble */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="w-5 h-5 text-purple-600" />
                  Architecture Simplifiée - Frontend → Agent
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-stone-700">
                  Le frontend appelle <strong>directement</strong> l'agent maître qui gère toutes les entités.
                  L'agent appelle n8n <strong>uniquement si nécessaire</strong> pour des intégrations spécifiques.
                </p>

                <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-4">
                  <h4 className="font-bold text-purple-900 mb-2">✨ L'agent gère TOUT :</h4>
                  <ul className="space-y-1 text-sm text-purple-800">
                    <li>• <strong>Listes</strong> : Créer, modifier, supprimer items</li>
                    <li>• <strong>Planning</strong> : Gérer événements et RDV</li>
                    <li>• <strong>Chantiers</strong> : Créer et suivre chantiers</li>
                    <li>• <strong>Tâches</strong> : Gérer tâches prioritaires</li>
                    <li>• <strong>URSSAF</strong> : Calculer charges</li>
                    <li>• <strong>Conversations</strong> : Historique complet</li>
                    <li>• <strong>n8n</strong> : Appelle n8n si besoin (optionnel)</li>
                  </ul>
                </div>

                <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
                  <h4 className="font-bold text-green-900 mb-2">🎯 Flux ultra-simple :</h4>
                  <div className="flex items-center gap-3 text-sm flex-wrap">
                    <Badge className="bg-blue-600">1. Frontend</Badge>
                    <ArrowRight className="w-4 h-4 text-stone-400" />
                    <Badge className="bg-purple-600">2. Agent Maître</Badge>
                    <ArrowRight className="w-4 h-4 text-stone-400" />
                    <Badge className="bg-orange-600">3. Base44 Actions</Badge>
                  </div>
                  <div className="flex items-center gap-3 text-sm flex-wrap mt-3 opacity-60">
                    <Badge variant="outline">Si besoin</Badge>
                    <ArrowRight className="w-4 h-4 text-stone-400" />
                    <Badge className="bg-amber-600">Agent → n8n</Badge>
                    <ArrowRight className="w-4 h-4 text-stone-400" />
                    <Badge variant="outline">Intégrations externes</Badge>
                  </div>
                  <p className="text-xs text-green-700 mt-3">
                    ✅ Plus de webhook : le frontend communique directement avec l'agent via invokeAgent
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Appel depuis le Frontend */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Code className="w-5 h-5 text-blue-600" />
                  Appel depuis le Frontend
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <Alert className="bg-amber-50 border-amber-300">
                  <AlertDescription>
                    <strong>💡 Simple :</strong> Un seul appel à <code>api.functions.invoke('invokeAgent')</code>
                  </AlertDescription>
                </Alert>

                <div>
                  <h3 className="font-bold text-stone-800 mb-3">Code Frontend (React)</h3>
                  <div className="bg-stone-50 border border-stone-200 p-4 rounded-lg space-y-3">
                    <pre className="bg-stone-900 text-green-400 p-3 rounded text-xs overflow-auto">
{`import { api } from "@/api/apiClient";

const sendMessage = async (userMessage) => {
  try {
    const payload = {
      userMessage: userMessage,
      context: "listes", // ou "planning", "chantiers", etc.
      conversationId: conversationId // pour historique
    };

    // Appel DIRECT à l'agent maître
    const response = await api.functions.invoke('invokeAgent', payload);

    const result = response.data;

    // Sauvegarder conversationId pour la suite
    if (result.conversationId) {
      setConversationId(result.conversationId);
    }

    return result;
  } catch (error) {
    console.error('Erreur:', error);
    throw error;
  }
};`}
                    </pre>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2"
                      onClick={() => copyToClipboard(`import { api } from "@/api/apiClient";\n\nconst sendMessage = async (userMessage) => {\n  try {\n    const payload = {\n      userMessage: userMessage,\n      context: "listes",\n      conversationId: conversationId\n    };\n\n    const response = await api.functions.invoke('invokeAgent', payload);\n    const result = response.data;\n    \n    if (result.conversationId) {\n      setConversationId(result.conversationId);\n    }\n    \n    return result;\n  } catch (error) {\n    console.error('Erreur:', error);\n    throw error;\n  }\n};`)}
                    >
                      <Copy className="w-3 h-3 mr-2" />
                      Copier le code
                    </Button>
                  </div>
                </div>

                <div>
                  <h3 className="font-bold text-stone-800 mb-3">Paramètres</h3>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
                      <h4 className="font-bold text-blue-900 mb-1 text-sm">userMessage</h4>
                      <p className="text-xs text-blue-800">Message en langage naturel</p>
                      <code className="text-xs bg-white p-1 rounded block mt-1">
                        "Ajoute lait et pain"
                      </code>
                    </div>

                    <div className="bg-purple-50 border border-purple-200 p-3 rounded-lg">
                      <h4 className="font-bold text-purple-900 mb-1 text-sm">context</h4>
                      <p className="text-xs text-purple-800">Contexte d'utilisation</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        <Badge variant="outline" className="text-xs">listes</Badge>
                        <Badge variant="outline" className="text-xs">planning</Badge>
                        <Badge variant="outline" className="text-xs">chantiers</Badge>
                      </div>
                    </div>

                    <div className="bg-green-50 border border-green-200 p-3 rounded-lg">
                      <h4 className="font-bold text-green-900 mb-1 text-sm">conversationId</h4>
                      <p className="text-xs text-green-800">ID pour historique</p>
                      <code className="text-xs bg-white p-1 rounded block mt-1">
                        null ou "conv_abc"
                      </code>
                    </div>
                  </div>
                </div>

                <Alert className="bg-green-50 border-green-300">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <AlertDescription>
                    <strong>✨ L'agent décide :</strong> L'agent analyse le message et décide automatiquement
                    s'il peut gérer la demande directement ou s'il a besoin d'appeler n8n pour des intégrations externes.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            {/* Quand l'agent appelle n8n */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-600" />
                  Quand l'agent appelle n8n
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-stone-700">
                  L'agent maître appelle n8n <strong>uniquement</strong> s'il a besoin d'intégrations
                  externes non disponibles dans api.
                </p>

                <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg">
                  <h4 className="font-bold text-amber-900 mb-2">Exemples de cas où n8n est appelé :</h4>
                  <ul className="text-sm text-amber-800 space-y-1">
                    <li>• 🔗 Intégrations API tierces spécifiques</li>
                    <li>• 📧 Envoi d'emails personnalisés complexes</li>
                    <li>• 🤖 Automatisations multi-étapes</li>
                    <li>• 📊 Webhooks vers services externes</li>
                  </ul>
                </div>

                <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                  <h4 className="font-bold text-blue-900 mb-2">L'agent gère directement :</h4>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• ✅ Toutes les opérations sur les entités Base44</li>
                    <li>• 💬 Toutes les conversations et historiques</li>
                    <li>• 🧠 Compréhension du langage naturel</li>
                    <li>• 🎯 Décisions contextuelles</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 2: EXEMPLES */}
          <TabsContent value="exemples" className="space-y-6">
            <div className="grid gap-4">
              {Object.entries(examples).map(([key, example]) => (
                <Card key={key} className="border-2 hover:border-purple-300 transition-all">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">{example.titre}</CardTitle>
                        <p className="text-sm text-stone-600 mt-1">{example.description}</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setActiveExample(activeExample === key ? null : key)}
                      >
                        {activeExample === key ? "Masquer" : "Voir détails"}
                      </Button>
                    </div>
                  </CardHeader>

                  {activeExample === key && (
                    <CardContent className="space-y-4 border-t pt-4">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-bold text-blue-900 flex items-center gap-2">
                            <Send className="w-4 h-4" />
                            Appel Frontend
                          </h4>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(JSON.stringify(example.request, null, 2))}
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                        <pre className="bg-blue-50 border-2 border-blue-200 p-3 rounded text-xs overflow-auto">
                          {JSON.stringify(example.request, null, 2)}
                        </pre>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-bold text-green-900 flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4" />
                            Réponse Agent
                          </h4>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(JSON.stringify(example.response, null, 2))}
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                        <pre className="bg-green-50 border-2 border-green-200 p-3 rounded text-xs overflow-auto max-h-64">
                          {JSON.stringify(example.response, null, 2)}
                        </pre>
                      </div>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* TAB 3: INTÉGRATION N8N */}
          <TabsContent value="workflow" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Intégration n8n (Optionnelle)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert className="bg-purple-50 border-purple-300">
                  <AlertDescription>
                    <strong>📌 Important :</strong> n8n est appelé par l'agent <strong>uniquement si nécessaire</strong>.
                    Aucune configuration n8n n'est requise pour le fonctionnement de base.
                  </AlertDescription>
                </Alert>

                <div className="bg-amber-50 border-2 border-amber-200 rounded-lg p-4">
                  <h4 className="font-bold text-amber-900 mb-2">Quand configurer n8n ?</h4>
                  <p className="text-sm text-amber-800 mb-3">
                    Si vous avez besoin d'intégrations externes spécifiques que l'agent ne peut pas gérer directement.
                  </p>
                  <ul className="text-sm text-amber-800 space-y-1">
                    <li>• Connecter des APIs tierces</li>
                    <li>• Automatisations multi-services</li>
                    <li>• Webhooks entrants/sortants</li>
                  </ul>
                </div>

                <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                  <h4 className="font-bold text-blue-900 mb-3">Configuration n8n (si nécessaire)</h4>
                  <div className="space-y-3">
                    <div>
                      <div className="text-sm font-semibold text-blue-900 mb-1">1. Créer un webhook n8n</div>
                      <p className="text-xs text-blue-700">
                        Créez un workflow n8n qui commence par un webhook trigger
                      </p>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-blue-900 mb-1">2. Configurer l'agent</div>
                      <p className="text-xs text-blue-700">
                        L'agent peut être configuré pour appeler ce webhook quand nécessaire
                      </p>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-blue-900 mb-1">3. L'agent décide</div>
                      <p className="text-xs text-blue-700">
                        L'agent analyse la demande et appelle n8n uniquement si requis
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Comparaison */}
            <Card>
              <CardHeader>
                <CardTitle>Comparaison des architectures</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
                    <h4 className="font-bold text-red-900 mb-2 flex items-center gap-2">
                      <X className="w-4 h-4" />
                      Ancienne : Frontend → n8n → Agent
                    </h4>
                    <ul className="text-xs text-red-700 space-y-1">
                      <li>• n8n obligatoire</li>
                      <li>• Latence supplémentaire</li>
                      <li>• Configuration complexe</li>
                      <li>• Point de défaillance</li>
                    </ul>
                  </div>

                  <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                    <h4 className="font-bold text-green-900 mb-2 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      Nouvelle : Frontend → Agent (→ n8n si besoin)
                    </h4>
                    <ul className="text-xs text-green-700 space-y-1">
                      <li>• Communication directe</li>
                      <li>• Plus rapide</li>
                      <li>• Configuration simple</li>
                      <li>• n8n optionnel</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <Card className="border-2 border-purple-200 bg-purple-50">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-purple-900 mb-1">🎓 Ressources complémentaires</h3>
                <p className="text-sm text-purple-700">
                  Documentation API et outils de développement
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link to={createPageUrl("N8nTest")}>
                  <Button variant="outline" size="sm">
                    <Database className="w-4 h-4 mr-2" />
                    API Base44
                  </Button>
                </Link>
                <Link to={createPageUrl("N8nHub")}>
                  <Button variant="outline" size="sm">
                    <Zap className="w-4 h-4 mr-2" />
                    Centre n8n
                  </Button>
                </Link>
                <Link to={createPageUrl("N8nInterface")}>
                  <Button variant="outline" size="sm">
                    <Terminal className="w-4 h-4 mr-2" />
                    Actions Rapides
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

