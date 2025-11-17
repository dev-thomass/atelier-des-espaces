import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shield, Key, Lock, Loader2, AlertCircle } from "lucide-react";

const ADMIN_PASSWORD = "159357";

export default function AdminLogin() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  // L'état isLoading est initialisé à false, donc ce useEffect n'est plus nécessaire.
  // Il est conservé ici pour référence, mais peut être supprimé si l'on est sûr que
  // le chargement n'est plus nécessaire.
  // useEffect(() => {
  //   setIsLoading(false);
  // }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");

    if (password === ADMIN_PASSWORD) {
      // Supprime la persistance de l'authentification
      navigate(createPageUrl("Gestion"));
    } else {
      setError("Mot de passe incorrect");
      setPassword("");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-white to-neutral-100 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-neutral-900 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-neutral-50 via-white to-neutral-100 flex items-center justify-center p-4">
      {/* Motifs géométriques en arrière-plan */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Grille de points subtile */}
        <div className="absolute inset-0 opacity-[0.015]" style={{
          backgroundImage: 'radial-gradient(circle, #000 1px, transparent 1px)',
          backgroundSize: '30px 30px'
        }}></div>
        
        {/* Cercles décoratifs */}
        <div className="absolute top-1/4 right-1/4 w-96 h-96 border border-neutral-200/30 rounded-full"></div>
        <div className="absolute -bottom-48 -left-48 w-[600px] h-[600px] border border-neutral-200/30 rounded-full"></div>
        
        {/* Dégradés subtils */}
        <div className="absolute top-0 right-0 w-1/3 h-1/3 bg-gradient-to-bl from-neutral-900/[0.02] to-transparent"></div>
        <div className="absolute bottom-0 left-0 w-1/3 h-1/3 bg-gradient-to-tr from-neutral-900/[0.02] to-transparent"></div>
        
        {/* Lignes diagonales */}
        <div className="absolute top-0 left-1/4 w-[1px] h-full bg-gradient-to-b from-transparent via-neutral-200/20 to-transparent rotate-12"></div>
        <div className="absolute top-0 right-1/3 w-[1px] h-full bg-gradient-to-b from-transparent via-neutral-200/20 to-transparent -rotate-12"></div>
      </div>

      <Card className="w-full max-w-md relative z-10 border-none shadow-2xl bg-white/80 backdrop-blur-sm overflow-hidden">
        {/* Header avec dégradé subtil */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-neutral-900 to-transparent"></div>
        
        <CardHeader className="relative p-8 md:p-12 bg-gradient-to-br from-neutral-50 to-white border-b border-neutral-100">
          {/* Pattern subtil */}
          <div className="absolute inset-0 opacity-[0.015]" style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, #000 1px, transparent 0)`,
            backgroundSize: '40px 40px'
          }}></div>
          
          <div className="relative flex flex-col items-center">
            {/* Badge moderne */}
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-neutral-900/5 rounded-2xl blur-xl"></div>
              <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 flex items-center justify-center shadow-xl border border-neutral-700/20">
                <Shield className="w-10 h-10 text-white" />
                
                {/* Points décoratifs */}
                <div className="absolute -top-1 -left-1 w-2 h-2 rounded-full bg-neutral-900"></div>
                <div className="absolute -bottom-1 -right-1 w-2 h-2 rounded-full bg-neutral-900"></div>
              </div>
            </div>
            
            {/* Titre stylisé */}
            <div className="text-center space-y-2">
              <CardTitle className="text-3xl font-bold tracking-tight">
                <span className="bg-gradient-to-r from-neutral-900 via-neutral-700 to-neutral-900 bg-clip-text text-transparent">
                  Administration
                </span>
              </CardTitle>
              <div className="flex items-center justify-center gap-2">
                <div className="h-[1px] w-8 bg-gradient-to-r from-transparent to-neutral-300"></div>
                <p className="text-sm text-neutral-500 font-medium">L'Atelier des Espaces</p>
                <div className="h-[1px] w-8 bg-gradient-to-l from-transparent to-neutral-300"></div>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-8 md:p-12">
          {/* Icon central minimaliste */}
          <div className="text-center mb-8">
            <div className="relative inline-block mb-6">
              <div className="absolute inset-0 bg-neutral-900/5 rounded-2xl blur-2xl"></div>
              <div className="relative w-24 h-24 rounded-2xl bg-gradient-to-br from-neutral-100 to-neutral-50 border border-neutral-200 flex items-center justify-center shadow-lg">
                <Key className="w-12 h-12 text-neutral-900" />
              </div>
            </div>
            
            <h2 className="text-2xl font-bold text-neutral-900 mb-2">
              Connexion Sécurisée
            </h2>
            <p className="text-neutral-600 text-sm">
              Accès réservé aux administrateurs
            </p>
          </div>

          {/* Formulaire */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="relative">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mot de passe"
                className="text-center text-lg py-6 border-2 border-neutral-200 focus:border-neutral-900 bg-white rounded-xl transition-all"
                autoFocus
              />
              <div className="absolute inset-x-0 -bottom-1 h-[2px] bg-gradient-to-r from-transparent via-neutral-900/20 to-transparent opacity-0 group-focus-within:opacity-100 transition-opacity"></div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-4 bg-red-50/80 backdrop-blur-sm border border-red-200/50 rounded-xl text-red-800 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-neutral-900 via-neutral-800 to-neutral-900 hover:from-neutral-800 hover:to-neutral-900 text-white py-6 text-lg shadow-xl hover:shadow-2xl transform hover:scale-[1.02] transition-all duration-300 rounded-xl border border-neutral-700/20"
            >
              <Lock className="w-5 h-5 mr-2" />
              Se connecter
            </Button>
          </form>

          {/* Bouton retour */}
          <Button
            variant="ghost"
            onClick={() => navigate(createPageUrl("Accueil"))}
            className="w-full mt-4 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-xl"
          >
            ← Retour au site
          </Button>

          {/* Notice de sécurité minimaliste */}
          <div className="mt-8 p-4 bg-gradient-to-br from-neutral-50 to-neutral-100 border border-neutral-200/50 rounded-xl">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-neutral-700 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-neutral-900 mb-1">
                  Accès protégé
                </p>
                <p className="text-xs text-neutral-600 leading-relaxed">
                  Cet espace est réservé à l'administrateur. Connexion sécurisée requise.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}