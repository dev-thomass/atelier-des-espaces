
import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  Upload,
  X,
  Loader2,
  Bot,
  Mail,
  Phone,
  MapPin,
  MessageSquare,
  Mic, // Added Mic icon for voice input
  MicOff // Added MicOff icon for voice input
} from "lucide-react";
import { base44 } from "@/api/base44Client";

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

// Composant de Message - AMÉLIORÉ AVEC DÉTAILS N8N
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

            {/* Actions effectuées */}
            {message.actions && message.actions.length > 0 && (
              <div className="bg-green-50 border-2 border-green-200 rounded-lg p-3 text-xs">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <span className="font-semibold text-green-900">Actions effectuées :</span>
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
                          {action.type === 'create' && '✨ Création'}
                          {action.type === 'update' && '✏️ Modification'}
                          {action.type === 'delete' && '🗑️ Suppression'}
                          {action.type === 'refresh' && '🔄 Actualisation'}
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
            {message.noAction && (
              <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-3 text-xs">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-blue-600" />
                  <span className="text-blue-800">Aucune action système effectuée - Réponse conversationnelle</span>
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

  // SCROLL AUTOMATIQUE SUPPRIMÉ - l'utilisateur peut défiler manuellement

  useEffect(() => {
    setMessages([{
      role: 'assistant',
      content: "Bonjour ! 👋 Je suis l'assistant expert de l'Atelier des Espaces.\n\nJe vais vous aider à définir votre besoin en scan 3D et plans détaillés.\n\nPour commencer, dites-moi quel type d'espace vous souhaitez scanner ?\n(appartement, maison, local commercial, bureau...)",
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
      alert("La reconnaissance vocale n'est pas supportée par votre navigateur.");
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

      console.log("📤 Envoi direct à l'agent maître:", payload);

      // Appel DIRECT à l'agent maître (plus de passage par n8n)
      const response = await base44.functions.invoke('invokeAgent', payload);
      
      const result = response.data;
      console.log("📥 Réponse de l'agent maître:", result);

      if (result.conversationId && !conversationId) {
        setConversationId(result.conversationId);
        console.log("💾 Conversation ID sauvegardé:", result.conversationId);
      }

      // Extraire le message et les actions
      const message = result.message || result.output || "Message reçu";
      const actions = result.actions || [];

      // Vérifier si des actions ont été effectuées
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
        content: "Désolé, une erreur s'est produite. Veuillez réessayer ou utiliser le formulaire de contact.",
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
            <p className="text-xs text-amber-100">Définissez votre projet de scan 3D</p>
          </div>
          {conversationId && (
            <div className="text-xs text-amber-100 bg-white/10 px-2 py-1 rounded">
              💾 Historique
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

      <div className="p-4 border-t-2 border-stone-200 bg-white">
        <div className="flex gap-2">
          <Textarea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Décrivez votre projet... 🎤"
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
              title={isListening ? "Arrêter la saisie vocale" : "Démarrer la saisie vocale"}
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
          💡 Plus vous donnez de détails, plus mes recommandations seront précises
          {conversationId && <span className="ml-2">• Conversation sauvegardée</span>}
        </p>
      </div>
    </div>
  );
}

export default function Conception3D() {
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
    document.title = "Conception & Modélisation 3D - Plans Détaillés Marseille | L'Atelier des Espaces";

    let metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute("content", "Services de conception 3D, scan 3D professionnel et plans détaillés pour vos projets de rénovation et aménagement à Marseille, Aix-en-Provence, Aubagne. Visualisez votre projet avant travaux.");
    } else {
      metaDescription = document.createElement('meta');
      metaDescription.name = "description";
      metaDescription.content = "Services de conception 3D, scan 3D professionnel et plans détaillés pour vos projets de rénovation et aménagement à Marseille, Aix-en-Provence, Aubagne. Visualisez votre projet avant travaux.";
      document.head.appendChild(metaDescription);
    }

    let metaKeywords = document.querySelector('meta[name="keywords"]');
    const keywords = "conception 3D marseille, scan 3D marseille, plans 3D marseille, modélisation 3D marseille, relevé 3D marseille, plans détaillés marseille, architecte intérieur marseille, design intérieur 3D marseille, visualisation 3D marseille, plans rénovation marseille, mesures précises marseille";
    if (metaKeywords) {
      metaKeywords.setAttribute("content", keywords);
    } else {
      metaKeywords = document.createElement('meta');
      metaKeywords.name = "keywords";
      metaKeywords.content = keywords;
      document.head.appendChild(metaKeywords);
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

      setFormData(prevData => ({
        ...prevData,
        photos: [...prevData.photos, ...photoUrls]
      }));
    } catch (err) {
      console.error("Error uploading photos:", err);
      setError("Erreur lors de l'upload des photos. Veuillez réessayer.");
    } finally {
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
    setIsSuccess(false);

    try {
      // Construire le corps de l'email
      const photosSection = formData.photos.length > 0
        ? `<h3>Photos jointes (${formData.photos.length}) :</h3>
           ${formData.photos.map((url, index) => `<p><a href="${url}">${url.split('/').pop()}</a></p>`).join('')}`
        : '';

      await base44.integrations.Core.SendEmail({
        to: "thomasromeo.bonnardel@gmail.com",
        subject: `Demande Scan 3D - ${formData.typeProjet} - ${formData.nom}`,
        body: `
          <h2>Nouvelle demande de Scan 3D - ${formData.typeProjet}</h2>

          <h3>Informations de contact :</h3>
          <p><strong>Nom :</strong> ${formData.nom}</p>
          <p><strong>Email :</strong> ${formData.email}</p>
          <p><strong>Téléphone :</strong> ${formData.telephone}</p>
          <p><strong>Adresse du projet :</strong> ${formData.adresse}</p>

          <hr>

          <h3>Détails du projet :</h3>
          <p><strong>Type de prestation :</strong> ${formData.typeProjet}</p>
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
      console.error("Error sending email:", err);
      setError("Une erreur s'est produite lors de l'envoi de votre demande. Veuillez réessayer.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
  };

  const avantages = [
    {
      icon: Target,
      titre: "Précision absolue",
      description: "Plans détaillés au millimètre près avec relevé 3D professionnel"
    },
    {
      icon: Sparkles,
      titre: "Visualisation réaliste",
      description: "Voyez votre projet en 3D avant le début des travaux"
    },
    {
      icon: Clock,
      titre: "Gain de temps",
      description: "Moins d'imprévus grâce à une planification optimale"
    },
    {
      icon: FileText,
      titre: "Documentation complète",
      description: "Plans, mesures, surfaces et volumes calculés automatiquement"
    }
  ];

  const visualisations3D = [
    {
      url: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6901ebfc5e146f4dd7ae429a/5b10319e2_plan3D.png",
      titre: "Plan 3D",
      description: "Modélisation complète de votre espace"
    },
    {
      url: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6901ebfc5e146f4dd7ae429a/c02f03180_Scan3D.jpg",
      titre: "Scan 3D",
      description: "Vue réaliste de l'espace existing"
    }
  ];

  const planImages = [
    {
      url: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6901ebfc5e146f4dd7ae429a/cc20e1196_Plandetaill1.jpg",
      titre: "Vue d'ensemble"
    },
    {
      url: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6901ebfc5e146f4dd7ae429a/536ebddd1_Plandetaill2.jpg",
      titre: "Plan détaillé"
    },
    {
      url: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6901ebfc5e146f4dd7ae429a/fd02cd6b1_Plandetaill3.jpg",
      titre: "Mesures précises"
    },
    {
      url: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6901ebfc5e146f4dd7ae429a/3f9d221aa_Plandetaill4.jpg",
      titre: "Plans par pièce"
    },
    {
      url: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6901ebfc5e146f4dd7ae429a/e16b4360b_Plandetaill5.jpg",
      titre: "Détails techniques"
    }
  ];

  const infos = [
    { icon: Mail, label: "Email", value: "thomasromeo.bonnardel@gmail.com" },
    { icon: Phone, label: "Téléphone", value: "06 95 07 10 84" },
    { icon: MapPin, label: "Zone", value: "Bouches-du-Rhône" },
    { icon: Clock, label: "Disponibilité", value: "7j/7j" }
  ];

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Hero Section - UNIFORMISÉ ET AFFINÉ */}
      <section ref={heroRef} className="relative min-h-[60vh] flex items-center justify-center overflow-hidden bg-gradient-to-br from-stone-900 via-stone-800 to-amber-900">
        {/* Grille 3D stylisée - Plus subtile */}
        <div className="absolute inset-0 opacity-[0.04]">
          <div className="absolute inset-0" style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                             linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
            transform: 'perspective(600px) rotateX(60deg)',
            transformOrigin: 'center center'
          }}></div>
        </div>

        {/* Effets lumineux - Légère touche technologique */}
        <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-amber-600/15 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-blue-600/10 rounded-full blur-[80px]"></div>

        <div className={`relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center transition-all duration-1000 ${
          heroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
        }`}>
          {/* Badge tech */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-full mb-6">
            <Box className="w-4 h-4 text-amber-300" />
            <span className="text-sm font-medium text-white">Technologie 3D</span>
          </div>

          {/* Titre */}
          <h1 className="text-4xl md:text-6xl font-bold mb-5 tracking-tight">
            <span className="block text-white">Conception 3D</span>
            <span className="block bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 bg-clip-text text-transparent">
              & Scan Professionnel
            </span>
          </h1>

          {/* Sous-titre */}
          <p className="text-base md:text-lg text-stone-300 max-w-3xl mx-auto leading-relaxed mb-6">
            Visualisez votre projet avant sa réalisation grâce à nos<br />
            <strong className="text-white">plans 3D détaillés</strong> et notre <strong className="text-white">technologie de scan</strong>
          </p>

          {/* Features */}
          <div className="flex flex-wrap gap-4 justify-center items-center text-sm text-stone-400">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-amber-400" />
              <span>Plans précis</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-amber-400" />
              <span>Rendu réaliste</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-amber-400" />
              <span>Scan 3D</span>
            </div>
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
              Scan 3D et modélisation pour une vision complète de votre projet
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
              Exemple de plan détaillé
            </h2>
            <p className="text-base md:text-xl text-stone-600">
              Découvrez un exemple réel de plan 3D que je réalise pour mes clients
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
                    <h3 className="text-xl md:text-2xl font-bold text-stone-800 mb-1 md:mb-2">Plan 3D détaillé</h3>
                    <p className="text-sm md:text-base text-stone-600">
                      Scan complet de votre espace avec toutes les mesures précises
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
                    "Surfaces au sol précises (m²)",
                    "Hauteurs sous plafond",
                    "Dimensions des murs, portes et fenêtres",
                    "Volumes calculés automatiquement",
                    "Plans détaillés pièce par pièce"
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

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
            {planImages.map((plan, index) => (
              <Card key={index} className="border-none shadow-xl overflow-hidden group cursor-pointer">
                <a
                  href={plan.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <div className="relative h-48 md:h-96 bg-white flex items-center justify-center p-2 md:p-4 overflow-hidden">
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
                    Je me déplace chez vous avec mon équipement professionnel de scan 3D.
                    En quelques heures, votre espace est entièrement numérisé. Vous recevez
                    vos plans détaillés sous 48h.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* NOUVELLE SECTION FORMULAIRE AVEC TABS */}
      <section className="py-16 md:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-4 gap-8 md:gap-12">
            {/* Sidebar Contact - COMPACT ET TRANSLUCIDE */}
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
                        "Plans précis"
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

            {/* Main Content avec Tabs */}
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

                {/* Tab Formulaire */}
                <TabsContent value="form">
                  <Card className="border-none shadow-xl">
                    <CardHeader className="border-b border-stone-100">
                      <CardTitle className="text-2xl md:text-3xl font-bold text-stone-800">
                        Demander un devis Scan 3D & Plans
                      </CardTitle>
                      <p className="text-sm text-stone-600 mt-2">
                        Remplissez ce formulaire pour une estimation précise
                      </p>
                    </CardHeader>
                    <CardContent className="p-6 md:p-8">
                      {isSuccess && (
                        <Alert className="mb-6 bg-green-50 border-green-500">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          <AlertDescription className="text-green-800 text-sm md:text-base">
                            Votre demande a été envoyée ! Je vous recontacterai rapidement pour planifier une visite.
                          </AlertDescription>
                        </Alert>
                      )}

                      {error && (
                        <Alert className="mb-6 bg-red-50 border-red-500">
                          <AlertDescription className="text-red-800 text-sm md:text-base">
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
                                Type de prestation *
                              </Label>
                              <Select value={formData.typeProjet} onValueChange={(value) => handleChange("typeProjet", value)} required>
                                <SelectTrigger className="h-11">
                                  <SelectValue placeholder="Sélectionnez" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Scan 3D uniquement">Scan 3D uniquement</SelectItem>
                                  <SelectItem value="Scan 3D + Plans 2D">Scan 3D + Plans 2D</SelectItem>
                                  <SelectItem value="Scan 3D + Plans détaillés">Scan 3D + Plans détaillés</SelectItem>
                                  <SelectItem value="Modélisation 3D complète">Modélisation 3D complète</SelectItem>
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
                                Surface à scanner *
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
                                Nombre de pièces à scanner *
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
                                  <SelectItem value="Moins de 500€">Moins de 500€</SelectItem>
                                  <SelectItem value="500€ - 1 000€">500€ - 1 000€</SelectItem>
                                  <SelectItem value="1 000€ - 2 000€">1 000€ - 2 000€</SelectItem>
                                  <SelectItem value="2 000€ - 5 000€">2 000€ - 5 000€</SelectItem>
                                  <SelectItem value="Plus de 5 000€">Plus de 5 000€</SelectItem>
                                  <SelectItem value="À définir">À définir</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-stone-700 font-medium mb-2 block">
                                Délai souhaité pour le scan
                              </Label>
                              <Select value={formData.delai} onValueChange={(value) => handleChange("delai", value)}>
                                <SelectTrigger className="h-11">
                                  <SelectValue placeholder="Sélectionnez" />
                                &nbsp;</SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Urgent (cette semaine)">Urgent (cette semaine)</SelectItem>
                                  <SelectItem value="1 à 2 semaines">1 à 2 semaines</SelectItem>
                                  <SelectItem value="2 à 4 semaines">2 à 4 semaines</SelectItem>
                                  <SelectItem value="Plus de 1 mois">Plus de 1 mois</SelectItem>
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
                                placeholder="Décrivez votre projet : travaux envisagés, vos attentes, contraintes particulières, etc."
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
                              Ajoutez des photos de l'espace pour une estimation plus précise
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
                            🔒 Vos informations sont confidentielles et ne seront jamais partagées
                          </p>
                        </div>
                      </form>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Tab Assistant IA */}
                <TabsContent value="assistant">
                  <Card className="border-none shadow-xl">
                    <CardHeader className="border-b border-stone-100">
                      <CardTitle className="text-2xl md:text-3xl font-bold text-stone-800 flex items-center gap-3">
                        <Bot className="w-8 h-8 text-amber-700" />
                        Discutez avec notre Assistant IA
                      </CardTitle>
                      <p className="text-sm text-stone-600 mt-2">
                        Laissez-vous guider pour définir votre projet de scan 3D
                      </p>
                    </CardHeader>
                    <CardContent className="p-6 md:p-8">
                      <AssistantChat />

                      <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                        <p className="text-sm text-amber-900">
                          <strong>💡 Astuce :</strong> L'assistant vous aidera à clarifier vos besoins.
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

      {/* CTA - HARMONISÉ AVEC ACCUEIL */}
      <section className="py-20 bg-gradient-to-r from-amber-900 via-amber-800 to-amber-900 relative overflow-hidden group">
        <div className="absolute inset-0 opacity-10 group-hover:opacity-20 transition-opacity duration-700">
          <div className="absolute inset-0" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%23ffffff" fill-opacity="1"%3E%3Cpath d="M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }}></div>
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 group-hover:scale-105 transition-transform duration-300">
            Besoin également de travaux de rénovation ?
          </h2>
          <p className="text-xl text-amber-100 mb-10 leading-relaxed">
            En plus du scan 3D et des plans, je réalise tous vos travaux de rénovation et d'aménagement intérieur.
            Service complet disponible à Marseille et dans toutes les Bouches-du-Rhône.
          </p>
          <Link to={createPageUrl("Contact")}>
            <Button size="lg" className="bg-white text-amber-900 hover:bg-stone-100 px-10 py-6 text-lg shadow-2xl transform hover:scale-110 hover:rotate-2 transition-all duration-300">
              Demander un devis travaux
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
