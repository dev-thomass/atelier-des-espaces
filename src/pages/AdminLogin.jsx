import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { api } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  LogIn,
  UserPlus,
  Mail,
  Lock,
  User,
  AlertCircle,
  Loader2,
  ArrowLeft,
  Eye,
  EyeOff,
  CheckCircle2
} from "lucide-react";

const ASSET_BASE_URL = import.meta.env.BASE_URL || "/";

export default function AdminLogin() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
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

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setName("");
    setError("");
    setSuccess("");
  };

  const switchMode = (newMode) => {
    resetForm();
    setMode(newMode);
  };

  const validateForm = () => {
    if (!email.trim()) {
      setError("L'email est requis");
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Email invalide");
      return false;
    }
    if (!password) {
      setError("Le mot de passe est requis");
      return false;
    }
    if (password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caracteres");
      return false;
    }
    if (mode === "register" && password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      if (mode === "login") {
        await api.auth.login({ email: email.trim(), password });
        navigate(createPageUrl("Gestion"));
      } else {
        await api.auth.register({
          email: email.trim(),
          password,
          name: name.trim() || undefined
        });
        navigate(createPageUrl("Gestion"));
      }
    } catch (err) {
      console.error("Auth error:", err);
      let errorMessage = mode === "login"
        ? "Email ou mot de passe incorrect"
        : "Impossible de creer le compte";

      try {
        const errorData = JSON.parse(err.message);
        if (errorData.message) {
          errorMessage = errorData.message;
        }
      } catch {
        if (err.message?.includes("503") || err.message?.includes("db_not_configured")) {
          errorMessage = "Base de donnees non disponible";
        } else if (err.message?.includes("Failed to fetch") || err.message?.includes("NetworkError")) {
          errorMessage = "Erreur de connexion au serveur";
        }
      }
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-stone-100">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <img
            src={`${ASSET_BASE_URL}logo.png`}
            alt="L'Atelier des Espaces"
            className="w-14 h-14 mx-auto mb-3"
          />
          <h1 className="text-xl font-semibold text-stone-800">
            L'Atelier des Espaces
          </h1>
          <p className="text-stone-500 text-sm mt-1">
            Administration
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
          {/* Tabs */}
          <div className="flex mb-6 border-b border-stone-200">
            <button
              type="button"
              onClick={() => switchMode("login")}
              className={`flex-1 pb-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                mode === "login"
                  ? "text-amber-700 border-amber-600"
                  : "text-stone-400 border-transparent hover:text-stone-600"
              }`}
            >
              Connexion
            </button>
            <button
              type="button"
              onClick={() => switchMode("register")}
              className={`flex-1 pb-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                mode === "register"
                  ? "text-amber-700 border-amber-600"
                  : "text-stone-400 border-transparent hover:text-stone-600"
              }`}
            >
              Inscription
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-stone-700">
                  Nom
                </label>
                <Input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Votre nom"
                  className="border-stone-300 focus:border-amber-500 focus:ring-amber-500/20"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-stone-700">
                Email
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="votre@email.fr"
                autoComplete="email"
                className="border-stone-300 focus:border-amber-500 focus:ring-amber-500/20"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-stone-700">
                Mot de passe
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  className="border-stone-300 focus:border-amber-500 focus:ring-amber-500/20 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {mode === "register" && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-stone-700">
                  Confirmer le mot de passe
                </label>
                <Input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className="border-stone-300 focus:border-amber-500 focus:ring-amber-500/20"
                />
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{success}</span>
              </div>
            )}

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {mode === "login" ? "Connexion..." : "Creation..."}
                </>
              ) : (
                mode === "login" ? "Se connecter" : "Creer mon compte"
              )}
            </Button>
          </form>
        </div>

        {/* Back link */}
        <button
          type="button"
          onClick={() => navigate(createPageUrl("Accueil"))}
          className="w-full mt-4 text-sm text-stone-500 hover:text-stone-700 flex items-center justify-center gap-1"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour au site
        </button>

        <p className="text-center text-stone-400 text-xs mt-6">
          {new Date().getFullYear()} L'Atelier des Espaces
        </p>
      </div>
    </div>
  );
}
