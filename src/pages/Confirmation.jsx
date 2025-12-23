import React from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { useSEO } from "@/hooks/use-seo";

export default function Confirmation() {
  const location = useLocation();
  const { nom = "", typeProjet = "" } = location.state || {};

  useSEO({
    title: "Confirmation - Demande envoyee | L'Atelier des Espaces",
    description: "Votre demande a bien ete envoyee. Nous vous recontactons rapidement pour votre projet."
  });

  return (
    <div className="min-h-screen bg-stone-50">
      <section className="relative min-h-[60vh] flex items-center justify-center px-4 py-16">
        <Card className="w-full max-w-2xl border-none shadow-2xl bg-white">
          <CardContent className="p-8 md:p-12 text-center space-y-6">
            <div className="mx-auto w-16 h-16 rounded-full bg-amber-700 text-white flex items-center justify-center shadow-lg">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl md:text-4xl font-bold text-stone-900">
                Merci pour votre demande
              </h1>
              <p className="text-stone-600">
                Votre message a bien ete envoye. Nous revenons vers vous rapidement.
              </p>
            </div>
            {nom && (
              <div className="text-stone-700 font-semibold">
                A bientot, {nom}.
              </div>
            )}
            {typeProjet && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-100 text-amber-900 text-sm font-medium">
                Projet: {typeProjet}
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <Link to={createPageUrl("Accueil")}>
                <Button className="bg-amber-700 hover:bg-amber-800 text-white">
                  Retour accueil
                </Button>
              </Link>
              <Link to={createPageUrl("Contact")}>
                <Button variant="outline" className="border-amber-700 text-amber-800 hover:bg-amber-50">
                  Envoyer un autre message
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
