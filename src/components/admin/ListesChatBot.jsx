import React, { useState, useEffect, useRef } from "react";
import { api } from "@/api/apiClient";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, Send, Loader2, ShoppingCart, Mic, MicOff } from "lucide-react";

export default function ListesChatBot({ onItemCreated }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [convId, setConvId] = useState(null);
  const endRef = useRef(null);
  const recognitionRef = useRef(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{
        role: 'assistant',
        text: "👋 Je gère tes listes.\n\nExemples :\n• Ajoute lait et pain aux courses\n• Ajoute ciment 20kg aux matériaux\n• Coche le pain\n• Supprime les items cochés\n\nQue veux-tu faire ?"
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

  const send = async () => {
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput("");
    setMessages(m => [...m, { role: 'user', text: userMsg }]);
    setLoading(true);

    try {
      const res = await api.functions.invoke('invokeAgent', {
        userMessage: userMsg,
        context: "listes",
        conversationId: convId
      });

      if (res.data?.conversationId) setConvId(res.data.conversationId);

      const msg = res.data?.message || res.data?.output || "Message reçu";
      setMessages(m => [...m, { role: 'assistant', text: msg }]);

      if (res.data?.actions) {
        for (const act of res.data.actions) {
          if (act.type === 'refresh' && act.entity === 'ListeCourse') {
            queryClient.invalidateQueries({ queryKey: ['liste-courses'] });
            if (onItemCreated) onItemCreated();
          }
        }
      }
    } catch (err) {
      console.error('Erreur:', err);
      setMessages(m => [...m, { 
        role: 'assistant', 
        text: `❌ Erreur: ${err.response?.data?.error || err.message}` 
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
        style={{ background: 'linear-gradient(135deg, #FFF9D6, #F5C500)' }}
      >
        <ShoppingCart className="w-6 h-6 text-amber-900" />
      </button>
    );
  }

  return (
    <Card className="fixed bottom-6 right-6 z-50 w-96 shadow-2xl border-2 border-yellow-300">
      <CardHeader className="p-4 border-b" style={{ background: 'linear-gradient(135deg, #FFF9D6, #FFE46A)' }}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base text-amber-900 flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" />
            Listes IA
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        <div className="h-96 overflow-y-auto p-4 bg-yellow-50/30">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-2 mb-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-xl px-3 py-2 ${
                msg.role === 'user' 
                  ? 'bg-amber-600 text-white' 
                  : 'bg-white border-2 border-yellow-200'
              }`}>
                <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-2 mb-3">
              <div className="bg-white border-2 border-yellow-200 rounded-xl px-3 py-2">
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

        <div className="p-3 border-t-2 border-yellow-200 bg-white">
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
                style={{ background: 'linear-gradient(135deg, #FFE46A, #F5C500)' }}
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
