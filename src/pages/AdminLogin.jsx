import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { api } from "@/api/apiClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shield, Key, Lock, AlertCircle, Mail, User } from "lucide-react";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        await api.auth.me();
        navigate(createPageUrl("Gestion"));
      } catch {
        // Not authenticated
      }
    };
    checkAuth();
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!code.trim()) {
      setError("Entre le code d'acces.");
      return;
    }

    setIsSubmitting(true);
    try {
      await api.auth.login({ code: code.trim(), email, name });
      navigate(createPageUrl("Gestion"));
    } catch (err) {
      console.error(err);
      setError("Code incorrect ou serveur indisponible.");
      setCode("");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-4 bg-[radial-gradient(circle_at_20%_25%,rgba(59,130,246,0.12),transparent_38%),radial-gradient(circle_at_80%_10%,rgba(16,185,129,0.12),transparent_32%),radial-gradient(circle_at_50%_80%,rgba(14,26,51,0.55),rgba(5,9,21,0.85))] bg-[#0b1529] text-slate-100">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(59,130,246,0.4) 1px, transparent 1px)",
            backgroundSize: "30px 30px",
          }}
        ></div>
        <div className="absolute top-1/4 right-1/4 w-96 h-96 border border-white/10 rounded-full"></div>
        <div className="absolute -bottom-48 -left-48 w-[600px] h-[600px] border border-white/10 rounded-full"></div>
      </div>

      <Card className="w-full max-w-md relative z-10 border border-white/10 shadow-apple glass">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-amber-500 to-emerald-500"></div>

        <CardHeader className="relative p-8 md:p-12 border-b border-white/10">
          <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: "radial-gradient(circle at 2px 2px, rgba(255,255,255,0.5) 1px, transparent 0)", backgroundSize: "40px 40px" }}></div>

          <div className="relative flex flex-col items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-blue-500/20 rounded-2xl blur-xl"></div>
              <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-600 via-amber-500 to-cyan-400 flex items-center justify-center shadow-apple border border-white/20">
                <Shield className="w-10 h-10 text-white" />
              </div>
            </div>
            <div className="text-center space-y-2">
              <CardTitle className="text-3xl font-bold tracking-tight text-white">Administration</CardTitle>
              <p className="text-sm text-slate-200 font-medium">Acces reserve</p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-8 md:p-12 space-y-6">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-900/30 border border-white/15 mb-4">
              <Key className="w-7 h-7 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white">Connexion</h2>
            <p className="text-slate-200 text-sm mt-1">Entre le code d'acces pour continuer.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200 flex items-center gap-2">
                <User className="w-4 h-4" /> Nom (optionnel)
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ton nom"
                className="bg-slate-900/50 border border-white/20 text-white placeholder:text-slate-400"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200 flex items-center gap-2">
                <Mail className="w-4 h-4" /> Email (optionnel)
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@email.fr"
                className="bg-slate-900/50 border border-white/20 text-white placeholder:text-slate-400"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200 flex items-center gap-2">
                <Lock className="w-4 h-4" /> Code d'acces
              </label>
              <Input
                type="password"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Code administrateur"
                className="text-lg py-5 bg-slate-900/50 border border-white/20 text-white placeholder:text-slate-400"
                autoFocus
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 p-4 bg-red-900/30 border border-red-500/40 rounded-xl text-red-100 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-blue-600 via-amber-500 to-emerald-500 hover:opacity-90 text-white py-3 text-base shadow-apple rounded-xl border border-white/20"
              disabled={isSubmitting}
            >
              <Lock className="w-5 h-5 mr-2" />
              {isSubmitting ? "Connexion..." : "Se connecter"}
            </Button>
          </form>

          <Button
            variant="ghost"
            onClick={() => navigate(createPageUrl("Accueil"))}
            className="w-full text-slate-200 hover:text-white hover:bg-white/10 rounded-xl"
          >
            Retour au site
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
