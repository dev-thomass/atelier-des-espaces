
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Zap,
  Send,
  CheckCircle2,
  XCircle,
  Loader2,
  Code,
  ArrowRight,
  ArrowLeft,
  Copy,
  Database,
  Key,
  Settings,
  FileJson,
  BookOpen,
  Bot // Added Bot icon
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom"; // Assuming react-router-dom for Link component

// URL du webhook n8n
const N8N_WEBHOOK_URL = "https://atelierdesespaces.app.n8n.cloud/webhook/741d7444-695c-46a3-92c1-ad6375fd7025";

// Informations API Base44
const APP_ID = "6901ebfc5e146f4dd7ae429a";
const API_BASE_URL = "https://api.base44.com/v1";

// Function to create page URLs (placeholder, adjust based on actual routing setup)
// This function needs to be adapted to your project's specific routing implementation.
const createPageUrl = (pageName) => {
  // Example: Convert "N8nAgent" to "/n8n-agent"
  // For `N8nTest`, it would be `/n8n-test` if used.
  return `/${pageName.toLowerCase().replace(/n8n/, 'n8n-')}`;
};

// Fonction d'envoi à n8n
async function sendToN8n(data) {
  try {
    const response = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        source: 'base44_app',
        ...data
      })
    });

    if (!response.ok) {
      throw new Error(`n8n webhook error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Erreur envoi n8n:', error);
    throw error;
  }
}

// Exemples de configuration n8n
const n8nExamples = {
  authentication: {
    titre: "🔐 Configuration Authentication dans n8n",
    steps: [
      "1. Dans n8n, ajoute un nœud 'HTTP Request'",
      "2. Dans 'Authentication', sélectionne 'Generic Credential Type'",
      "3. Choisis 'Header Auth'",
      "4. Clique sur 'Create New Credential'",
      "5. Configure :",
      "   - Name: Authorization",
      "   - Value: Bearer TON_API_TOKEN_BASE44"
    ]
  },

  lireChantiers: {
    titre: "📖 LIRE tous les chantiers",
    config: {
      method: "GET",
      url: `${API_BASE_URL}/apps/${APP_ID}/entities/Chantier`,
      authentication: "Header Auth",
      headers: {
        "Content-Type": "application/json"
      }
    }
  },

  creerChantier: {
    titre: "➕ CRÉER un nouveau chantier",
    config: {
      method: "POST",
      url: `${API_BASE_URL}/apps/${APP_ID}/entities/Chantier`,
      authentication: "Header Auth",
      headers: {
        "Content-Type": "application/json"
      },
      body: {
        titre: "Rénovation Dupont",
        client: "M. Dupont",
        statut: "devis",
        date_debut: "2025-02-15",
        budget_estime: "8000€",
        description: "Rénovation cuisine complète"
      }
    }
  },

  modifierChantier: {
    titre: "✏️ MODIFIER un chantier existant",
    config: {
      method: "PATCH",
      url: `${API_BASE_URL}/apps/${APP_ID}/entities/Chantier/CHANTIER_ID`,
      authentication: "Header Auth",
      headers: {
        "Content-Type": "application/json"
      },
      body: {
        statut: "en_cours",
        avancement: "Démolition terminée, plomberie en cours"
      }
    },
    note: "⚠️ Remplace CHANTIER_ID par l'ID réel du chantier"
  },

  supprimerChantier: {
    titre: "🗑️ SUPPRIMER un chantier",
    config: {
      method: "DELETE",
      url: `${API_BASE_URL}/apps/${APP_ID}/entities/Chantier/CHANTIER_ID`,
      authentication: "Header Auth"
    },
    note: "⚠️ Remplace CHANTIER_ID par l'ID réel du chantier"
  },

  creerTache: {
    titre: "✅ CRÉER une tâche",
    config: {
      method: "POST",
      url: `${API_BASE_URL}/apps/${APP_ID}/entities/Tache`,
      authentication: "Header Auth",
      headers: {
        "Content-Type": "application/json"
      },
      body: {
        titre: "Vérifier pompe urgente",
        description: "La pompe fait un bruit anormal",
        chantier_id: "chantier_123",
        priorite: "haute",
        statut: "a_faire",
        date_limite: "2025-02-01"
      }
    }
  },

  declarerURSSAF: {
    titre: "💰 CRÉER une déclaration URSSAF",
    config: {
      method: "POST",
      url: `${API_BASE_URL}/apps/${APP_ID}/entities/ComptaURSSAF`,
      authentication: "Header Auth",
      headers: {
        "Content-Type": "application/json"
      },
      body: {
        periode: "2025-01",
        ca_encaisse: 15000,
        taux_urssaf: 22,
        montant_urssaf: 3300,
        date_declaration: "2025-02-01",
        statut_paiement: "a_payer"
      }
    }
  },

  creerEvent: {
    titre: "📅 CRÉER un événement planning",
    config: {
      method: "POST",
      url: `${API_BASE_URL}/apps/${APP_ID}/entities/Event`,
      authentication: "Header Auth",
      headers: {
        "Content-Type": "application/json"
      },
      body: {
        title: "Rendez-vous client Dupont",
        start: "2025-02-01T14:00:00",
        end: "2025-02-01T15:00:00",
        description: "Visite chantier",
        color: "#007AFF"
      }
    }
  }
};

export default function N8nTest() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [customData, setCustomData] = useState(JSON.stringify({
    event: "test_event",
    payload: {
      message: "Hello n8n!",
      timestamp: new Date().toISOString()
    }
  }, null, 2));

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success("Copié dans le presse-papier !");
  };

  const handleTestWebhook = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = JSON.parse(customData);
      const response = await sendToN8n(data);
      setResult(response);
      toast.success("Webhook envoyé avec succès !");
    } catch (err) {
      setError(err.message);
      toast.error("Erreur lors de l'envoi");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <Card className="border-amber-700 border-2 shadow-xl">
          <CardHeader className="bg-gradient-to-r from-amber-700 to-amber-800 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Zap className="w-8 h-8" />
                <div>
                  <CardTitle className="text-2xl">Documentation API Base44</CardTitle>
                  <p className="text-amber-100 text-sm">Intégration directe avec l'API (sans agent)</p>
                </div>
              </div>

              {/* Navigation */}
              <div className="flex items-center gap-2">
                <Link to={createPageUrl("N8nAgent")}>
                  <Button variant="ghost" size="sm" className="text-white hover:bg-white/20">
                    <Bot className="w-4 h-4 mr-2" />
                    Doc Agent
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

        {/* Alert Info Agent */}
        <Alert className="bg-purple-50 border-2 border-purple-300">
          <Bot className="w-5 h-5 text-purple-600" />
          <AlertDescription>
            <strong>🤖 Vous préférez le langage naturel ?</strong> Découvrez l'<strong>Agent Base44</strong> qui
            comprend vos demandes et exécute les actions automatiquement.
            <Link to={createPageUrl("N8nAgent")} className="text-purple-700 underline ml-2">
              Voir la documentation Agent →
            </Link>
          </AlertDescription>
        </Alert>

        {/* Tabs principales */}
        <Tabs defaultValue="guide" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="guide" className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              <span>Guide Config</span>
            </TabsTrigger>
            <TabsTrigger value="exemples" className="flex items-center gap-2">
              <Code className="w-4 h-4" />
              <span>Exemples</span>
            </TabsTrigger>
            <TabsTrigger value="test" className="flex items-center gap-2">
              <Send className="w-4 h-4" />
              <span>Tester</span>
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: GUIDE DE CONFIGURATION */}
          <TabsContent value="guide" className="space-y-6">
            {/* Étape 1: Créer le token API */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="w-5 h-5 text-amber-700" />
                  Étape 1 : Créer ton API Token Base44
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <AlertDescription>
                    <ol className="space-y-2 text-sm">
                      <li>1️⃣ Va sur : <code className="bg-stone-100 px-2 py-1 rounded">https://base44.com/apps/{APP_ID}/settings</code></li>
                      <li>2️⃣ Cherche la section <strong>"API Tokens"</strong> ou <strong>"Developer"</strong></li>
                      <li>3️⃣ Clique sur <strong>"Create New Token"</strong></li>
                      <li>4️⃣ Nom du token : <code className="bg-stone-100 px-2 py-1 rounded">n8n Integration</code></li>
                      <li>5️⃣ Active les permissions : <strong>Read & Write</strong> sur toutes les entités</li>
                      <li>6️⃣ <strong className="text-red-600">⚠️ Copie le token immédiatement</strong> (tu ne pourras le voir qu'une fois !)</li>
                    </ol>
                  </AlertDescription>
                </Alert>

                <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg">
                  <p className="text-sm text-amber-900 font-semibold mb-2">
                    📋 Format du token :
                  </p>
                  <code className="text-xs bg-white p-2 rounded block">
                    base44_1234567890abcdefghijklmnopqrstuvwxyz
                  </code>
                </div>
              </CardContent>
            </Card>

            {/* Étape 2: Configuration n8n */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-blue-700" />
                  Étape 2 : Configuration dans n8n
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Authentication */}
                <div>
                  <h3 className="font-bold text-stone-800 mb-3 flex items-center gap-2">
                    <Key className="w-4 h-4" />
                    🔐 Configuration Authentication
                  </h3>
                  <div className="bg-stone-50 border border-stone-200 p-4 rounded-lg">
                    <ol className="space-y-2 text-sm">
                      {n8nExamples.authentication.steps.map((step, index) => (
                        <li key={index} className="text-stone-700">{step}</li>
                      ))}
                    </ol>
                  </div>
                </div>

                {/* Paramètres HTTP Request */}
                <div>
                  <h3 className="font-bold text-stone-800 mb-3">⚙️ Paramètres HTTP Request</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-stone-600 mb-1 block">
                        Method (Méthode)
                      </label>
                      <div className="flex gap-2">
                        <Badge variant="outline">GET (lire)</Badge>
                        <Badge variant="outline">POST (créer)</Badge>
                        <Badge variant="outline">PATCH (modifier)</Badge>
                        <Badge variant="outline">DELETE (supprimer)</Badge>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-stone-600 mb-1 block">
                        URL de base
                      </label>
                      <div className="flex gap-2">
                        <code className="flex-1 bg-stone-100 p-2 rounded text-xs overflow-auto">
                          {API_BASE_URL}
                        </code>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyToClipboard(API_BASE_URL)}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-stone-600 mb-1 block">
                        App ID
                      </label>
                      <div className="flex gap-2">
                        <code className="flex-1 bg-stone-100 p-2 rounded text-xs">
                          {APP_ID}
                        </code>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyToClipboard(APP_ID)}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-stone-600 mb-1 block">
                        Headers (à ajouter manuellement)
                      </label>
                      <div className="bg-stone-900 text-green-400 p-3 rounded-lg font-mono text-xs">
                        <div>Content-Type: application/json</div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* URLs des entités */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="w-5 h-5 text-purple-700" />
                  Endpoints disponibles
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { name: "Chantier", path: "/entities/Chantier", desc: "Gestion des chantiers" },
                    { name: "Tache", path: "/entities/Tache", desc: "Gestion des tâches" },
                    { name: "ComptaURSSAF", path: "/entities/ComptaURSSAF", desc: "Déclarations URSSAF" },
                    { name: "Event", path: "/entities/Event", desc: "Événements planning" },
                    { name: "ListeCourse", path: "/entities/ListeCourse", desc: "Liste de courses" }
                  ].map((entity) => (
                    <div key={entity.name} className="bg-stone-50 p-3 rounded-lg border border-stone-200">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="font-bold text-stone-800">{entity.name}</div>
                          <div className="text-xs text-stone-600 mb-2">{entity.desc}</div>
                          <code className="text-xs bg-white px-2 py-1 rounded border">
                            {API_BASE_URL}/apps/{APP_ID}{entity.path}
                          </code>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard(`${API_BASE_URL}/apps/${APP_ID}${entity.path}`)}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 2: EXEMPLES DE REQUÊTES */}
          <TabsContent value="exemples" className="space-y-6">
            {Object.entries(n8nExamples).map(([key, example]) => {
              if (key === 'authentication') return null;

              return (
                <Card key={key}>
                  <CardHeader>
                    <CardTitle className="text-lg">{example.titre}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3">
                      <div>
                        <label className="text-xs font-semibold text-stone-600 mb-1 block">
                          Method
                        </label>
                        <Badge className="bg-blue-600 text-white">
                          {example.config.method}
                        </Badge>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-stone-600 mb-1 block">
                          URL
                        </label>
                        <div className="flex gap-2">
                          <code className="flex-1 bg-stone-100 p-2 rounded text-xs overflow-auto">
                            {example.config.url}
                          </code>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => copyToClipboard(example.config.url)}
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-stone-600 mb-1 block">
                          Authentication
                        </label>
                        <Badge variant="outline">{example.config.authentication}</Badge>
                      </div>

                      {example.config.body && (
                        <div>
                          <label className="text-xs font-semibold text-stone-600 mb-1 block">
                            Body (JSON)
                          </label>
                          <div className="relative">
                            <pre className="bg-stone-900 text-green-400 p-4 rounded-lg overflow-auto text-xs">
                              {JSON.stringify(example.config.body, null, 2)}
                            </pre>
                            <Button
                              size="sm"
                              variant="outline"
                              className="absolute top-2 right-2"
                              onClick={() => copyToClipboard(JSON.stringify(example.config.body, null, 2))}
                            >
                              <Copy className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      )}

                      {example.note && (
                        <Alert className="bg-amber-50 border-amber-200">
                          <AlertDescription className="text-amber-900 text-xs">
                            {example.note}
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          {/* TAB 3: TESTER */}
          <TabsContent value="test" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Test Base44 → n8n */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ArrowRight className="w-5 h-5 text-blue-600" />
                    Tester Base44 → n8n
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-semibold text-stone-700 mb-2 block">
                      📤 Données JSON à envoyer
                    </label>
                    <Textarea
                      value={customData}
                      onChange={(e) => setCustomData(e.target.value)}
                      rows={10}
                      className="font-mono text-xs"
                    />
                  </div>

                  <Button
                    onClick={handleTestWebhook}
                    disabled={isLoading}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4 mr-2" />
                    )}
                    Envoyer vers n8n
                  </Button>

                  {result && (
                    <Alert className="bg-green-50 border-green-500">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                      <AlertDescription>
                        <div className="font-semibold text-green-800 mb-2">✅ Succès</div>
                        <pre className="text-xs bg-white p-2 rounded overflow-auto max-h-40">
                          {JSON.stringify(result, null, 2)}
                        </pre>
                      </AlertDescription>
                    </Alert>
                  )}

                  {error && (
                    <Alert className="bg-red-50 border-red-500">
                      <XCircle className="w-4 h-4 text-red-600" />
                      <AlertDescription className="text-red-800 text-sm">
                        <div className="font-semibold mb-1">❌ Erreur</div>
                        <code className="text-xs">{error}</code>
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>

              {/* Info webhook */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ArrowLeft className="w-5 h-5 text-amber-600" />
                    Webhook n8n configuré
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Alert>
                    <AlertDescription>
                      <div className="font-semibold mb-2">🔗 URL de ton webhook n8n :</div>
                      <code className="text-xs bg-stone-100 p-2 rounded block overflow-auto">
                        {N8N_WEBHOOK_URL}
                      </code>
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-2">
                    <h3 className="font-semibold text-sm text-stone-800">
                      📋 Format des webhooks Base44 → n8n
                    </h3>
                    <pre className="bg-stone-900 text-green-400 p-3 rounded-lg text-xs overflow-auto">
                      {`{
  "timestamp": "2025-01-06T10:30:00Z",
  "source": "base44_app",
  "event": "chantier_created",
  "payload": {
    "id": "123",
    "titre": "Rénovation Dupont",
    ...
  }
}`}
                    </pre>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-semibold text-sm text-stone-800">
                      🎯 Événements disponibles
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {[
                        "chantier_created",
                        "chantier_updated",
                        "tache_urgente_created",
                        "urssaf_declared",
                        "planning_event_created"
                      ].map((event) => (
                        <Badge key={event} variant="outline" className="text-xs">
                          {event}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Résumé des infos importantes */}
        <Card className="border-2 border-amber-500">
          <CardHeader className="bg-amber-50">
            <CardTitle className="flex items-center gap-2 text-amber-900">
              <FileJson className="w-5 h-5" />
              📝 Récapitulatif des informations clés
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-bold text-stone-800 mb-3">Base44 → n8n (Webhooks)</h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-semibold">URL Webhook :</span>
                    <code className="block bg-stone-100 p-2 rounded text-xs mt-1 overflow-auto">
                      {N8N_WEBHOOK_URL}
                    </code>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-bold text-stone-800 mb-3">n8n → Base44 (HTTP Request)</h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-semibold">API Base URL :</span>
                    <code className="block bg-stone-100 p-2 rounded text-xs mt-1">
                      {API_BASE_URL}
                    </code>
                  </div>
                  <div>
                    <span className="font-semibold">App ID :</span>
                    <code className="block bg-stone-100 p-2 rounded text-xs mt-1">
                      {APP_ID}
                    </code>
                  </div>
                  <div>
                    <span className="font-semibold">Authentication :</span>
                    <code className="block bg-stone-100 p-2 rounded text-xs mt-1">
                      Header Auth → Authorization: Bearer TON_TOKEN
                    </code>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
