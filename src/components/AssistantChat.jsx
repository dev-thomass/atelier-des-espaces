import React, { useState, useEffect, useRef } from "react";
import { sendAssistantMessage } from "@/api/assistantClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Bot, Send, Loader2, Mic, MicOff } from "lucide-react";

export default function AssistantChat({ context = "conseil", initialMessage }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const endRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{
        role: 'assistant',
        text: initialMessage || "Bonjour ! Comment puis-je vous aider aujourd'hui ?"
      }]);
    }
  }, [initialMessage]);

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
      alert("La reconnaissance vocale n'est pas supportee par votre navigateur");
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
      const res = await sendAssistantMessage({
        message: userMsg,
        conversationId,
        context: { page: context },
      });
      if (res.conversationId && !conversationId) {
        setConversationId(res.conversationId);
      }

      const msg = res.reply || "Message recu";
      setMessages(m => [...m, { role: 'assistant', text: msg }]);
    } catch (err) {
      console.error('Erreur:', err);
      setMessages(m => [...m, { 
        role: 'assistant', 
        text: "Desole, une erreur s'est produite. Veuillez reessayer." 
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[600px] bg-gradient-to-br from-[var(--color-bg-surface-hover)] to-[var(--color-bg-surface)] rounded-xl border-2 border-[var(--color-border-light)] shadow-xl overflow-hidden">
      <div className="bg-gradient-to-r from-[var(--color-secondary-600)] to-[var(--color-secondary-700)] text-white p-4 border-b-2 border-[var(--color-secondary-700)]">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-[color:var(--color-bg-surface)]/20 rounded-xl flex items-center justify-center">
            <Bot className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-lg">Assistant Expert IA</h3>
            <p className="text-xs text-[var(--color-secondary-100)]">Conseils personnalises pour votre projet</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 mb-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="h-9 w-9 rounded-xl bg-[var(--color-secondary-600)] flex items-center justify-center flex-shrink-0">
                <Bot className="w-5 h-5 text-white" />
              </div>
            )}
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
              msg.role === 'user'
                ? 'bg-[var(--color-secondary-600)] text-white'
                : 'bg-[var(--color-bg-surface)] border-2 border-[var(--color-border-light)]'
            }`}>
              <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
            </div>
            {msg.role === 'user' && (
              <div className="h-9 w-9 rounded-xl bg-[var(--color-primary-600)] flex items-center justify-center flex-shrink-0">
                <span className="text-white text-sm font-bold">V</span>
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex gap-3 mb-4">
            <div className="h-9 w-9 rounded-xl bg-[var(--color-secondary-600)] flex items-center justify-center flex-shrink-0">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div className="bg-[var(--color-bg-surface)] border-2 border-[var(--color-border-light)] rounded-2xl px-4 py-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-[var(--color-secondary-600)] rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-[var(--color-secondary-600)] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-2 h-2 bg-[var(--color-secondary-600)] rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="p-4 border-t-2 border-[var(--color-border-light)] bg-[var(--color-bg-surface)]">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
            placeholder="Decrivez votre projet..."
            rows={2}
            disabled={loading}
          />
          <div className="flex flex-col gap-2">
            <Button
              onClick={toggleVoiceInput}
              disabled={loading}
              className={`${
                isListening 
                  ? 'bg-[var(--color-error-text)] hover:bg-[var(--color-error-icon)] animate-pulse' 
                  : 'bg-[var(--color-secondary-500)] hover:bg-[var(--color-secondary-600)]'
              }`}
              title={isListening ? "Arreter l'ecoute" : "Parler"}
            >
              {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </Button>
            <Button
              onClick={send}
              disabled={!input.trim() || loading}
              className="bg-[var(--color-secondary-600)] hover:bg-[var(--color-secondary-700)]"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </Button>
          </div>
        </div>
        <p className="text-xs text-[var(--color-text-tertiary)] mt-2">
           Plus de details = meilleures recommandations   Cliquez sur le micro pour parler
        </p>
      </div>
    </div>
  );
}
