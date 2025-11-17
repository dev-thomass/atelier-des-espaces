
import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, CheckCircle2, Award, Users, Clock, Sparkles, X, ChevronLeft, ChevronRight, MapPin, Briefcase } from "lucide-react";

// Hook personnalisé pour les animations au scroll - OPTIMISÉ
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
        } else if (options.once === false) {
          setIsVisible(false);
        }
      },
      {
        threshold: options.threshold || 0.1,
        rootMargin: options.rootMargin || '100px'
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

export default function Accueil() {
  const [selectedProjet, setSelectedProjet] = useState(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Animation refs - OPTIMISÉS avec threshold plus élevé
  const [heroRef, heroVisible] = useScrollAnimation({ threshold: 0.1 });
  const [avantagesRef, avantagesVisible] = useScrollAnimation({ threshold: 0.15 });
  const [zoneRef, zoneVisible] = useScrollAnimation({ threshold: 0.15 });
  const [projetsRef, projetsVisible] = useScrollAnimation({ threshold: 0.15 });
  const [conceptionRef, conceptionVisible] = useScrollAnimation({ threshold: 0.15 });
  const [prestationsRef, prestationsVisible] = useScrollAnimation({ threshold: 0.15 });

  // SEO Meta Tags
  useEffect(() => {
    document.title = "L'Atelier des Espaces - Artisan Rénovation & Aménagement Intérieur Marseille | Bouches-du-Rhône";
    
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute("content", "Artisan multiservice spécialisé en rénovation, aménagement et décoration intérieure à Marseille, Aix-en-Provence, Aubagne. Conception 3D, plâtrerie, peinture, carrelage, parquet. Devis gratuit.");
    } else {
      const meta = document.createElement('meta');
      meta.name = "description";
      meta.content = "Artisan multiservice spécialisé en rénovation, aménagement et décoration intérieure à Marseille, Aix-en-Provence, Aubagne. Conception 3D, plâtrerie, peinture, carrelage, parquet. Devis gratuit.";
      document.head.appendChild(meta);
    }

    const metaKeywords = document.querySelector('meta[name="keywords"]');
    const keywords = "artisan rénovation marseille, aménagement intérieur marseille, rénovation cuisine marseille, rénovation salle de bain marseille, décoration intérieur marseille, artisan multiservice marseille, conception 3D marseille, plâtrerie marseille, menuiserie marseille, peinture marseille, carrelage marseille, parquet marseille, artisan aix-en-provence, rénovation aubagne, artisan allauch, rénovation la ciotat, artisan bouches-du-rhône, second œuvre marseille, travaux intérieur marseille";
    if (metaKeywords) {
      metaKeywords.setAttribute("content", keywords);
    } else {
      const meta = document.createElement('meta');
      meta.name = "keywords";
      meta.content = keywords;
      document.head.appendChild(meta);
    }

    const updateOgTag = (property, content) => {
      let ogTag = document.querySelector(`meta[property="${property}"]`);
      if (ogTag) {
        ogTag.setAttribute("content", content);
      } else {
        ogTag = document.createElement('meta');
        ogTag.setAttribute("property", property);
        ogTag.setAttribute("content", content);
        document.head.appendChild(ogTag);
      }
    };

    updateOgTag("og:title", "L'Atelier des Espaces - Artisan Rénovation Intérieur Marseille");
    updateOgTag("og:description", "Artisan passionné pour vos projets de rénovation et aménagement intérieur à Marseille et dans les Bouches-du-Rhône. Devis gratuit.");
    updateOgTag("og:type", "website");
  }, []);

  // OPTIMISATION: Chargement des données avec staleTime pour éviter les re-fetch
  const { data: prestations = [], isLoading: isPrestationsLoading } = useQuery({
    queryKey: ['prestations-featured'],
    queryFn: () => base44.entities.Prestation.filter({ visible: true }, 'ordre', 3),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const { data: projets = [], isLoading: isProjetsLoading } = useQuery({
    queryKey: ['projets-all'],
    queryFn: () => base44.entities.Projet.filter({ visible: true }, 'ordre'),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const avantages = [
    { icon: Award, titre: "Qualité artisanale", description: "Un travail soigné et des finitions impeccables" },
    { icon: Users, titre: "Accompagnement sur-mesure", description: "Un suivi personnalisé" },
    { icon: Clock, titre: "Respect des délais", description: "Livraison dans les temps" },
    { icon: Sparkles, titre: "Créativité", description: "Des solutions uniques" },
  ];

  const handleProjetClick = (projet) => {
    setSelectedProjet(projet);
    setCurrentImageIndex(0);
  };

  const handleCloseModal = () => {
    setSelectedProjet(null);
    setCurrentImageIndex(0);
  };

  const allImages = selectedProjet ? [
    selectedProjet.image_url,
    ...(selectedProjet.images_supplementaires || [])
  ] : [];

  const allLabels = selectedProjet ? [
    selectedProjet.image_label,
    ...(selectedProjet.images_labels || [])
  ].filter(label => label) : [];

  const handlePrevImage = () => {
    setCurrentImageIndex((prev) => (prev === 0 ? allImages.length - 1 : prev - 1));
  };

  const handleNextImage = () => {
    setCurrentImageIndex((prev) => (prev === allImages.length - 1 ? 0 : prev + 1));
  };

  const getImageLabel = (imageUrl, imageIndex) => {
    const storedLabel = allLabels[imageIndex];
    if (storedLabel) {
      if (storedLabel.toLowerCase() === "avant") return "AVANT";
      if (storedLabel.toLowerCase() === "apres") return "APRÈS";
    }
    
    if (!imageUrl) return null;
    const lowerUrl = imageUrl.toLowerCase();
    
    if (lowerUrl.includes('avant')) {
      return "AVANT";
    }
    
    if (lowerUrl.includes('apres') || lowerUrl.includes('final')) {
      return "APRÈS";
    }
    
    return null;
  };

  return (
    <div className="bg-stone-50">
      {/* Hero Section - RÉDUIT ET AFFINÉ */}
      <section ref={heroRef} className="relative min-h-[85vh] flex items-center justify-center overflow-hidden bg-gradient-to-br from-stone-900 via-stone-800 to-amber-900">
        {/* Grille subtile */}
        <div className="absolute inset-0 opacity-[0.03]">
          <div className="absolute inset-0" style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
                             linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)`,
            backgroundSize: '50px 50px'
          }}></div>
        </div>

        {/* Effets lumineux modernes */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-amber-600/20 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-amber-500/10 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }}></div>

        <div className={`relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center transition-all duration-1000 ${
          heroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
        }`}>
          {/* Badge moderne */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-full mb-6 animate-in fade-in duration-700">
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span className="text-sm font-medium text-white">Artisan d'intérieur depuis 2020</span>
          </div>

          {/* Titre principal épuré */}
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6 tracking-tight text-white animate-in fade-in slide-in-from-bottom duration-1000">
            <span className="block">Transformons</span>
            <span className="block">vos espaces en</span>
            <span className="block bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 bg-clip-text text-transparent">
              lieux d'exception
            </span>
          </h1>

          {/* Sous-titre */}
          <p className="text-base md:text-lg text-stone-300 mb-10 max-w-3xl mx-auto leading-relaxed animate-in fade-in duration-1000" style={{ animationDelay: '200ms' }}>
            Artisan passionné spécialisé en <strong className="text-white">aménagement</strong>, <strong className="text-white">rénovation</strong> et <strong className="text-white">finitions intérieures</strong><br />
            à <strong className="text-white">Marseille</strong> et dans les <strong className="text-white">Bouches-du-Rhône</strong>
          </p>

          {/* CTA moderne */}
          <Link to={createPageUrl("Contact")}>
            <Button size="lg" className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white px-8 py-6 text-base shadow-2xl shadow-amber-900/50 transition-all duration-300 animate-in fade-in zoom-in duration-700" style={{ animationDelay: '300ms' }}>
              Démarrer votre projet
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </Link>
        </div>

        {/* Scroll indicator minimaliste */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 border-2 border-white/30 rounded-full flex items-start justify-center p-2">
            <div className="w-1 h-2 bg-white rounded-full animate-pulse"></div>
          </div>
        </div>
      </section>

      {/* Avantages */}
      <section ref={avantagesRef} className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className={`text-center mb-16 transition-all duration-700 ease-out ${
            avantagesVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
          }`}>
            <h2 className="text-4xl md:text-5xl font-bold text-stone-800 mb-4">Pourquoi me choisir ?</h2>
            <div className="w-24 h-1 bg-amber-700 mx-auto"></div>
          </div>
          
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8">
            {avantages.map((avantage, index) => (
              <div
                key={index}
                className={`transition-all duration-500 ease-out ${
                  avantagesVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
                }`}
                style={{ transitionDelay: `${index * 50}ms` }}
              >
                <Card className="border-none shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-3 hover:scale-105 bg-gradient-to-br from-white to-stone-50 group">
                  <CardContent className="p-4 md:p-8 text-center">
                    <div className="w-12 h-12 md:w-16 md:h-16 bg-gradient-to-br from-amber-700 to-amber-900 rounded-2xl flex items-center justify-center mx-auto mb-4 md:mb-6 transform group-hover:rotate-12 group-hover:scale-110 transition-transform duration-300">
                      <avantage.icon className="w-6 h-6 md:w-8 md:h-8 text-white" />
                    </div>
                    <h3 className="text-base md:text-xl font-bold text-stone-800 mb-2 md:mb-3 group-hover:text-amber-800 transition-colors">{avantage.titre}</h3>
                    <p className="text-xs md:text-base text-stone-600 leading-relaxed">{avantage.description}</p>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Zone d'intervention */}
      <section ref={zoneRef} className="py-20 bg-gradient-to-br from-stone-100 to-stone-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className={`text-center mb-16 transition-all duration-700 ease-out ${
            zoneVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
          }`}>
            <h2 className="text-4xl md:text-5xl font-bold text-stone-800 mb-4">
              Votre artisan d'intérieur dans les Bouches-du-Rhône
            </h2>
            <p className="text-xl text-stone-600 max-w-3xl mx-auto">
              Un accompagnement professionnel pour tous vos travaux de rénovation et d'aménagement
            </p>
            <div className="w-24 h-1 bg-amber-700 mx-auto mt-4"></div>
          </div>

          <Card className={`border-none shadow-2xl bg-white/80 backdrop-blur-sm hover:shadow-amber-700/20 transition-all duration-500 ease-out transform ${
            zoneVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
          }`}>
            <CardContent className="p-8 md:p-12">
              <div className="grid md:grid-cols-2 gap-12">
                <div>
                  <h3 className="text-2xl font-bold text-stone-800 mb-6 flex items-center gap-3">
                    <MapPin className="w-6 h-6 text-amber-700" />
                    Zones d'intervention
                  </h3>
                  <div className="space-y-4">
                    <p className="text-stone-700 leading-relaxed">
                      Basé dans les <strong>Bouches-du-Rhône</strong>, j'interviens pour tous vos projets d'<strong>aménagement intérieur</strong>, de <strong>rénovation</strong>, de <strong>second œuvre</strong> et de <strong>finitions</strong> dans les secteurs suivants :
                    </p>
                    <div className="grid grid-cols-2 gap-3 text-stone-700">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-amber-700 flex-shrink-0" />
                        <span><strong>Marseille</strong></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-amber-700 flex-shrink-0" />
                        <span><strong>Allauch</strong></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-amber-700 flex-shrink-0" />
                        <span><strong>Plan-de-Cuques</strong></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-amber-700 flex-shrink-0" />
                        <span><strong>Aubagne</strong></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-amber-700 flex-shrink-0" />
                        <span><strong>La Ciotat</strong></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-amber-700 flex-shrink-0" />
                        <span><strong>Bandol</strong></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-amber-700 flex-shrink-0" />
                        <span><strong>Cassis</strong></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-amber-700 flex-shrink-0" />
                        <span><strong>Peypin</strong></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-amber-700 flex-shrink-0" />
                        <span><strong>Aix-en-Provence</strong></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-amber-700 flex-shrink-0" />
                        <span>Et les communes voisines</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-2xl font-bold text-stone-800 mb-6 flex items-center gap-3">
                    <Briefcase className="w-6 h-6 text-amber-700" />
                    Mes domaines d'expertise
                  </h3>
                  <div className="space-y-3 text-stone-700">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
                      <div>
                        <strong>Conception & Plans 3D</strong>
                        <p className="text-sm text-stone-600">Scan 3D, modélisation et réalisation de plans détaillés.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
                      <div>
                        <strong>Rénovation intérieure</strong>
                        <p className="text-sm text-stone-600">Cuisine, salle de bain, salon, chambre — du gros œuvre aux finitions.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
                      <div>
                        <strong>Second œuvre</strong>
                        <p className="text-sm text-stone-600">Plâtrerie, cloisons, menuiserie, électricité.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
                      <div>
                        <strong>Peinture & Revêtements</strong>
                        <p className="text-sm text-stone-600">Peinture décorative, pose de sols, murs et carrelages.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
                      <div>
                        <strong>Aménagement sur mesure</strong>
                        <p className="text-sm text-stone-600">Création de dressings, rangements et mobilier intégré.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
                      <div>
                        <strong>Décoration & Finitions</strong>
                        <p className="text-sm text-stone-600">Éclairage, éléments décoratifs, finitions soignées.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-12 pt-8 border-t border-stone-200">
                <p className="text-center text-stone-700 leading-relaxed">
                  Fort d'une solide expérience dans la <strong>rénovation</strong> et l'<strong>aménagement intérieur</strong>, 
                  j'accompagne mes clients de la conception à la réalisation de leurs projets. Mon objectif : allier 
                  <strong> fonctionnalité</strong>, <strong>esthétique</strong> et <strong>qualité d'exécution</strong> pour 
                  créer des espaces qui vous ressemblent.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Mes Réalisations - OPTIMISÉ */}
      <section ref={projetsRef} className="py-20 bg-stone-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className={`text-center mb-16 transition-all duration-700 ease-out ${
            projetsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
          }`}>
            <h2 className="text-4xl md:text-5xl font-bold text-stone-800 mb-4">Mes Réalisations</h2>
            <p className="text-xl text-stone-600">Découvrez mes projets avant/après</p>
            <div className="w-24 h-1 bg-amber-700 mx-auto mt-4"></div>
          </div>
          
          <div className="relative">
            {isProjetsLoading ? (
              <div className="overflow-x-auto pb-8 -mx-4 px-4 sm:mx-0 sm:px-0">
                <div className="flex gap-4 md:gap-6" style={{ minWidth: 'min-content' }}>
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex-shrink-0 w-72 md:w-80">
                      <Card className="border-none shadow-xl bg-white overflow-hidden h-full">
                        <Skeleton className="h-80 md:h-96 w-full" />
                        <CardContent className="p-4 md:p-6">
                          <Skeleton className="h-6 w-3/4 mb-2" />
                          <Skeleton className="h-4 w-1/2" />
                        </CardContent>
                      </Card>
                    </div>
                  ))}
                </div>
              </div>
            ) : projets.length > 0 ? (
              <div className="overflow-x-auto pb-8 hide-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
                <div className="flex gap-4 md:gap-6" style={{ minWidth: 'min-content' }}>
                  {projets.map((projet, index) => (
                    <div 
                      key={projet.id}
                      className={`flex-shrink-0 w-72 md:w-80 cursor-pointer group transition-all duration-500 ease-out ${
                        projetsVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10'
                      }`}
                      style={{ transitionDelay: `${index * 50}ms` }}
                      onClick={() => handleProjetClick(projet)}
                    >
                      <Card className="border-none shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-3 hover:scale-105 bg-white overflow-hidden h-full">
                        <div className="relative h-80 md:h-96 overflow-hidden">
                          <img
                            src={projet.image_url}
                            alt={projet.titre}
                            className="w-full h-full object-cover transform group-hover:scale-125 transition-transform duration-500"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-stone-900/90 via-stone-900/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4 md:p-6">
                            <Badge className="mb-2 md:mb-3 w-fit bg-amber-700 text-white border-none text-xs md:text-sm">
                              {projet.categorie}
                            </Badge>
                            <h3 className="text-white font-bold text-xl md:text-2xl mb-1 md:mb-2">{projet.titre}</h3>
                            <p className="text-stone-200 text-xs md:text-sm">Cliquez pour voir avant/après</p>
                          </div>
                        </div>
                        <CardContent className="p-4 md:p-6">
                          <div className="flex items-center justify-between mb-2">
                            <Badge className="bg-amber-100 text-amber-800 border-none text-xs md:text-sm">
                              {projet.categorie}
                            </Badge>
                            {projet.annee && (
                              <span className="text-xs md:text-sm text-stone-500">{projet.annee}</span>
                            )}
                          </div>
                          <h3 className="text-lg md:text-xl font-bold text-stone-800 line-clamp-2">{projet.titre}</h3>
                        </CardContent>
                      </Card>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* Plans & Modélisation 3D */}
      <section ref={conceptionRef} className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className={`text-center mb-16 transition-all duration-700 ease-out ${
            conceptionVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
          }`}>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-stone-800 mb-4">Conception & Modélisation</h2>
            <p className="text-lg md:text-xl text-stone-600">Des plans détaillés et visualisations 3D pour vos projets</p>
            <div className="w-24 h-1 bg-amber-700 mx-auto mt-4"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            {[
              {
                url: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6901ebfc5e146f4dd7ae429a/5b10319e0_plan3D.png",
                title: "Modélisation 3D",
                desc: "Visualisez votre projet en 3D avant le début des travaux"
              },
              {
                url: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6901ebfc5e146f4dd7ae429a/c02f03180_Scan3D.jpg",
                title: "Scan 3D de l'espace",
                desc: "Relevé précis de vos espaces pour une conception optimale"
              }
            ].map((item, index) => (
              <div
                key={index}
                className={`transition-all duration-500 ease-out ${
                  conceptionVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
                }`}
                style={{ transitionDelay: `${index * 100}ms` }}
              >
                <Card className="border-none shadow-2xl overflow-hidden group hover:shadow-amber-700/30 transition-all duration-300 transform hover:-translate-y-2">
                  <div className="relative h-64 md:h-96 bg-white flex items-center justify-center p-6 overflow-hidden">
                    <img
                      src={item.url}
                      alt={item.title}
                      className="w-full h-full object-contain transform group-hover:scale-110 transition-transform duration-500"
                      loading="lazy"
                    />
                  </div>
                  <CardContent className="p-4 md:p-6">
                    <h3 className="text-xl md:text-2xl font-bold text-stone-800 mb-2 group-hover:text-amber-800 transition-colors">{item.title}</h3>
                    <p className="text-sm md:text-base text-stone-600">{item.desc}</p>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Prestations Featured - OPTIMISÉ */}
      <section ref={prestationsRef} className="py-20 bg-stone-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className={`text-center mb-16 transition-all duration-700 ease-out ${
            prestationsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
          }`}>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-stone-800 mb-4">Mes prestations</h2>
            <p className="text-lg md:text-xl text-stone-600 max-w-2xl mx-auto">De la conception aux finitions</p>
            <div className="w-24 h-1 bg-amber-700 mx-auto mt-4"></div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 mb-12">
            {isPrestationsLoading ? (
              [1, 2, 3].map((i) => (
                <Card key={i} className="border-none shadow-xl bg-white group h-full">
                  <CardContent className="p-6 md:p-8 flex flex-col h-full">
                    <Skeleton className="w-12 h-12 md:w-14 md:h-14 rounded-xl mb-4 md:mb-6" />
                    <Skeleton className="h-6 md:h-8 w-3/4 mb-3 md:mb-4" />
                    <Skeleton className="h-4 w-full mb-2" />
                    <Skeleton className="h-4 w-full mb-2" />
                    <Skeleton className="h-4 w-2/3" />
                  </CardContent>
                </Card>
              ))
            ) : prestations.length > 0 ? (
              prestations.map((prestation, index) => (
                <div
                  key={prestation.id}
                  className={`transition-all duration-500 ease-out ${
                    prestationsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
                  }`}
                  style={{ transitionDelay: `${index * 50}ms` }}
                >
                  <Card className="border-none shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-3 hover:scale-105 bg-white group h-full">
                    <CardContent className="p-6 md:p-8 flex flex-col h-full">
                      <div className="w-12 h-12 md:w-14 md:h-14 bg-amber-100 rounded-xl flex items-center justify-center mb-4 md:mb-6 group-hover:bg-amber-700 transition-colors duration-300 flex-shrink-0">
                        <CheckCircle2 className="w-6 h-6 md:w-7 md:h-7 text-amber-700 group-hover:text-white transition-colors duration-300" />
                      </div>
                      <h3 className="text-xl md:text-2xl font-bold text-stone-800 mb-3 md:mb-4 group-hover:text-amber-800 transition-colors flex-shrink-0">{prestation.titre}</h3>
                      <p className="text-sm md:text-base text-stone-600 leading-relaxed flex-grow">{prestation.description}</p>
                    </CardContent>
                  </Card>
                </div>
              ))
            ) : null}
          </div>
          
          <div className="text-center">
            <Link to={createPageUrl("Prestations")}>
              <Button size="lg" variant="outline" className="border-2 border-amber-700 text-amber-700 hover:bg-amber-700 hover:text-white px-6 md:px-8 py-4 md:py-6 text-base md:text-lg transition-all duration-300 transform hover:scale-110">
                Voir toutes les prestations
                <ArrowRight className="ml-2 w-4 h-4 md:w-5 md:h-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-20 bg-gradient-to-r from-amber-900 via-amber-800 to-amber-900 relative overflow-hidden group">
        <div className="absolute inset-0 opacity-10 group-hover:opacity-20 transition-opacity duration-700">
          <div className="absolute inset-0" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%23ffffff" fill-opacity="1"%3E%3Cpath d="M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }}></div>
        </div>
        
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 group-hover:scale-105 transition-transform duration-300">Prêt à transformer votre intérieur ?</h2>
          <p className="text-xl text-amber-100 mb-10 leading-relaxed">
            Contactez-moi pour un devis gratuit et personnalisé
          </p>
          <Link to={createPageUrl("Contact")}>
            <Button size="lg" className="bg-white text-amber-900 hover:bg-stone-100 px-10 py-6 text-lg shadow-2xl transform hover:scale-110 hover:rotate-2 transition-all duration-300">
              Demander un devis gratuit
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Modal Projet */}
      <Dialog open={selectedProjet !== null} onOpenChange={handleCloseModal}>
        <DialogContent className="max-w-[95vw] md:max-w-7xl h-[95vh] md:max-h-[95vh] p-0 overflow-y-auto bg-stone-50/95 backdrop-blur-md">
          {selectedProjet && (
            <div className="relative h-full">
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 md:top-4 md:right-4 z-50 bg-stone-900/80 hover:bg-stone-900 text-white rounded-full"
                onClick={handleCloseModal}
              >
                <X className="w-5 h-5 md:w-6 md:h-6" />
              </Button>

              <div className="flex flex-col lg:grid lg:grid-cols-2 gap-4 md:gap-8 p-4 md:p-8">
                <div className="relative order-1">
                  <div className="relative h-[300px] md:h-[500px] lg:h-[600px] rounded-xl md:rounded-2xl overflow-hidden shadow-2xl">
                    <img
                      src={allImages[currentImageIndex]}
                      alt={`${selectedProjet.titre} - Image ${currentImageIndex + 1}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    
                    {getImageLabel(allImages[currentImageIndex], currentImageIndex) && (
                      <div className={`absolute top-3 left-3 md:top-6 md:left-6 px-3 py-1.5 md:px-6 md:py-3 rounded-lg text-white font-bold text-sm md:text-xl shadow-2xl ${
                        getImageLabel(allImages[currentImageIndex], currentImageIndex) === "AVANT" 
                          ? "bg-red-600" 
                          : "bg-green-600"
                      }`}>
                        {getImageLabel(allImages[currentImageIndex], currentImageIndex)}
                      </div>
                    )}
                    
                    {allImages.length > 1 && (
                      <>
                        <button
                          onClick={handlePrevImage}
                          className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 bg-stone-900/80 hover:bg-stone-900 text-white p-2 md:p-3 rounded-full transition-all duration-300"
                        >
                          <ChevronLeft className="w-5 h-5 md:w-6 md:h-6" />
                        </button>
                        <button
                          onClick={handleNextImage}
                          className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 bg-stone-900/80 hover:bg-stone-900 text-white p-2 md:p-3 rounded-full transition-all duration-300"
                        >
                          <ChevronRight className="w-5 h-5 md:w-6 md:h-6" />
                        </button>
                      </>
                    )}

                    <div className="absolute bottom-2 md:bottom-4 left-1/2 -translate-x-1/2 bg-stone-900/80 text-white px-3 py-1 md:px-4 md:py-2 rounded-full text-xs md:text-sm">
                      {currentImageIndex + 1} / {allImages.length}
                    </div>
                  </div>

                  {allImages.length > 1 && (
                    <div className="flex gap-2 mt-3 md:mt-4 overflow-x-auto pb-2">
                      {allImages.map((img, idx) => (
                        <button
                          key={idx}
                          onClick={() => setCurrentImageIndex(idx)}
                          className={`flex-shrink-0 relative w-16 h-16 md:w-24 md:h-24 rounded-lg overflow-hidden border-2 transition-all duration-300 ${
                            idx === currentImageIndex ? 'border-amber-700 scale-105' : 'border-transparent opacity-60 hover:opacity-100'
                          }`}
                        >
                          <img src={img} alt={`Miniature ${idx + 1}`} className="w-full h-full object-cover" loading="lazy" />
                          {getImageLabel(img, idx) && (
                            <div className={`absolute bottom-0 left-0 right-0 text-white text-[10px] md:text-xs font-bold py-0.5 md:py-1 text-center ${
                              getImageLabel(img, idx) === "AVANT" ? "bg-red-600" : "bg-green-600"
                            }`}>
                              {getImageLabel(img, idx)}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex flex-col justify-center order-2">
                  <Badge className="mb-3 md:mb-4 w-fit bg-amber-700 text-white border-none text-sm md:text-lg px-3 py-1 md:px-4 md:py-2">
                    {selectedProjet.categorie}
                  </Badge>
                  
                  <h2 className="text-2xl md:text-4xl lg:text-5xl font-bold text-stone-800 mb-4 md:mb-6">
                    {selectedProjet.titre}
                  </h2>
                  
                  <p className="text-base md:text-lg text-stone-700 leading-relaxed mb-6 md:mb-8">
                    {selectedProjet.description}
                  </p>

                  <div className="grid grid-cols-2 gap-3 md:gap-4 mb-6 md:mb-8">
                    {selectedProjet.annee && (
                      <div className="bg-white rounded-lg p-3 md:p-4 shadow-md">
                        <div className="text-xs md:text-sm text-stone-500 mb-1">Année</div>
                        <div className="text-lg md:text-xl font-bold text-stone-800">{selectedProjet.annee}</div>
                      </div>
                    )}
                    {selectedProjet.surface && (
                      <div className="bg-white rounded-lg p-3 md:p-4 shadow-md">
                        <div className="text-xs md:text-sm text-stone-500 mb-1">Surface</div>
                        <div className="text-lg md:text-xl font-bold text-stone-800">{selectedProjet.surface}</div>
                      </div>
                    )}
                    {selectedProjet.duree && (
                      <div className="bg-white rounded-lg p-3 md:p-4 shadow-md">
                        <div className="text-xs md:text-sm text-stone-500 mb-1">Durée</div>
                        <div className="text-lg md:text-xl font-bold text-stone-800">{selectedProjet.duree}</div>
                      </div>
                    )}
                  </div>

                  <Link to={createPageUrl("Contact")}>
                    <Button size="lg" className="w-full bg-amber-700 hover:bg-amber-800 text-white py-4 md:py-6 text-base md:text-lg shadow-xl transform hover:scale-105 transition-all duration-300">
                      Un projet similaire ?
                      <ArrowRight className="ml-2 w-4 h-4 md:w-5 md:h-5" />
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <style jsx>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
