
import React, { useState } from "react";
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
  CheckCircle2, 
  XCircle, 
  Loader2,
  Wrench,
  ListChecks,
  Calendar,
  DollarSign,
  ShoppingCart,
  Clock,
  TrendingUp,
  Activity
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/api/apiClient";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

const N8N_WEBHOOK_URL = "https://atelierdesespaces.app.n8n.cloud/webhook/741d7444-695c-46a3-92c1-ad6375fd7025";

// Actions rapides prédéfinies
const quickActions = [
  {
    id: "create_chantier",
    title: "Créer un chantier",
    icon: Wrench,
    color: "blue",
    description: "Déclenchement manuel d'un nouveau chantier",
    fields: [
      { name: "titre", label: "Titre du chantier", type: "text", required: true },
      { name: "client", label: "Client", type: "text", required: true },
      { name: "date_debut", label: "Date de début", type: "date", required: false },
      { name: "budget_estime", label: "Budget estimé", type: "text", required: false },
    ]
  },
  {
    id: "create_tache",
    title: "Créer une tâche",
    icon: ListChecks,
    color: "purple",
    description: "Ajouter une nouvelle tâche urgente",
    fields: [
      { name: "titre", label: "Titre de la tâche", type: "text", required: true },
      { name: "priorite", label: "Priorité", type: "select", options: ["haute", "normale", "basse"], required: true },
      { name: "date_limite", label: "Date limite", type: "date", required: false },
    ]
  },
  {
    id: "create_event",
    title: "Ajouter un événement",
    icon: Calendar,
    color: "green",
    description: "Planifier un nouveau rendez-vous",
    fields: [
      { name: "title", label: "Titre", type: "text", required: true },
      { name: "start", label: "Date et heure début", type: "datetime-local", required: true },
      { name: "end", label: "Date et heure fin", type: "datetime-local", required: true },
      { name: "description", label: "Description", type: "textarea", required: false },
    ]
  },
  {
    id: "declare_urssaf",
    title: "Déclarer URSSAF",
    icon: DollarSign,
    color: "amber",
    description: "Enregistrer une déclaration URSSAF",
    fields: [
      { name: "periode", label: "Période", type: "text", required: true, placeholder: "Ex: 2025-01" },
      { name: "ca_encaisse", label: "CA encaissé (€)", type: "number", required: true },
      { name: "taux_urssaf", label: "Taux URSSAF (%)", type: "number", required: false, placeholder: "22" },
    ]
  },
  {
    id: "add_liste_item",
    title: "Ajouter à la liste",
    icon: ShoppingCart,
    color: "pink",
    description: "Ajouter un item à la liste de courses",
    fields: [
      { name: "titre", label: "Nom de l'item", type: "text", required: true },
      { name: "categorie", label: "Catégorie", type: "select", options: ["courses", "materiaux", "outils", "a_retenir"], required: true },
      { name: "urgence", label: "Urgence", type: "select", options: ["normale", "importante", "urgente"], required: false },
    ]
  },
];

// Composant pour afficher l'historique
function HistoryItem({ item }) {
  return (
    <div className={`p-4 rounded-lg border-2 ${
      item.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
    }`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {item.success ? (
            <CheckCircle2 className="w-5 h-5 text-green-600" />
          ) : (
            <XCircle className="w-5 h-5 text-red-600" />
          )}
          <span className="font-semibold text-sm">{item.action}</span>
        </div>
        <span className="text-xs text-stone-500">
          {new Date(item.timestamp).toLocaleString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          })}
        </span>
      </div>
      {item.data && (
        <pre className="text-xs bg-white/50 p-2 rounded overflow-auto max-h-20">
          {JSON.stringify(item.data, null, 2)}
        </pre>
      )}
      {item.error && (
        <p className="text-xs text-red-700 mt-1">{item.error}</p>
      )}
    </div>
  );
}

