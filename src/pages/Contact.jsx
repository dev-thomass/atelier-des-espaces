
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, Phone, MapPin, Clock, Send, CheckCircle2, Upload, X, Loader2, MessageSquare, Bot, FileText, Mic, MicOff } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/api/apiClient";
import { sendAssistantMessage } from "@/api/assistantClient";
import { useScrollAnimation } from "@/hooks/use-scroll-animation";
import { useSEO } from "@/hooks/use-seo";
import { createPageUrl } from "@/utils";

const SYSTEM_PROMPT = `Tu es l'assistant projet de [Ton Entreprise], spécialisé en rénovation et aménagement.

## Ton rôle
Qualifier les demandes de devis en posant des questions naturelles et concises.

## Informations à collecter
- Type de travaux
- Localisation (ville)
- Surface ou pièces concernées
- Description du besoin
- Coordonnées (prénom, téléphone) → uniquement à la fin

## Règles
- UNE question à la fois, reste concis
- Quand tu as assez d'infos pour un devis, demande les coordonnées
- Après avoir reçu les coordonnées, fais un récapitulatif

## Format de réponse OBLIGATOIRE (JSON uniquement)
{
  "message": "Ta réponse au client",
  "summary": null,
  "complete": false
}

Quand tu as TOUTES les infos (y compris coordonnées) :
{
  "message": "Merci ! Récapitulatif : ... Un conseiller vous rappelle sous 48h.",
  "summary": {
    "type_travaux": "",
    "localisation": "",
    "surface": "",
    "description": "",
    "prenom": "",
    "telephone": ""
  },
  "complete": true
}

IMPORTANT : Réponds UNIQUEMENT en JSON valide, rien d'autre.`;


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
          : 'space-y-2'
      }`}>
        {isUser ? (
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
        ) : (
          <>
            {/* Message principal */}
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
                          {action.type === 'create' && 'Creation'}
                          {action.type === 'update' && 'Modification'}
                          {action.type === 'delete' && 'Suppression'}
                          {action.type === 'refresh' && 'Actualisation'}
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

            {/* Aucune action */}
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
function AssistantChat({ contactInfo }) {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [summary, setSummary] = useState(null);
  const recognitionRef = useRef(null);

  // SCROLL AUTOMATIQUE SUPPRIME - l'utilisateur peut defiler manuellement

  useEffect(() => {
    setMessages([{
      role: 'assistant',
      content: "Bonjour ! Je suis l'assistant expert de l'Atelier des Espaces.\n\nJe vais vous aider a definir precisement votre projet d'amenagement ou de renovation pour vous proposer les meilleures solutions.\n\nPour commencer, dites-moi quel type d'espace vous souhaitez transformer ?\n(cuisine, salle de bain, salon, chambre, bureau, appartement complet...)",
      noAction: true
    }]);
  }, []);

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
        setInputMessage(prev => prev + (prev ? ' ' : '') + transcript);
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
      alert("La reconnaissance vocale n'est pas supportee par votre navigateur.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setInputMessage(""); // Clear input on start listening for a fresh transcript
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const sendToAssistant = async (userMessage) => {
    try {
      const ctx = {
        agent_name: "assistant_projet",
        page: "contact",
        ...contactInfo,
      };

      const result = await sendAssistantMessage({
        message: userMessage,
        conversationId,
        context: ctx,
        systemPrompt: SYSTEM_PROMPT,
      });

      const nextConversationId = result.conversationId || conversationId;
      if (!conversationId && result.conversationId) {
        setConversationId(result.conversationId);
      }
      if (result.summary) {
        setSummary(result.summary);
        if (nextConversationId) {
          try {
            await api.leads.createPublic({
              source: "assistant",
              conversation_id: nextConversationId,
              name: result.summary?.coordonnees?.nom || contactInfo?.nom || null,
              email: result.summary?.coordonnees?.email || contactInfo?.email || null,
              phone: result.summary?.coordonnees?.telephone || contactInfo?.telephone || null,
              address: result.summary?.adresse || contactInfo?.adresse || null,
              project_type: result.summary?.typeProjet || contactInfo?.typeProjet || result.summary?.typeBien || null,
              description: result.summary?.description || contactInfo?.description || null,
              summary: result.summary,
            });
          } catch (error) {
            console.error("Erreur sauvegarde formulaire assistant:", error);
          }
        }
      }

      return {
        message: result.reply || result.raw || "Reponse indisponible",
        actions: [],
        noAction: true,
      };
    } catch (error) {
      console.error("Erreur assistant local:", error);
      throw error;
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading || isListening) return;

    const userMessage = inputMessage.trim();
    setInputMessage("");
    
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const aiResponse = await sendToAssistant(userMessage);
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
        noAction: true // Indicate no system action was taken due to error
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
    "Renovation de cuisine",
    "Nouvelle salle de bain",
    "Amenagement salon",
    "Renovation complete"
  ];

  return (
    <div className="flex flex-col h-[600px] bg-gradient-to-br from-stone-50 to-white rounded-xl border-2 border-stone-200 shadow-xl overflow-hidden">
      {/* Header - Ameliore */}
      <div className="bg-gradient-to-r from-amber-700 via-amber-800 to-amber-900 text-white p-4 border-b-2 border-amber-900">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
            <Bot className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-lg">Assistant Expert IA</h3>
            <p className="text-xs text-amber-100">Définissez votre projet en discutant</p>
          </div>
          {conversationId && (
            <div className="text-xs text-amber-100 bg-white/10 px-2 py-1 rounded">
              💾 Historique
            </div>
          )}
        </div>
        {isLoading && (
          <div className="mt-2 text-xs text-amber-100 flex items-center gap-2" role="status" aria-live="polite">
            <span className="inline-flex h-2 w-2 rounded-full bg-amber-200 animate-pulse"></span>
            Assistant en train d'ecrire...
          </div>
        )}
      </div>

      {/* Messages */}
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
      </div>

      {/* Résumé projet synthétique */}
      {summary && (
        <div className="px-4 pb-2">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-900">
            <div className="font-semibold mb-2">Résumé du projet</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div><span className="font-medium">Type projet :</span> {summary.typeProjet || "A préciser"}</div>
              <div><span className="font-medium">Adresse :</span> {summary.adresse || "A préciser"}</div>
            </div>
            {summary.description && <div className="mt-2"><span className="font-medium">Description :</span> {summary.description}</div>}
            {summary.pointsOuverts && summary.pointsOuverts.length > 0 && (
              <div className="mt-2">
                <span className="font-medium">Points à préciser :</span>
                <ul className="list-disc list-inside space-y-1">
                  {summary.pointsOuverts.map((p, idx) => <li key={idx}>{p}</li>)}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quick Suggestions */}
      {messages.length === 1 && !isLoading && (
        <div className="px-4 py-2 bg-stone-50 border-t border-stone-200">
          <p className="text-xs text-stone-600 mb-2 font-medium">💡 Suggestions rapides :</p>
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

      {/* Input */}
      <div className="p-4 border-t-2 border-stone-200 bg-white">
        <div className="flex gap-2">
          <Textarea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Décrivez votre projet... 🎤"
            className="resize-none border-2 border-stone-300 focus:border-amber-600"
            rows={2}
            disabled={isLoading || isListening}
          />
          <div className="flex flex-col gap-2">
            <Button
              onClick={toggleVoiceInput}
              disabled={isLoading}
              className={`${
                isListening 
                  ? 'bg-red-600 hover:bg-red-700 animate-pulse' 
                  : 'bg-amber-600 hover:bg-amber-700'
              }`}
              title={isListening ? "Arrêter" : "Parler"}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </Button>
            <Button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isLoading || isListening}
              className="bg-gradient-to-br from-amber-700 to-amber-900 hover:from-amber-800 hover:to-amber-950 shadow-lg"
            >
              <Send className="w-5 h-5" />
            </Button>
          </div>
        </div>
        <p className="text-xs text-stone-500 mt-2">
          💡 Plus vous donnez de détails, plus mes recommandations seront précises
          {conversationId && <span className="ml-2">• Conversation sauvegardée</span>}
        </p>
      </div>
    </div>
  );
}

export default function Contact() {
  const [heroRef, heroVisible] = useScrollAnimation({ threshold: 0.05 });
  const navigate = useNavigate();
  const gridRef = useRef(null);
  const sidebarRef = useRef(null);
  const stickyCardRef = useRef(null);
  
  const [formData, setFormData] = useState({
    nom: "",
    email: "",
    telephone: "",
    adresse: "",
    typeProjet: "",
    description: "",
    photos: []
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);

  const seoKeywords = "contact artisan marseille, devis gratuit rénovation marseille, devis aménagement intérieur marseille, artisan rapide marseille, devis travaux marseille, contact rénovation marseille, demande devis marseille, artisan disponible marseille, devis cuisine marseille, devis salle de bain marseille";

  useSEO({
    title: "Contact & Devis Gratuit - Artisan Rénovation Marseille | L'Atelier des Espaces",
    description: "Contactez votre artisan multiservice pour un devis gratuit de rénovation et aménagement intérieur. Intervention rapide à Marseille, Aix-en-Provence, Aubagne, Allauch, La Ciotat. Disponible 7j/7j.",
    keywords: seoKeywords
  });

  useEffect(() => {
    const grid = gridRef.current;
    const sidebar = sidebarRef.current;
    const card = stickyCardRef.current;
    if (!grid || !sidebar || !card) return;

    let frame = null;

    const resetStyles = () => {
      card.style.position = "";
      card.style.top = "";
      card.style.bottom = "";
      card.style.left = "";
      card.style.width = "";
      card.style.zIndex = "";
      sidebar.style.minHeight = "";
    };

    const updatePosition = () => {
      const isDesktop = window.matchMedia("(min-width: 1024px)").matches;
      if (!isDesktop) {
        resetStyles();
        return;
      }

      const scrollY = window.scrollY;
      const header = document.querySelector("nav");
      const headerOffset = header ? Math.round(header.getBoundingClientRect().height + 16) : 96;
      const gridRect = grid.getBoundingClientRect();
      const gridTop = gridRect.top + scrollY;
      const gridBottom = gridTop + grid.offsetHeight;
      const sidebarRect = sidebar.getBoundingClientRect();
      const cardHeight = card.offsetHeight;
      const maxScroll = gridBottom - cardHeight - headerOffset;

      sidebar.style.minHeight = `${cardHeight}px`;

      if (scrollY < gridTop - headerOffset) {
        resetStyles();
        return;
      }

      if (scrollY >= maxScroll) {
        card.style.position = "absolute";
        card.style.top = "auto";
        card.style.bottom = "0px";
        card.style.left = "0px";
        card.style.width = "100%";
        return;
      }

      card.style.position = "fixed";
      card.style.top = `${headerOffset}px`;
      card.style.left = `${sidebarRect.left}px`;
      card.style.width = `${sidebarRect.width}px`;
      card.style.bottom = "auto";
      card.style.zIndex = "40";
    };

    const onScroll = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(updatePosition);
    };

    updatePosition();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      resetStyles();
    };
  }, []);

  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploadingPhotos(true);
    setError(null);

    try {
      const uploadPromises = files.map(file => 
        api.integrations.Core.UploadFile({ file })
      );
      
      const results = await Promise.all(uploadPromises);
      const photoUrls = results.map(result => result.file_url);
      
      setFormData({
        ...formData,
        photos: [...formData.photos, ...photoUrls]
      });
    } catch (err) {
      console.error("Error uploading photos:", err);
      setError("Erreur lors de l'upload des photos. Veuillez réessayer.");
    } finally {
      e.target.value = null; // Reset input field to allow re-uploading same file
      setUploadingPhotos(false);
    }
  };

  const removePhoto = (index) => {
    const newPhotos = formData.photos.filter((_, i) => i !== index);
    setFormData({ ...formData, photos: newPhotos });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    
    try {
      try {
        await api.leads.createPublic({
          source: "form",
          nom: formData.nom,
          email: formData.email,
          telephone: formData.telephone,
          adresse: formData.adresse,
          typeProjet: formData.typeProjet,
          description: formData.description,
          photos: formData.photos,
        });
      } catch (leadError) {
        console.error("Erreur sauvegarde formulaire:", leadError);
      }

      const photosSection = formData.photos.length > 0 
        ? `<h3>Photos jointes (${formData.photos.length}) :</h3>
           ${formData.photos.map((url, index) => `<p><a href="${url}">Photo ${index + 1}</a></p>`).join('')}`
        : '';

      await api.integrations.Core.SendEmail({
        to: "thomasromeo.bonnardel@gmail.com",
        subject: `Demande détaillée - ${formData.typeProjet} - ${formData.nom}`,
        body: `
          <h2>Nouvelle demande de devis - ${formData.typeProjet}</h2>
          
          <h3>Informations de contact :</h3>
          <p><strong>Nom :</strong> ${formData.nom}</p>
          <p><strong>Email :</strong> ${formData.email}</p>
          <p><strong>Téléphone :</strong> ${formData.telephone}</p>
          <p><strong>Adresse du projet :</strong> ${formData.adresse}</p>
          
          <hr>
          
          <h3>Détails du projet :</h3>
          <p><strong>Type de projet :</strong> ${formData.typeProjet}</p>
          
          <hr>
          
          <h3>Description du projet :</h3>
          <p>${formData.description.replace(/\n/g, '<br>')}</p>
          
          <hr>
          
          ${photosSection}
        `,
        replyTo: formData.email || undefined
      });
      
      const confirmationPayload = {
        nom: formData.nom,
        typeProjet: formData.typeProjet
      };

      setFormData({
        nom: "",
        email: "",
        telephone: "",
        adresse: "",
        typeProjet: "",
        description: "",
        photos: []
      });
      navigate(createPageUrl("Confirmation"), { state: confirmationPayload });
    } catch (err) {
      console.error("Failed to send email:", err);
      setError("Une erreur s'est produite lors de l'envoi du message. Veuillez réessayer.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
  };

  const infos = [
    { icon: Mail, label: "Email", value: "thomasromeo.bonnardel@gmail.com" },
    { icon: Phone, label: "Téléphone", value: "06 95 07 10 84" },
    { icon: MapPin, label: "Zone", value: "Bouches-du-Rhône" },
    { icon: Clock, label: "Disponibilité", value: "7j/7j" }
  ];

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Hero Section - UNIFORMISÉ ET AFFINÉ */}
      <section ref={heroRef} className="relative min-h-[60vh] -mt-12 md:-mt-16 flex items-center justify-center overflow-hidden bg-gradient-to-br from-stone-950 via-stone-900 to-amber-900 pt-16 md:pt-20 pb-24 md:pb-28">
        <div className="absolute -top-24 left-0 right-0 h-[140%] bg-gradient-to-b from-stone-950 via-stone-900/80 to-stone-900/0 pointer-events-none" />
        {/* Grille subtile */}
        <div className="absolute inset-0 opacity-[0.03]">
          <div className="absolute inset-0" style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
                             linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)`,
            backgroundSize: '50px 50px'
          }}></div>
        </div>

        <div className="absolute bottom-0 left-0 w-[360px] h-[360px] bg-amber-500/12 rounded-full blur-[90px] animate-pulse" style={{ animationDelay: '0.8s' }}></div>
        {/* Effets lumineux - Plus subtils */}
        <div className="absolute top-1/4 right-1/4 w-80 h-80 bg-amber-600/15 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-1/4 left-1/4 w-64 h-64 bg-amber-500/10 rounded-full blur-[80px]"></div>

        <div className={`relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center transition-all duration-1000 ${
          heroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
        }`}>
          {/* Badge */}
          <Badge className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/20 text-amber-100 border border-amber-200/30 rounded-full mb-6">
            <MessageSquare className="w-4 h-4 text-amber-300" />
            <span className="text-sm font-medium text-white">Contact</span>
          </Badge>

          {/* Titre */}
          <h1 className="text-4xl md:text-6xl font-bold mb-5 text-white">
            <span className="block text-white">Parlons de Votre</span>
            <span className="block bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 bg-clip-text text-transparent">
              Projet
            </span>
          </h1>

          {/* Sous-titre */}
          <p className="text-base md:text-lg text-stone-300 max-w-3xl mx-auto leading-relaxed">
            Devis gratuit et sans engagement pour tous vos projets<br />
            de rénovation et d'aménagement intérieur
          </p>

          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {[
              "Devis gratuit",
              "Reponse rapide",
              "7j/7j",
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
              <path d="M0,40 C240,100 480,0 720,40 C960,80 1200,20 1440,60 C1680,100 1920,0 2160,40 C2400,80 2640,20 2880,60 L2880,120 L0,120 Z" fill="rgba(250,250,249,0.25)" />
            </svg>
            <svg className="wave-svg wave-2 absolute bottom-0 left-0 w-[200%] h-full" viewBox="0 0 1440 120" preserveAspectRatio="none">
              <path d="M0,60 C180,20 360,80 540,50 C720,20 900,90 1080,60 C1260,30 1440,80 1620,50 C1800,20 1980,90 2160,60 C2340,30 2520,80 2700,50 L2880,120 L0,120 Z" fill="rgba(250,250,249,0.5)" />
            </svg>
            <svg className="wave-svg wave-3 absolute bottom-0 left-0 w-[200%] h-full" viewBox="0 0 1440 120" preserveAspectRatio="none">
              <path d="M0,80 C120,100 240,60 360,80 C480,100 600,60 720,80 C840,100 960,60 1080,80 C1200,100 1320,60 1440,80 C1560,100 1680,60 1800,80 C1920,100 2040,60 2160,80 C2280,100 2400,60 2520,80 C2640,100 2760,60 2880,80 L2880,120 L0,120 Z" fill="#fafaf9" />
            </svg>
          </div>
        </div>
      </section>

      {/* Contact Section avec Tabs */}
      <section className="py-16 md:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div ref={gridRef} className="grid lg:grid-cols-5 gap-8 md:gap-12">
            {/* Contact Info Sidebar - SIDEBAR TRANSLUCIDE */}
            <div ref={sidebarRef} className="lg:col-span-2 space-y-6 relative">
              <Card
                ref={stickyCardRef}
                className="border-none shadow-2xl bg-gradient-to-br from-amber-900/95 to-amber-800/95 backdrop-blur-sm text-white rounded-2xl"
              >
                <CardContent className="p-6 md:p-8">
                  <h3 className="text-xl md:text-2xl font-bold mb-5">Contact</h3>
                  <div className="space-y-3">
                    {infos.map((info, index) => (
                      <div key={index} className="flex items-start gap-2">
                        <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center flex-shrink-0">
                          <info.icon className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-semibold text-amber-100 text-sm mb-0.5">{info.label}</div>
                          <div className="text-sm break-words">{info.value}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 pt-4 border-t border-white/20">
                    <ul className="space-y-2 text-sm">
                      {[
                        "Devis gratuit",
                        "Réponse rapide",
                        "Visite sur place",
                        "Conseil personnalisé"
                      ].map((item, index) => (
                        <li key={index} className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Main Content with Tabs - ORDRE INVERSÉ */}
            <div className="lg:col-span-3">
              <Tabs defaultValue="form" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="form" className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    <span>Formulaire détaillé</span>
                  </TabsTrigger>
                  <TabsTrigger value="assistant" className="flex items-center gap-2">
                    <Bot className="w-4 h-4" />
                    <span>Assistant IA</span>
                  </TabsTrigger>
                </TabsList>

                {/* Tab Formulaire détaillé - MAINTENANT EN PREMIER */}
                <TabsContent value="form">
                  <Card className="border-none shadow-xl">
                    <CardHeader className="border-b border-stone-100">
                      <CardTitle className="text-2xl md:text-3xl font-bold text-stone-800">
                        Demander un devis gratuit
                      </CardTitle>
                      <p className="text-sm text-stone-600 mt-2">
                        Remplissez ce formulaire détaillé pour une estimation précise
                      </p>
                    </CardHeader>
                    <CardContent className="p-6 md:p-8">
                      {error && (
                        <Alert className="mb-6 bg-red-50 border-red-500">
                          <AlertDescription className="text-red-800">
                            {error}
                          </AlertDescription>
                        </Alert>
                      )}

                      <form onSubmit={handleSubmit} className="space-y-8">
                        <div>
                          <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 bg-amber-700 text-white rounded-full flex items-center justify-center font-bold text-lg flex-shrink-0">
                              1
                            </div>
                            <h3 className="text-xl font-bold text-stone-800">Vos coordonnées</h3>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-0 md:pl-13">
                            <div>
                              <Label htmlFor="nom" className="text-stone-700 font-medium mb-2 block">
                                Nom complet *
                              </Label>
                              <Input
                                id="nom"
                                value={formData.nom}
                                onChange={(e) => handleChange("nom", e.target.value)}
                                required
                                placeholder="Votre nom"
                                className="h-11"
                              />
                            </div>
                            <div>
                              <Label htmlFor="telephone" className="text-stone-700 font-medium mb-2 block">
                                Téléphone *
                              </Label>
                              <Input
                                id="telephone"
                                type="tel"
                                value={formData.telephone}
                                onChange={(e) => handleChange("telephone", e.target.value)}
                                required
                                placeholder="06 XX XX XX XX"
                                className="h-11"
                              />
                            </div>
                            <div>
                              <Label htmlFor="email" className="text-stone-700 font-medium mb-2 block">
                                Email *
                              </Label>
                              <Input
                                id="email"
                                type="email"
                                value={formData.email}
                                onChange={(e) => handleChange("email", e.target.value)}
                                required
                                placeholder="votre@email.fr"
                                className="h-11"
                              />
                            </div>
                            <div>
                              <Label htmlFor="adresse" className="text-stone-700 font-medium mb-2 block">
                                Adresse du projet *
                              </Label>
                              <Input
                                id="adresse"
                                value={formData.adresse}
                                onChange={(e) => handleChange("adresse", e.target.value)}
                                required
                                placeholder="Ville et code postal"
                                className="h-11"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="border-t border-stone-200"></div>

                        <div>
                          <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 bg-amber-700 text-white rounded-full flex items-center justify-center font-bold text-lg flex-shrink-0">
                              2
                            </div>
                            <h3 className="text-xl font-bold text-stone-800">Détails du projet</h3>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-0 md:pl-13">
                            <div>
                              <Label className="text-stone-700 font-medium mb-2 block">
                                Type de projet *
                              </Label>
                              <Select value={formData.typeProjet} onValueChange={(value) => handleChange("typeProjet", value)} required>
                                <SelectTrigger className="h-11">
                                  <SelectValue placeholder="Sélectionnez" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Rénovation cuisine">Rénovation cuisine</SelectItem>
                                  <SelectItem value="Rénovation salle de bain">Rénovation salle de bain</SelectItem>
                                  <SelectItem value="Rénovation complète">Rénovation complète</SelectItem>
                                  <SelectItem value="Aménagement intérieur">Aménagement intérieur</SelectItem>
                                  <SelectItem value="Peinture & Décoration">Peinture & Décoration</SelectItem>
                                  <SelectItem value="Parquet & Revêtements">Parquet & Revêtements</SelectItem>
                                  <SelectItem value="Plâtrerie & Cloisons">Plâtrerie & Cloisons</SelectItem>
                                  <SelectItem value="Menuiserie sur mesure">Menuiserie sur mesure</SelectItem>
                                  <SelectItem value="Autre">Autre</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>

                        <div className="border-t border-stone-200"></div>

                        <div>
                          <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 bg-amber-700 text-white rounded-full flex items-center justify-center font-bold text-lg flex-shrink-0">
                              3
                            </div>
                            <h3 className="text-xl font-bold text-stone-800">Description détaillée</h3>
                          </div>
                          <div className="space-y-4 pl-0 md:pl-13">
                            <div>
                              <Label htmlFor="description" className="text-stone-700 font-medium mb-2 block">
                                Décrivez votre projet *
                              </Label>
                              <Textarea
                                id="description"
                                value={formData.description}
                                onChange={(e) => handleChange("description", e.target.value)}
                                required
                                rows={5}
                                className="resize-none"
                                placeholder="Décrivez vos travaux envisagés, vos attentes, contraintes particulières..."
                              />
                            </div>
                          </div>
                        </div>

                        <div className="border-t border-stone-200"></div>

                        <div>
                          <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 bg-amber-700 text-white rounded-full flex items-center justify-center font-bold text-lg flex-shrink-0">
                              4
                            </div>
                            <h3 className="text-xl font-bold text-stone-800">Photos (optionnel)</h3>
                          </div>
                          <div className="pl-0 md:pl-13">
                            <Label className="text-stone-700 font-medium mb-3 block">
                              Ajoutez des photos pour une estimation plus précise
                            </Label>
                            
                            {formData.photos.length > 0 && (
                              <div className="grid grid-cols-3 md:grid-cols-4 gap-3 mb-4">
                                {formData.photos.map((photo, index) => (
                                  <div key={index} className="relative group">
                                    <img src={photo} alt={`Photo ${index + 1}`} className="w-full h-24 object-cover rounded-lg border-2 border-stone-200" />
                                    <button
                                      type="button"
                                      onClick={() => removePhoto(index)}
                                      className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}

                            <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-stone-300 rounded-xl cursor-pointer hover:border-amber-700 hover:bg-amber-50 transition-all duration-300">
                              <div className="flex flex-col items-center justify-center">
                                {uploadingPhotos ? (
                                  <>
                                    <Loader2 className="w-10 h-10 text-amber-700 animate-spin mb-3" />
                                    <p className="text-sm text-stone-600 font-medium">Upload en cours...</p>
                                  </>
                                ) : (
                                  <>
                                    <Upload className="w-10 h-10 text-stone-400 mb-3" />
                                    <p className="text-base text-stone-700 font-medium mb-1">
                                      Cliquez pour ajouter des photos
                                    </p>
                                    <p className="text-xs text-stone-500">
                                      JPG, PNG (max 5 Mo par photo)
                                    </p>
                                  </>
                                )}
                              </div>
                              <input
                                type="file"
                                className="hidden"
                                accept="image/*"
                                multiple
                                onChange={handlePhotoUpload}
                                disabled={uploadingPhotos || isSubmitting}
                              />
                            </label>
                          </div>
                        </div>

                        <div className="border-t border-stone-200 pt-6">
                          <Button
                            type="submit"
                            className="w-full bg-amber-700 hover:bg-amber-800 text-white py-6 text-lg font-semibold shadow-xl transform hover:scale-[1.02] transition-all duration-300"
                            disabled={isSubmitting || uploadingPhotos}
                          >
                            {isSubmitting ? (
                              <>
                                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                Envoi en cours...
                              </>
                            ) : (
                              <>
                                <Send className="w-5 h-5 mr-2" />
                                Envoyer ma demande de devis
                              </>
                            )}
                          </Button>

                          <p className="text-xs text-center text-stone-500 mt-4">
                            ⚿ Vos informations sont confidentielles et ne seront jamais partagées
                          </p>
                        </div>
                      </form>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Tab Assistant IA - MAINTENANT EN SECOND */}
                <TabsContent value="assistant">
                  <Card className="border-none shadow-xl">
                    <CardHeader className="border-b border-stone-100">
                      <CardTitle className="text-2xl md:text-3xl font-bold text-stone-800 flex items-center gap-3">
                        <Bot className="w-8 h-8 text-amber-700" />
                        Discutez avec notre Assistant IA
                      </CardTitle>
                      <p className="text-sm text-stone-600 mt-2">
                        Laissez-vous guider pour définir votre projet en quelques questions
                      </p>
                    </CardHeader>
                    <CardContent className="p-6 md:p-8">
                      <AssistantChat contactInfo={{
                        nom: formData.nom,
                        email: formData.email,
                        telephone: formData.telephone,
                        adresse: formData.adresse,
                        typeProjet: formData.typeProjet,
                        description: formData.description,
                      }} />
                      
                      <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                        <p className="text-sm text-amber-900">
                          <strong>◉ Astuce :</strong> L'assistant vous aidera à clarifier vos besoins. 
                          Pour un devis précis, vous pourrez ensuite remplir le formulaire détaillé.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </section>

      <style>{`
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

