
import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, Phone, MapPin, Clock, Send, CheckCircle2, Upload, X, Loader2, MessageSquare, Bot, FileText, Mic, MicOff } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { sendAssistantMessage } from "@/api/assistantClient";

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

// Hook d'animation au scroll
const useScrollAnimation = (options = {}) => {
  const elementRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (options.once !== false) {
            observer.unobserve(element);
          }
        }
      },
      {
        threshold: options.threshold || 0.05,
        rootMargin: options.rootMargin || '50px'
      }
    );

    observer.observe(element);

    return () => {
      if (element) {
        observer.unobserve(element);
      }
    };
  }, [options.threshold, options.rootMargin, options.once]);

  return [elementRef, isVisible];
};

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
        page: "contact",
        ...contactInfo,
      };

      const result = await sendAssistantMessage({
        message: userMessage,
        conversationId,
        context: ctx,
        systemPrompt: SYSTEM_PROMPT,
      });

      if (!conversationId && result.conversationId) {
        setConversationId(result.conversationId);
      }
      if (result.summary) {
        setSummary(result.summary);
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
              <div><span className="font-medium">Type bien :</span> {summary.typeBien || "A préciser"}</div>
              <div><span className="font-medium">Surface :</span> {summary.surface || "A préciser"}</div>
              <div><span className="font-medium">Budget :</span> {summary.budget || "A préciser"}</div>
              <div><span className="font-medium">Délai :</span> {summary.delai || "A préciser"}</div>
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
  
  const [formData, setFormData] = useState({
    nom: "",
    email: "",
    telephone: "",
    adresse: "",
    typeProjet: "",
    typeBien: "",
    surface: "",
    nombrePieces: "",
    budget: "",
    delai: "",
    description: "",
    photos: [],
    disponibilite: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState(null);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);

  // SEO Meta Tags
  useEffect(() => {
    document.title = "Contact & Devis Gratuit - Artisan Rénovation Marseille | L'Atelier des Espaces";
    
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute("content", "Contactez votre artisan multiservice pour un devis gratuit de rénovation et aménagement intérieur. Intervention rapide à Marseille, Aix-en-Provence, Aubagne, Allauch, La Ciotat. Disponible 7j/7j.");
    } else {
      const meta = document.createElement('meta');
      meta.name = "description";
      meta.content = "Contactez votre artisan multiservice pour un devis gratuit de rénovation et aménagement intérieur. Intervention rapide à Marseille, Aix-en-Provence, Aubagne, Allauch, La Ciotat. Disponible 7j/7j.";
      document.head.appendChild(meta);
    }

    const metaKeywords = document.querySelector('meta[name="keywords"]');
    const keywords = "contact artisan marseille, devis gratuit rénovation marseille, devis aménagement intérieur marseille, artisan rapide marseille, devis travaux marseille, contact rénovation marseille, demande devis marseille, artisan disponible marseille, devis cuisine marseille, devis salle de bain marseille";
    if (metaKeywords) {
      metaKeywords.setAttribute("content", keywords);
    } else {
      const meta = document.createElement('meta');
      meta.name = "keywords";
      meta.content = keywords;
      document.head.appendChild(meta);
    }
  }, []);

  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploadingPhotos(true);
    setError(null);

    try {
      const uploadPromises = files.map(file => 
        base44.integrations.Core.UploadFile({ file })
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
      const photosSection = formData.photos.length > 0 
        ? `<h3>Photos jointes (${formData.photos.length}) :</h3>
           ${formData.photos.map((url, index) => `<p><a href="${url}">Photo ${index + 1}</a></p>`).join('')}`
        : '';

      await base44.integrations.Core.SendEmail({
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
          <p><strong>Type de bien :</strong> ${formData.typeBien}</p>
          <p><strong>Surface approximative :</strong> ${formData.surface}</p>
          <p><strong>Nombre de pièces concernées :</strong> ${formData.nombrePieces}</p>
          <p><strong>Budget approximatif :</strong> ${formData.budget}</p>
          <p><strong>Délai souhaité :</strong> ${formData.delai}</p>
          
          <hr>
          
          <h3>Description du projet :</h3>
          <p>${formData.description.replace(/\n/g, '<br>')}</p>
          
          <hr>
          
          <h3>Disponibilité pour visite :</h3>
          <p>${formData.disponibilite.replace(/\n/g, '<br>')}</p>
          
          <hr>
          
          ${photosSection}
        `
      });
      
      setIsSuccess(true);
      setFormData({
        nom: "",
        email: "",
        telephone: "",
        adresse: "",
        typeProjet: "",
        typeBien: "",
        surface: "",
        nombrePieces: "",
        budget: "",
        delai: "",
        description: "",
        photos: [],
        disponibilite: ""
      });

      setTimeout(() => setIsSuccess(false), 5000);
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
      <section ref={heroRef} className="relative min-h-[60vh] -mt-12 md:-mt-16 flex items-center justify-center overflow-hidden bg-gradient-to-br from-stone-950 via-stone-900 to-amber-900 pt-16 md:pt-20">
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
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-full mb-6">
            <MessageSquare className="w-4 h-4 text-amber-300" />
            <span className="text-sm font-medium text-white">Contact</span>
          </div>

          {/* Titre */}
          <h1 className="text-4xl md:text-6xl font-bold mb-5 text-white">
            Parlons de Votre Projet
          </h1>

          {/* Sous-titre */}
          <p className="text-base md:text-lg text-stone-300 max-w-3xl mx-auto leading-relaxed">
            Devis gratuit et sans engagement pour tous vos projets<br />
            de rénovation et d'aménagement intérieur
          </p>
        </div>
      </section>

      {/* Contact Section avec Tabs */}
      <section className="py-16 md:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-4 gap-8 md:gap-12">
            {/* Contact Info Sidebar - SIDEBAR TRANSLUCIDE */}
            <div className="lg:col-span-1 space-y-6">
              <Card className="border-none shadow-xl bg-gradient-to-br from-amber-900/95 to-amber-800/95 backdrop-blur-sm text-white sticky top-24">
                <CardContent className="p-4 md:p-6">
                  <h3 className="text-lg md:text-xl font-bold mb-4">Contact</h3>
                  <div className="space-y-3">
                    {infos.map((info, index) => (
                      <div key={index} className="flex items-start gap-2">
                        <div className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center flex-shrink-0">
                          <info.icon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-semibold text-amber-100 text-xs mb-0.5">{info.label}</div>
                          <div className="text-xs break-words">{info.value}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 pt-4 border-t border-white/20">
                    <ul className="space-y-1.5 text-xs">
                      {[
                        "Devis gratuit",
                        "Réponse rapide",
                        "Visite sur place",
                        "Conseil personnalisé"
                      ].map((item, index) => (
                        <li key={index} className="flex items-center gap-2">
                          <CheckCircle2 className="w-3 h-3 flex-shrink-0" />
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
                      {isSuccess && (
                        <Alert className="mb-6 bg-green-50 border-green-500">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          <AlertDescription className="text-green-800">
                            Votre message a été envoyé ! Je vous répondrai rapidement.
                          </AlertDescription>
                        </Alert>
                      )}

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
                            <div>
                              <Label className="text-stone-700 font-medium mb-2 block">
                                Type de bien *
                              </Label>
                              <Select value={formData.typeBien} onValueChange={(value) => handleChange("typeBien", value)} required>
                                <SelectTrigger className="h-11">
                                  <SelectValue placeholder="Sélectionnez" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Appartement">Appartement</SelectItem>
                                  <SelectItem value="Maison">Maison</SelectItem>
                                  <SelectItem value="Local commercial">Local commercial</SelectItem>
                                  <SelectItem value="Bureau">Bureau</SelectItem>
                                  <SelectItem value="Autre">Autre</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label htmlFor="surface" className="text-stone-700 font-medium mb-2 block">
                                Surface approximative *
                              </Label>
                              <Input
                                id="surface"
                                value={formData.surface}
                                onChange={(e) => handleChange("surface", e.target.value)}
                                required
                                placeholder="Ex: 60 m²"
                                className="h-11"
                              />
                            </div>
                            <div>
                              <Label htmlFor="nombrePieces" className="text-stone-700 font-medium mb-2 block">
                                Nombre de pièces *
                              </Label>
                              <Input
                                id="nombrePieces"
                                value={formData.nombrePieces}
                                onChange={(e) => handleChange("nombrePieces", e.target.value)}
                                required
                                placeholder="Ex: 3 pièces"
                                className="h-11"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="border-t border-stone-200"></div>

                        <div>
                          <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 bg-amber-700 text-white rounded-full flex items-center justify-center font-bold text-lg flex-shrink-0">
                              3
                            </div>
                            <h3 className="text-xl font-bold text-stone-800">Budget et délai</h3>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-0 md:pl-13">
                            <div>
                              <Label className="text-stone-700 font-medium mb-2 block">
                                Budget approximatif
                              </Label>
                              <Select value={formData.budget} onValueChange={(value) => handleChange("budget", value)}>
                                <SelectTrigger className="h-11">
                                  <SelectValue placeholder="Sélectionnez" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Moins de 1 000€">Moins de 1 000€</SelectItem>
                                  <SelectItem value="1 000€ - 5 000€">1 000€ - 5 000€</SelectItem>
                                  <SelectItem value="5 000€ - 10 000€">5 000€ - 10 000€</SelectItem>
                                  <SelectItem value="10 000€ - 20 000€">10 000€ - 20 000€</SelectItem>
                                  <SelectItem value="20 000€ - 50 000€">20 000€ - 50 000€</SelectItem>
                                  <SelectItem value="Plus de 50 000€">Plus de 50 000€</SelectItem>
                                  <SelectItem value="À définir">À définir</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-stone-700 font-medium mb-2 block">
                                Délai souhaité
                              </Label>
                              <Select value={formData.delai} onValueChange={(value) => handleChange("delai", value)}>
                                <SelectTrigger className="h-11">
                                  <SelectValue placeholder="Sélectionnez" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Urgent (moins de 1 mois)">Urgent (moins de 1 mois)</SelectItem>
                                  <SelectItem value="1 à 3 mois">1 à 3 mois</SelectItem>
                                  <SelectItem value="3 à 6 mois">3 à 6 mois</SelectItem>
                                  <SelectItem value="Plus de 6 mois">Plus de 6 mois</SelectItem>
                                  <SelectItem value="Flexible">Flexible</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>

                        <div className="border-t border-stone-200"></div>

                        <div>
                          <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 bg-amber-700 text-white rounded-full flex items-center justify-center font-bold text-lg flex-shrink-0">
                              4
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
                            <div>
                              <Label htmlFor="disponibilite" className="text-stone-700 font-medium mb-2 block">
                                Vos disponibilités pour une visite
                              </Label>
                              <Textarea
                                id="disponibilite"
                                value={formData.disponibilite}
                                onChange={(e) => handleChange("disponibilite", e.target.value)}
                                rows={3}
                                className="resize-none"
                                placeholder="Ex: Disponible en semaine après 18h, ou le samedi matin"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="border-t border-stone-200"></div>

                        <div>
                          <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 bg-amber-700 text-white rounded-full flex items-center justify-center font-bold text-lg flex-shrink-0">
                              5
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
                        typeBien: formData.typeBien,
                        surface: formData.surface,
                        budget: formData.budget,
                        delai: formData.delai,
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
    </div>
  );
}
