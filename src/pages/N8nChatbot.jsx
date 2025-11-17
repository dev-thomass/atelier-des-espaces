
import React, { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Bot, 
  Send, 
  Loader2,
  Sparkles,
  MessageSquare,
  Zap,
  Lightbulb,
  Terminal
} from "lucide-react";
import { toast } from "sonner";

// URL du chatbot n8n
const N8N_CHATBOT_URL = "https://atelierdesespaces.app.n8n.cloud/webhook-test/741d7444-695c-46a3-92c1-ad6375fd7025";

// Fonction d'envoi au chatbot
async function sendToChatbot(message) {
  try {
    const response = await fetch(N8N_CHATBOT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chatInput: message
      })
    });

    if (!response.ok) {
      throw new Error(`Chatbot error: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Erreur chatbot n8n:', error);
    throw error;
  }
}

// Exemples de commandes
const exemples = {
  chantiers: [
    "Crée un chantier pour la rénovation Dupont le 15 novembre",
    "Liste tous mes chantiers en cours",
    "Quel est l'état d'avancement du chantier Martin ?",
    "Mets à jour le chantier Lefebvre en statut terminé"
  ],
  taches: [
    "Ajoute une tâche : vérifier la pompe chez Durand",
    "Liste mes tâches urgentes",
    "Marque la tâche d'électricité comme terminée",
    "Quelles sont mes tâches de la semaine ?"
  ],
  urssaf: [
    "Calcule mes charges URSSAF pour janvier 2025 avec un CA de 5000€",
    "Quel est le montant URSSAF à payer ce trimestre ?",
    "Déclare un CA de 12000€ pour le mois dernier"
  ],
  planning: [
    "Ajoute un rendez-vous client demain à 14h",
    "Qu'est-ce que j'ai au planning cette semaine ?",
    "Crée un événement : livraison matériaux le 20 janvier à 9h"
  ]
};

function MessageBubble({ message, isUser }) {
  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'} mb-4 animate-in fade-in slide-in-from-bottom-2 duration-300`}>
      {!isUser && (
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-700 to-amber-900 flex items-center justify-center flex-shrink-0 shadow-lg">
          <Bot className="w-5 h-5 text-white" />
        </div>
      )}
      <div className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-md ${
        isUser 
          ? 'bg-gradient-to-br from-amber-700 to-amber-800 text-white' 
          : 'bg-white border-2 border-stone-200 text-stone-800'
      }`}>
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{message}</p>
      </div>
      {isUser && (
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-stone-700 to-stone-900 flex items-center justify-center flex-shrink-0 shadow-lg">
          <span className="text-white text-sm font-bold">T</span>
        </div>
      )}
    </div>
  );
}

export default function N8nChatbot() {
  const [messages, setMessages] = useState([
    {
      text: "Salut Thomas ! 👋\n\nJe suis ton assistant n8n connecté. Je peux t'aider à gérer tes chantiers, tâches, URSSAF et planning.\n\nQue puis-je faire pour toi ?",
      isUser: false
    }
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = inputMessage.trim();
    
    // Ajouter le message utilisateur
    setMessages(prev => [...prev, { text: userMessage, isUser: true }]);
    setInputMessage("");
    setIsLoading(true);

    try {
      const response = await sendToChatbot(userMessage);
      
      // Extraire la réponse du chatbot
      let botResponse = "Réponse reçue";
      
      if (response.output) {
        botResponse = response.output;
      } else if (response.message) {
        botResponse = response.message;
      } else if (typeof response === 'string') {
        botResponse = response;
      } else {
        // Si la réponse est un objet, l'afficher en JSON formaté
        botResponse = JSON.stringify(response, null, 2);
      }

      setMessages(prev => [...prev, { text: botResponse, isUser: false }]);
      toast.success("Message envoyé !");
    } catch (error) {
      console.error("Error:", error);
      setMessages(prev => [...prev, { 
        text: `Erreur : ${error.message}\n\nImpossible de contacter le chatbot n8n.`, 
        isUser: false 
      }]);
      toast.error("Erreur lors de l'envoi");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleExempleClick = (exemple) => {
    setInputMessage(exemple);
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
                <CardTitle className="text-2xl">Chatbot n8n - L'Atelier des Espaces</CardTitle>
                <p className="text-amber-100 text-sm">Assistant intelligent connecté à votre workflow n8n</p>
              </div>
            </div>
          </CardHeader>
        </Card>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Chat Principal */}
          <div className="lg:col-span-2">
            <Card className="border-none shadow-xl">
              <CardContent className="p-0">
                {/* Zone de messages */}
                <div className="h-[600px] overflow-y-auto p-6 bg-gradient-to-b from-stone-50 to-white">
                  {messages.map((message, index) => (
                    <MessageBubble 
                      key={index} 
                      message={message.text} 
                      isUser={message.isUser} 
                    />
                  ))}
                  
                  {isLoading && (
                    <div className="flex gap-3 justify-start mb-4 animate-in fade-in">
                      <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-700 to-amber-900 flex items-center justify-center flex-shrink-0 shadow-lg">
                        <Bot className="w-5 h-5 text-white" />
                      </div>
                      <div className="bg-white border-2 border-stone-200 rounded-2xl px-4 py-3 shadow-md">
                        <div className="flex gap-1">
                          <div className="w-2 h-2 bg-amber-700 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-amber-700 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                          <div className="w-2 h-2 bg-amber-700 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div ref={messagesEndRef} />
                </div>

                {/* Zone d'input */}
                <div className="p-4 border-t-2 border-stone-200 bg-white">
                  <div className="flex gap-3">
                    <Textarea
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Ex: Crée un chantier pour la rénovation Dupont le 15 novembre"
                      className="resize-none border-2 border-stone-300 focus:border-amber-700"
                      rows={2}
                      disabled={isLoading}
                    />
                    <Button
                      onClick={handleSendMessage}
                      disabled={!inputMessage.trim() || isLoading}
                      className="bg-gradient-to-br from-amber-700 to-amber-900 hover:from-amber-800 hover:to-amber-950 px-6 shadow-lg"
                    >
                      {isLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Send className="w-5 h-5" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-stone-500 mt-2">
                    💡 Discute naturellement avec le chatbot pour gérer tes chantiers, tâches et planning
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar Exemples */}
          <div className="space-y-6">
            {/* Info connexion */}
            <Alert className="bg-green-50 border-green-500">
              <Sparkles className="w-4 h-4 text-green-600" />
              <AlertDescription className="text-green-800">
                <div className="font-semibold mb-1">✅ Connecté à n8n</div>
                <code className="text-xs break-all">{N8N_CHATBOT_URL.split('/webhook-test')[1] || N8N_CHATBOT_URL.split('/webhook')[1]}</code>
              </AlertDescription>
            </Alert>

            {/* Exemples de commandes */}
            <Card className="border-none shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Lightbulb className="w-5 h-5 text-amber-700" />
                  Exemples de commandes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Chantiers */}
                <div>
                  <Badge className="bg-blue-100 text-blue-800 mb-2">
                    <MessageSquare className="w-3 h-3 mr-1" />
                    Chantiers
                  </Badge>
                  <div className="space-y-2">
                    {exemples.chantiers.slice(0, 2).map((exemple, index) => (
                      <button
                        key={index}
                        onClick={() => handleExempleClick(exemple)}
                        className="w-full text-left text-xs p-2 bg-stone-50 hover:bg-amber-50 border border-stone-200 hover:border-amber-300 rounded-lg transition-colors"
                      >
                        {exemple}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tâches */}
                <div>
                  <Badge className="bg-purple-100 text-purple-800 mb-2">
                    <Terminal className="w-3 h-3 mr-1" />
                    Tâches
                  </Badge>
                  <div className="space-y-2">
                    {exemples.taches.slice(0, 2).map((exemple, index) => (
                      <button
                        key={index}
                        onClick={() => handleExempleClick(exemple)}
                        className="w-full text-left text-xs p-2 bg-stone-50 hover:bg-amber-50 border border-stone-200 hover:border-amber-300 rounded-lg transition-colors"
                      >
                        {exemple}
                      </button>
                    ))}
                  </div>
                </div>

                {/* URSSAF */}
                <div>
                  <Badge className="bg-amber-100 text-amber-800 mb-2">
                    💰 URSSAF
                  </Badge>
                  <div className="space-y-2">
                    {exemples.urssaf.slice(0, 2).map((exemple, index) => (
                      <button
                        key={index}
                        onClick={() => handleExempleClick(exemple)}
                        className="w-full text-left text-xs p-2 bg-stone-50 hover:bg-amber-50 border border-stone-200 hover:border-amber-300 rounded-lg transition-colors"
                      >
                        {exemple}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Planning */}
                <div>
                  <Badge className="bg-green-100 text-green-800 mb-2">
                    📅 Planning
                  </Badge>
                  <div className="space-y-2">
                    {exemples.planning.slice(0, 2).map((exemple, index) => (
                      <button
                        key={index}
                        onClick={() => handleExempleClick(exemple)}
                        className="w-full text-left text-xs p-2 bg-stone-50 hover:bg-amber-50 border border-stone-200 hover:border-amber-300 rounded-lg transition-colors"
                      >
                        {exemple}
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Info technique */}
            <Card className="border-none shadow-lg bg-gradient-to-br from-stone-900 to-stone-800 text-white">
              <CardContent className="p-4">
                <h3 className="font-bold mb-2 flex items-center gap-2">
                  <Terminal className="w-4 h-4" />
                  Format de requête
                </h3>
                <pre className="text-xs bg-black/30 p-2 rounded overflow-x-auto">
{`POST ${N8N_CHATBOT_URL}

{
  "chatInput": "ton message"
}`}
                </pre>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
