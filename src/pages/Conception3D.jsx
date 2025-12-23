
import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Ruler,
  CheckCircle2,
  Box,
  FileText,
  Send,
  Sparkles,
  Target,
  Clock,
  ArrowRight,
  ZoomIn,
  Bot,
  Mail,
  Phone,
  MapPin,
  MessageSquare,
  Mic, // Added Mic icon for voice input
  MicOff // Added MicOff icon for voice input
} from "lucide-react";
import { api } from "@/api/apiClient";
import { useScrollAnimation } from "@/hooks/use-scroll-animation";
import { useSEO } from "@/hooks/use-seo";


// Composant de Message - AMELIORE AVEC DETAILS N8N
function MessageBubble({ message }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'} mb-4 animate-in fade-in slide-in-from-bottom-2 duration-300`}>
      {!isUser && (
        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-amber-700 to-amber-900 flex items-center justify-center flex-shrink-0 shadow-lg">
          <Bot className="w-5 h-5 text-white" />
        </div>
      )}
      <div className={`max-w-[85%] ${
        isUser
          ? 'bg-gradient-to-br from-amber-700 to-amber-800 text-white rounded-2xl px-4 py-3 shadow-md'
          : 'space-y-2' // Apply spacing for multiple bubbles (message + actions)
      }`}>
        {isUser ? (
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
        ) : (
          <>
            {/* Message principal de l'assistant */}
            <div className="bg-white border-2 border-stone-200 text-stone-800 rounded-2xl px-4 py-3 shadow-md">
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
            </div>

            {/* Actions effectuees */}
            {message.actions && message.actions.length > 0 && (
              <div className="bg-green-50 border-2 border-green-200 rounded-lg p-3 text-xs">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <span className="font-semibold text-green-900">Actions effectuees :</span>
                </div>
                <div className="space-y-1">
                  {message.actions.map((action, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full mt-1.5 ${
                        action.status === 'success' ? 'bg-green-500' :
                        action.status === 'error' ? 'bg-red-500' : 'bg-blue-500'
                      }`}></div>
                      <div className="flex-1">
                        <span className="text-green-800">
                          {action.type === 'create' && ' Creation'}
                          {action.type === 'update' && ' Modification'}
                          {action.type === 'delete' && ' Suppression'}
                          {action.type === 'refresh' && ' Actualisation'}
                          {' '}<strong>{action.entity}</strong>
                        </span>
                        {action.status === 'error' && (
                          <span className="text-red-600 ml-1">- Erreur</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </>
        )}
      </div>
      {isUser && (
        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-stone-700 to-stone-900 flex items-center justify-center flex-shrink-0 shadow-lg">
          <span className="text-white text-sm font-bold">V</span>
        </div>
      )}
    </div>
  );
}

// Composant Chat Assistant - VERSION N8N avec historique
function AssistantChat() {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);

  // SCROLL AUTOMATIQUE SUPPRIME - l'utilisateur peut defiler manuellement

  useEffect(() => {
    setMessages([{
      role: 'assistant',
      content: "Bonjour !  Je suis l'assistant expert de l'Atelier des Espaces.\n\nJe vais vous aider a definir votre besoin en scan 3D et plans detailles.\n\nPour commencer, dites-moi quel type d'espace vous souhaitez scanner ?\n(appartement, maison, local commercial, bureau...)",
      noAction: true
    }]);
  }, []);

  // Initialiser la reconnaissance vocale
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false; // Only one utterance at a time
      recognitionRef.current.interimResults = false; // Only final results
      recognitionRef.current.lang = 'fr-FR'; // Set language to French

      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInputMessage(prev => prev + (prev ? ' ' : '') + transcript); // Append to existing input
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    } else {
      console.warn("Speech Recognition API not supported in this browser.");
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const toggleVoiceInput = () => {
    if (!recognitionRef.current) {
      alert("La reconnaissance vocale n'est pas supportee par votre navigateur.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setInputMessage(""); // Clear input before starting voice recognition
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const sendToN8n = async (userMessage) => {
    try {
      const payload = {
        userMessage: userMessage,
        context: "assistant_projet_scan3d",
        conversationId: conversationId
      };


      // Appel DIRECT a l'agent maitre (plus de passage par n8n)
      const response = await api.functions.invoke('invokeAgent', payload);
      
      const result = response.data;

      if (result.conversationId && !conversationId) {
        setConversationId(result.conversationId);
      }

      // Extraire le message et les actions
      const message = result.message || result.output || "Message recu";
      const actions = result.actions || [];

      // Verifier si des actions ont ete effectuees
      const hasRealActions = actions.some(a => a.type !== 'refresh' && a.status !== 'pending_frontend');

      return {
        message,
        actions,
        noAction: !hasRealActions
      };
    } catch (error) {
      console.error('Erreur agent:', error);
      throw error;
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = inputMessage.trim();
    setInputMessage("");

    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const aiResponse = await sendToN8n(userMessage);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: aiResponse.message,
        actions: aiResponse.actions,
        noAction: aiResponse.noAction
      }]);
    } catch (error) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "Desole, une erreur s'est produite. Veuillez reessayer ou utiliser le formulaire de contact.",
        noAction: true // If error, no action was performed
      }]);
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

  const quickSuggestions = [
    "Scan d'appartement",
    "Plans de maison",
    "Local commercial",
    "Bureau professionnel"
  ];

  return (
    <div className="flex flex-col h-[600px] bg-gradient-to-br from-stone-50 to-white rounded-xl border-2 border-stone-200 shadow-xl overflow-hidden">
      <div className="bg-gradient-to-r from-amber-700 via-amber-800 to-amber-900 text-white p-4 border-b-2 border-amber-900">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
            <Bot className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-lg">Assistant Expert IA</h3>
            <p className="text-xs text-amber-100">Definissez votre projet de scan 3D</p>
          </div>
          {conversationId && (
            <div className="text-xs text-amber-100 bg-white/10 px-2 py-1 rounded">
               Historique
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map((message, index) => (
          <MessageBubble key={index} message={message} />
        ))}
        {isLoading && (
          <div className="flex gap-3 justify-start mb-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-amber-700 to-amber-900 flex items-center justify-center flex-shrink-0 shadow-lg">
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

      {messages.length === 1 && !isLoading && (
        <div className="px-4 py-2 bg-stone-50 border-t border-stone-200">
          <p className="text-xs text-stone-600 mb-2 font-medium"> Suggestions rapides :</p>
          <div className="flex flex-wrap gap-2">
            {quickSuggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => setInputMessage(suggestion)}
                className="text-xs px-3 py-1.5 bg-white border border-amber-200 text-amber-800 rounded-lg hover:bg-amber-50 transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="p-4 border-t-2 border-stone-200 bg-white">
        <div className="flex gap-2">
          <Textarea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Decrivez votre projet... "
            className="resize-none border-2 border-stone-300 focus:border-amber-600"
            rows={2}
            disabled={isLoading}
          />
          <div className="flex flex-col gap-2">
            <Button
              onClick={toggleVoiceInput}
              disabled={isLoading}
              className={`${
                isListening 
                  ? 'bg-red-600 hover:bg-red-700 animate-pulse' 
                  : 'bg-amber-600 hover:bg-amber-700'
              } w-12 h-12 flex-shrink-0 p-0`} // Added w-12 h-12 and p-0 for better sizing
              title={isListening ? "Arreter la saisie vocale" : "Demarrer la saisie vocale"}
            >
              {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </Button>
            <Button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isLoading}
              className="bg-gradient-to-br from-amber-700 to-amber-900 hover:from-amber-800 hover:to-amber-950 shadow-lg w-12 h-12 flex-shrink-0 p-0" // Added w-12 h-12 and p-0 for better sizing
            >
              <Send className="w-5 h-5" />
            </Button>
          </div>
        </div>
        <p className="text-xs text-stone-500 mt-2">
           Plus vous donnez de details, plus mes recommandations seront precises
          {conversationId && <span className="ml-2"> Conversation sauvegardee</span>}
        </p>
      </div>
    </div>
  );
}

export default function Conception3D() {
  const assetBaseUrl = import.meta.env.BASE_URL || "/";
  const [heroRef, heroVisible] = useScrollAnimation({ threshold: 0.05 });

  const seoKeywords = "conception 3D marseille, scan 3D marseille, plans 3D marseille, modelisation 3D marseille, releve 3D marseille, plans detailles marseille, architecte interieur marseille, design interieur 3D marseille, visualisation 3D marseille, plans renovation marseille, mesures precises marseille";

  useSEO({
    title: "Conception & Modelisation 3D - Plans Detailles Marseille | L'Atelier des Espaces",
    description: "Services de conception 3D, scan 3D professionnel et plans detailles pour vos projets de renovation et amenagement a Marseille, Aix-en-Provence, Aubagne. Visualisez votre projet avant travaux.",
    keywords: seoKeywords
  });


  const avantages = [
    {
      icon: Target,
      titre: "Precision absolue",
      description: "Plans detailles au millimetre pres avec releve 3D professionnel"
    },
    {
      icon: Sparkles,
      titre: "Visualisation realiste",
      description: "Voyez votre projet en 3D avant le debut des travaux"
    },
    {
      icon: Clock,
      titre: "Gain de temps",
      description: "Moins d'imprevus grace a une planification optimale"
    },
    {
      icon: FileText,
      titre: "Documentation complete",
      description: "Plans, mesures, surfaces et volumes calcules automatiquement"
    }
  ];

  const visualisations3D = [
    {
      url: `${assetBaseUrl}plan3d.png`,
      titre: "Plan 3D",
      description: "Modelisation complete de votre espace"
    },
    {
      url: `${assetBaseUrl}scan3d.png`,
      titre: "Scan 3D",
      description: "Vue realiste de l'espace existing"
    }
  ];

  const planImages = [
    {
      url: `${assetBaseUrl}conception/cc20e1196_Plandetaill1.png`,
      titre: "Vue d'ensemble"
    },
    {
      url: `${assetBaseUrl}conception/536ebddd1_Plandetaill2.png`,
      titre: "Plan detaille"
    },
    {
      url: `${assetBaseUrl}conception/fd02cd6b1_Plandetaill3.png`,
      titre: "Mesures precises"
    },
    {
      url: `${assetBaseUrl}conception/3f9d221aa_Plandetaill4.png`,
      titre: "Plans par piece"
    },
    {
      url: `${assetBaseUrl}conception/e16b4360b_Plandetaill5.png`,
      titre: "Details techniques"
    }
  ];

  const infos = [
    { icon: Mail, label: "Email", value: "thomasromeo.bonnardel@gmail.com" },
    { icon: Phone, label: "Telephone", value: "06 95 07 10 84" },
    { icon: MapPin, label: "Zone", value: "Bouches-du-Rhone" },
    { icon: Clock, label: "Disponibilite", value: "7j/7j" }
  ];

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Hero Section - UNIFORMISE ET AFFINE */}
      <section ref={heroRef} className="relative min-h-[60vh] -mt-12 md:-mt-16 flex items-center justify-center overflow-hidden bg-gradient-to-br from-stone-950 via-stone-900 to-amber-900 pt-16 md:pt-20 pb-24 md:pb-28">
        <div className="absolute -top-24 left-0 right-0 h-[140%] bg-gradient-to-b from-stone-950 via-stone-900/80 to-stone-900/0 pointer-events-none" />
        {/* Grille 3D stylisee - Plus subtile */}
        <div className="absolute inset-0 opacity-[0.04]">
          <div className="absolute inset-0" style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                             linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
            transform: 'perspective(600px) rotateX(60deg)',
            transformOrigin: 'center center'
          }}></div>
        </div>

        {/* Effets lumineux - Legere touche technologique */}
        <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-amber-600/15 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-blue-600/10 rounded-full blur-[80px]"></div>

        <div className={`relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center transition-all duration-1000 ${
          heroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
        }`}>
          {/* Badge tech */}
          <Badge className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/20 text-amber-100 border border-amber-200/30 rounded-full mb-6">
            <Box className="w-4 h-4 text-amber-300" />
            <span className="text-sm font-medium text-white">Technologie 3D</span>
          </Badge>

          {/* Titre */}
          <h1 className="text-4xl md:text-6xl font-bold mb-5 tracking-tight">
            <span className="block text-white">Conception 3D</span>
            <span className="block text-white">
              & Scan <span className="bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 bg-clip-text text-transparent">Professionnel</span>
            </span>
          </h1>

          {/* Sous-titre */}
          <p className="text-base md:text-lg text-stone-300 max-w-3xl mx-auto leading-relaxed mb-6">
            Visualisez votre projet avant sa realisation grace a nos<br />
            <strong className="text-white">plans 3D detailles</strong> et notre <strong className="text-white">technologie de scan</strong>
          </p>

          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {[
              "Plan 3D",
              "Scan 3D",
              "Precision",
            ].map((item) => (
              <Badge key={item} className="bg-white/10 text-amber-100 border border-amber-200/30 text-xs px-3 py-1">
                {item}
              </Badge>
            ))}
          </div>

        </div>

        {/* Transition vague animée */}
        <div className="absolute bottom-0 left-0 right-0 overflow-hidden leading-none">
          <div className="wave-container relative h-[70px] md:h-[110px]">
            <svg className="wave-svg wave-1 absolute bottom-0 left-0 w-[200%] h-full" viewBox="0 0 1440 120" preserveAspectRatio="none">
              <path d="M0,40 C240,100 480,0 720,40 C960,80 1200,20 1440,60 C1680,100 1920,0 2160,40 C2400,80 2640,20 2880,60 L2880,120 L0,120 Z" fill="rgba(255,255,255,0.25)" />
            </svg>
            <svg className="wave-svg wave-2 absolute bottom-0 left-0 w-[200%] h-full" viewBox="0 0 1440 120" preserveAspectRatio="none">
              <path d="M0,60 C180,20 360,80 540,50 C720,20 900,90 1080,60 C1260,30 1440,80 1620,50 C1800,20 1980,90 2160,60 C2340,30 2520,80 2700,50 L2880,120 L0,120 Z" fill="rgba(255,255,255,0.5)" />
            </svg>
            <svg className="wave-svg wave-3 absolute bottom-0 left-0 w-[200%] h-full" viewBox="0 0 1440 120" preserveAspectRatio="none">
              <path d="M0,80 C120,100 240,60 360,80 C480,100 600,60 720,80 C840,100 960,60 1080,80 C1200,100 1320,60 1440,80 C1560,100 1680,60 1800,80 C1920,100 2040,60 2160,80 C2280,100 2400,60 2520,80 C2640,100 2760,60 2880,80 L2880,120 L0,120 Z" fill="#ffffff" />
            </svg>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 md:mb-16">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-stone-800 mb-4">
              Pourquoi choisir la conception 3D ?
            </h2>
            <div className="w-24 h-1 bg-amber-700 mx-auto"></div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8">
            {avantages.map((avantage, index) => (
              <Card key={index} className="border-none shadow-xl hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2">
                <CardContent className="p-4 md:p-8 text-center">
                  <div className="w-12 h-12 md:w-16 md:h-16 bg-gradient-to-br from-amber-700 to-amber-900 rounded-xl md:rounded-2xl flex items-center justify-center mx-auto mb-4 md:mb-6">
                    <avantage.icon className="w-6 h-6 md:w-8 md:h-8 text-white" />
                  </div>
                  <h3 className="text-sm md:text-xl font-bold text-stone-800 mb-2 md:mb-3">{avantage.titre}</h3>
                  <p className="text-xs md:text-base text-stone-600 leading-relaxed">{avantage.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 md:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 md:mb-16">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-stone-800 mb-4">
              Visualisation 3D
            </h2>
            <p className="text-base md:text-xl text-stone-600">
              Scan 3D et modelisation pour une vision complete de votre projet
            </p>
            <div className="w-24 h-1 bg-amber-700 mx-auto mt-4"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 mb-16 md:mb-20">
            {visualisations3D.map((visu, index) => (
              <Card key={index} className="border-none shadow-2xl overflow-hidden group">
                <a
                  href={visu.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <div className="relative h-64 md:h-[500px] bg-white flex items-center justify-center p-4 md:p-6 overflow-hidden">
                    <img
                      src={visu.url}
                      alt={visu.titre}
                      className="w-full h-full object-contain transform group-hover:scale-105 transition-transform duration-700"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-stone-900/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-center justify-center">
                      <div className="bg-white/90 rounded-full p-3 md:p-4">
                        <ZoomIn className="w-6 h-6 md:w-8 md:h-8 text-amber-700" />
                      </div>
                    </div>
                  </div>
                  <CardContent className="p-4 md:p-6 bg-gradient-to-br from-amber-900 to-amber-800">
                    <h3 className="text-xl md:text-2xl font-bold text-white mb-1 md:mb-2">{visu.titre}</h3>
                    <p className="text-sm md:text-base text-amber-100">{visu.description}</p>
                  </CardContent>
                </a>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 md:py-20 bg-stone-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 md:mb-16">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-stone-800 mb-4">
              Exemple de plan detaille
            </h2>
            <p className="text-base md:text-xl text-stone-600">
              Decouvrez un exemple reel de plan 3D que je realise pour mes clients
            </p>
            <div className="w-24 h-1 bg-amber-700 mx-auto mt-4"></div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 mb-8 md:mb-12">
            <Card className="border-none shadow-xl bg-white">
              <CardContent className="p-6 md:p-8">
                <div className="flex items-start gap-3 md:gap-4 mb-3 md:mb-4">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Box className="w-5 h-5 md:w-6 md:h-6 text-amber-700" />
                  </div>
                  <div>
                    <h3 className="text-xl md:text-2xl font-bold text-stone-800 mb-1 md:mb-2">Plan 3D detaille</h3>
                    <p className="text-sm md:text-base text-stone-600">
                      Scan complet de votre espace avec toutes les mesures precises
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-xl bg-white">
              <CardContent className="p-6 md:p-8">
                <h3 className="text-lg md:text-xl font-bold text-stone-800 mb-3 md:mb-4">Ce que contient un plan :</h3>
                <ul className="space-y-2 md:space-y-3">
                  {[
                    "Vue d'ensemble de l'espace en 2D et 3D",
                    "Surfaces au sol precises (m)",
                    "Hauteurs sous plafond",
                    "Dimensions des murs, portes et fenetres",
                    "Volumes calcules automatiquement",
                    "Plans detailles piece par piece"
                  ].map((item, index) => (
                    <li key={index} className="flex items-start gap-2 md:gap-3">
                      <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5 text-amber-700 flex-shrink-0 mt-0.5" />
                      <span className="text-xs md:text-base text-stone-700">{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-wrap justify-center gap-3 md:gap-4">
            {planImages.map((plan, index) => (
              <Card
                key={index}
                className="border-none shadow-xl overflow-hidden group cursor-pointer w-full sm:w-[calc(50%-8px)] lg:w-[calc(33.333%-12px)] max-w-[540px]"
              >
                <a
                  href={plan.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <div className="relative h-44 md:h-[320px] bg-white flex items-center justify-center p-2 md:p-4 overflow-hidden">
                    <img
                      src={plan.url}
                      alt={plan.titre}
                      className="w-full h-full object-contain transform group-hover:scale-105 transition-transform duration-700"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-stone-900/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-end justify-center pb-4 md:pb-6">
                      <div className="flex items-center gap-2 bg-white/90 rounded-full px-3 py-1.5 md:px-4 md:py-2">
                        <ZoomIn className="w-4 h-4 md:w-5 md:h-5 text-amber-700" />
                        <span className="text-xs md:text-base text-stone-800 font-semibold hidden sm:inline">Voir en grand</span>
                      </div>
                    </div>
                  </div>
                  <CardContent className="p-3 md:p-4 bg-gradient-to-br from-amber-900 to-amber-800">
                    <p className="text-center text-white font-semibold text-xs md:text-base">{plan.titre}</p>
                  </CardContent>
                </a>
              </Card>
            ))}
          </div>

          <Card className="border-none shadow-xl bg-gradient-to-br from-amber-100 to-amber-50 mt-6 md:mt-8">
            <CardContent className="p-6 md:p-8">
              <div className="flex items-start gap-3">
                <Ruler className="w-5 h-5 md:w-6 md:h-6 text-amber-700 flex-shrink-0" />
                <div>
                  <h3 className="text-base md:text-lg font-bold text-stone-800 mb-2">Processus rapide</h3>
                  <p className="text-sm md:text-base text-stone-700 leading-relaxed">
                    Je me deplace chez vous avec mon equipement professionnel de scan 3D.
                    En quelques heures, votre espace est entierement numerise. Vous recevez
                    vos plans detailles sous 48h.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA - HARMONISE AVEC ACCUEIL */}
      <section className="py-20 bg-gradient-to-r from-amber-900 via-amber-800 to-amber-900 relative overflow-hidden group">
        <div className="absolute inset-0 opacity-10 group-hover:opacity-20 transition-opacity duration-700">
          <div className="absolute inset-0" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%23ffffff" fill-opacity="1"%3E%3Cpath d="M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }}></div>
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-10 group-hover:scale-105 transition-transform duration-300">
            Pret a transformer votre interieur ?
          </h2>
          <p className="text-xl text-amber-100 mb-10 leading-relaxed">
            Contactez-moi pour un devis gratuit et personnalise
          </p>
          <Link to={createPageUrl("Contact")}>
            <Button size="lg" className="bg-white text-amber-900 hover:bg-stone-100 px-10 py-6 text-lg shadow-2xl transform hover:scale-110 hover:rotate-2 transition-all duration-300">
              Demander un devis gratuit
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </Link>
        </div>
      </section>

      <style jsx>{`
        .wave-svg {
          will-change: transform;
        }
        .wave-1 {
          animation: waveSlide1 12s linear infinite;
        }
        .wave-2 {
          animation: waveSlide2 8s linear infinite;
        }
        .wave-3 {
          animation: waveSlide3 6s linear infinite;
        }
        @keyframes waveSlide1 {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes waveSlide2 {
          0% { transform: translateX(-50%); }
          100% { transform: translateX(0); }
        }
        @keyframes waveSlide3 {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}