export default function N8nInterface() {
  const [selectedAction, setSelectedAction] = useState(null);
  const [formData, setFormData] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    success: 0,
    errors: 0
  });

  // Envoyer vers n8n
  const sendToN8n = async (eventType, payload) => {
    try {
      const response = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          timestamp: new Date().toISOString(),
          source: 'api_app',
          event: eventType,
          payload: payload
        })
      });

      if (!response.ok) {
        throw new Error(`Webhook error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Erreur n8n:', error);
      throw error;
    }
  };

  // Créer directement dans Base44 (sans passer par n8n)
  const createDirectly = async (entity, data) => {
    try {
      switch(entity) {
        case 'Chantier':
          return await api.entities.Chantier.create(data);
        case 'Tache':
          return await api.entities.Tache.create(data);
        case 'Event':
          return await api.entities.Event.create(data);
        case 'ComptaURSSAF':
          // Calculer le montant si manquant
          if (data.ca_encaisse && !data.montant_urssaf) {
            const taux = data.taux_urssaf || 22;
            data.montant_urssaf = (data.ca_encaisse * taux / 100);
          }
          return await api.entities.ComptaURSSAF.create(data);
        case 'ListeCourse':
          return await api.entities.ListeCourse.create(data);
        default:
          throw new Error(`Entity ${entity} not supported`);
      }
    } catch (error) {
      console.error('Erreur création directe:', error);
      throw error;
    }
  };

  const handleQuickAction = async (action) => {
    setIsLoading(true);
    const startTime = Date.now();

    try {
      // Déterminer l'entité cible
      let entityName = '';
      let eventType = '';
      let redirectPath = null; // Nouveau: pour la redirection
      
      switch(action.id) {
        case 'create_chantier':
          entityName = 'Chantier';
          eventType = 'chantier_created';
          formData.statut = 'devis';
          redirectPath = 'SuiviChantiers'; // This redirectPath is still set, but overridden by specific toast message
          break;
        case 'create_tache':
          entityName = 'Tache';
          eventType = 'tache_created';
          formData.statut = 'a_faire';
          redirectPath = 'SuiviChantiers'; // This redirectPath is still set, but overridden by specific toast message
          break;
        case 'create_event':
          entityName = 'Event';
          eventType = 'event_created';
          // Planning section dans Gestion
          break;
        case 'declare_urssaf':
          entityName = 'ComptaURSSAF';
          eventType = 'urssaf_declared';
          formData.statut_paiement = 'a_payer';
          break;
        case 'add_liste_item':
          entityName = 'ListeCourse';
          eventType = 'liste_item_added';
          formData.fait = false;
          // Listes section dans Gestion
          break;
      }

      // 1. Créer directement dans Base44
      const result = await createDirectly(entityName, formData);

      // 2. Notifier n8n (asynchrone, pas bloqueant)
      sendToN8n(eventType, result).catch(err => {
        console.error('Erreur notification n8n:', err);
      });

      const duration = Date.now() - startTime;

      // Succès
      const historyItem = {
        action: action.title,
        success: true,
        timestamp: new Date().toISOString(),
        data: result,
        duration: `${duration}ms`,
        redirectPath: redirectPath // Stocker le chemin de redirection
      };

      setHistory(prev => [historyItem, ...prev.slice(0, 19)]); // Garder 20 max
      setStats(prev => ({
        total: prev.total + 1,
        success: prev.success + 1,
        errors: prev.errors
      }));

      // Toast avec lien de redirection si disponible
      if (action.id === 'add_liste_item') {
        toast.success(
          <div>
            <div className="font-semibold">{action.title} - Créé avec succès !</div>
            <div className="text-xs mt-1">📋 Voir dans la section Listes de Gestion</div>
          </div>
        );
      } else if (action.id === 'create_chantier' || action.id === 'create_tache') {
        toast.success(`${action.title} - Créé avec succès ! Consultez l'Assistant Gestion`);
      } else if (redirectPath) {
        toast.success(`${action.title} - Créé avec succès ! Consultez ${redirectPath}`);
      } else {
        toast.success(`${action.title} - Créé avec succès !`);
      }

      setFormData({});
      setSelectedAction(null);

    } catch (error) {
      const historyItem = {
        action: action.title,
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

      toast.error(`Erreur : ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFieldChange = (fieldName, value) => {
    setFormData(prev => ({
      ...prev,
      [fieldName]: value
    }));
  };

  return (
    <div className="min-h-screen bg-neutral-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <Card className="border-amber-700 border-2 shadow-xl">
          <CardHeader className="bg-gradient-to-r from-amber-700 to-amber-800 text-white">
            <div className="flex items-center gap-3">
              <Zap className="w-8 h-8" />
              <div>
                <CardTitle className="text-2xl">Interface n8n</CardTitle>
                <p className="text-amber-100 text-sm">Automatisation et gestion des données</p>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Alert d'aide */}
        <Alert className="bg-blue-50 border-blue-200">
          <AlertDescription className="text-sm">
            💡 <strong>Astuce :</strong> Les données créées ici sont accessibles dans les sections correspondantes de <strong>Gestion</strong> :
            <div className="mt-2 flex flex-wrap gap-2">
              <Link 
                to={createPageUrl("Gestion")} 
                className="text-xs bg-white px-2 py-1 rounded border border-blue-300 hover:bg-blue-50"
              >
                📋 Listes → Section "Listes"
              </Link>
              <Link 
                to={createPageUrl("Gestion")} 
                className="text-xs bg-white px-2 py-1 rounded border border-blue-300 hover:bg-blue-50"
              >
                🏗️ Chantiers → Section "Assistant"
              </Link>
              <Link 
                to={createPageUrl("Gestion")} 
                className="text-xs bg-white px-2 py-1 rounded border border-blue-300 hover:bg-blue-50"
              >
                📅 Events → Section "Planning"
              </Link>
            </div>
          </AlertDescription>
        </Alert>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-stone-500 mb-1">Total Requêtes</p>
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
                  <p className="text-2xl font-bold text-amber-600">
                    {stats.total > 0 ? Math.round((stats.success / stats.total) * 100) : 0}%
                  </p>
                </div>
                <TrendingUp className="w-8 h-8 text-amber-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="actions" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="actions">Actions Rapides</TabsTrigger>
            <TabsTrigger value="history">Historique</TabsTrigger>
          </TabsList>

          {/* Tab Actions */}
          <TabsContent value="actions" className="space-y-6">
            {!selectedAction ? (
              <>
                <Alert>
                  <AlertDescription>
                    💡 <strong>Sélectionnez une action</strong> pour déclencher automatiquement un workflow n8n et créer des données dans Base44
                  </AlertDescription>
                </Alert>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {quickActions.map((action) => {
                    const Icon = action.icon;
                    const colorClasses = {
                      blue: "bg-blue-50 border-blue-200 hover:border-blue-400",
                      purple: "bg-purple-50 border-purple-200 hover:border-purple-400",
                      green: "bg-green-50 border-green-200 hover:border-green-400",
                      amber: "bg-amber-50 border-amber-200 hover:border-amber-400",
                      pink: "bg-pink-50 border-pink-200 hover:border-pink-400",
                    };

                    return (
                      <Card 
                        key={action.id}
                        className={`cursor-pointer transition-all ${colorClasses[action.color]} border-2`}
                        onClick={() => setSelectedAction(action)}
                      >
                        <CardContent className="p-6">
                          <Icon className={`w-10 h-10 mb-3 text-${action.color}-600`} />
                          <h3 className="text-lg font-bold text-stone-800 mb-2">{action.title}</h3>
                          <p className="text-sm text-stone-600">{action.description}</p>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </>
            ) : (
              <Card>
                <CardHeader className="border-b">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <selectedAction.icon className="w-6 h-6" />
                      {selectedAction.title}
                    </CardTitle>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setSelectedAction(null);
                        setFormData({});
                      }}
                    >
                      Retour
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    handleQuickAction(selectedAction);
                  }} className="space-y-4">
                    {selectedAction.fields.map((field) => (
                      <div key={field.name}>
                        <label className="block text-sm font-semibold text-stone-700 mb-2">
                          {field.label} {field.required && <span className="text-red-500">*</span>}
                        </label>
                        
                        {field.type === 'select' ? (
                          <select
                            className="w-full h-11 px-3 border-2 border-stone-300 rounded-lg focus:border-amber-600 focus:outline-none"
                            value={formData[field.name] || ''}
                            onChange={(e) => handleFieldChange(field.name, e.target.value)}
                            required={field.required}
                          >
                            <option value="">Sélectionner...</option>
                            {field.options.map(opt => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        ) : field.type === 'textarea' ? (
                          <Textarea
                            value={formData[field.name] || ''}
                            onChange={(e) => handleFieldChange(field.name, e.target.value)}
                            required={field.required}
                            rows={3}
                            placeholder={field.placeholder}
                          />
                        ) : (
                          <Input
                            type={field.type}
                            value={formData[field.name] || ''}
                            onChange={(e) => handleFieldChange(field.name, e.target.value)}
                            required={field.required}
                            placeholder={field.placeholder}
                          />
                        )}
                      </div>
                    ))}

                    <div className="flex gap-3 pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setSelectedAction(null);
                          setFormData({});
                        }}
                        className="flex-1"
                        disabled={isLoading}
                      >
                        Annuler
                      </Button>
                      <Button
                        type="submit"
                        className="flex-1 bg-amber-700 hover:bg-amber-800"
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Création...
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4 mr-2" />
                            Créer
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Tab Historique */}
          <TabsContent value="history" className="space-y-4">
            {history.length === 0 ? (
              <Alert>
                <Clock className="w-4 h-4" />
                <AlertDescription>
                  Aucune action effectuée pour le moment. Les 20 dernières actions s'afficheront ici.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-stone-800">
                    Dernières actions ({history.length})
                  </h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setHistory([]);
                      setStats({ total: 0, success: 0, errors: 0 });
                    }}
                  >
                    Effacer l'historique
                  </Button>
                </div>

                <div className="space-y-3">
                  {history.map((item, index) => (
                    <HistoryItem key={index} item={item} />
                  ))}
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

