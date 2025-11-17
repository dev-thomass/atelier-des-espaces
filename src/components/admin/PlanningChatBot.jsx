import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, Send, Loader2, Calendar, Mic, MicOff } from "lucide-react";

export default function PlanningChatBot({ onEventCreated }) {
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
        text: "👋 Je gère ton planning.\n\nExemples :\n• RDV client Dupont demain 14h\n• Réunion équipe vendredi 10h\n• Liste mes événements\n\nQue veux-tu faire ?"
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
      const res = await base44.functions.invoke('invokeAgent', {
        userMessage: userMsg,
        context: "planning",
        conversationId: convId
      });

      if (res.data?.conversationId) setConvId(res.data.conversationId);

      const msg = res.data?.message || res.data?.output || "Message reçu";
      setMessages(m => [...m, { role: 'assistant', text: msg }]);

      if (res.data?.actions) {
        for (const act of res.data.actions) {
          if (act.type === 'refresh' && act.entity === 'Event') {
            queryClient.invalidateQueries({ queryKey: ['events'] });
            if (onEventCreated) onEventCreated();
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
        style={{ background: 'linear-gradient(135deg, #DBEAFE, #3B82F6)' }}
      >
        <Calendar className="w-6 h-6 text-blue-900" />
      </button>
    );
  }

  return (
    <Card className="fixed bottom-6 right-6 z-50 w-96 shadow-2xl border-2 border-blue-300">
      <CardHeader className="p-4 border-b" style={{ background: 'linear-gradient(135deg, #DBEAFE, #93C5FD)' }}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base text-blue-900 flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Planning IA
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        <div className="h-96 overflow-y-auto p-4 bg-blue-50/30">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-2 mb-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-xl px-3 py-2 ${
                msg.role === 'user' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-white border-2 border-blue-200'
              }`}>
                <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-2 mb-3">
              <div className="bg-white border-2 border-blue-200 rounded-xl px-3 py-2">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                </div>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="p-3 border-t-2 border-blue-200 bg-white">
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
                    : 'bg-blue-500 hover:bg-blue-600'
                }`}
                title={isListening ? "Arrêter" : "Parler"}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </Button>
              <Button
                onClick={send}
                disabled={!input.trim() || loading}
                style={{ background: 'linear-gradient(135deg, #93C5FD, #3B82F6)' }}
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