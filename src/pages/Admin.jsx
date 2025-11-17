import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Loader2 } from "lucide-react";

export default function Admin() {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirection automatique vers la nouvelle interface Gestion
    navigate(createPageUrl("Gestion"), { replace: true });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-12 h-12 text-neutral-700 animate-spin mx-auto mb-4" />
        <p className="text-neutral-600">Redirection vers l'interface d'administration...</p>
      </div>
    </div>
  );
}