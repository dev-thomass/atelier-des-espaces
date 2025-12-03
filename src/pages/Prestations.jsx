
import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock, X, ChevronLeft, ChevronRight, ZoomIn, Sparkles, Briefcase } from "lucide-react";

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

export default function Prestations() {
  const [selectedProjet, setSelectedProjet] = useState(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [heroRef, heroVisible] = useScrollAnimation({ threshold: 0.05 });

  // SEO Meta Tags
  useEffect(() => {
    document.title = "Nos Prestations - Rénovation, Aménagement, Second Œuvre Marseille | L'Atelier des Espaces";
    
    let metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute("content", "Découvrez nos prestations d'artisan multiservice : rénovation cuisine, salle de bain, peinture, carrelage, parquet, plâtrerie, menuiserie. Intervention à Marseille, Aix-en-Provence, Aubagne, Bouches-du-Rhône.");
    } else {
      const meta = document.createElement('meta');
      meta.name = "description";
      meta.content = "Découvrez nos prestations d'artisan multiservice : rénovation cuisine, salle de bain, peinture, carrelage, parquet, plâtrerie, menuiserie. Intervention à Marseille, Aix-en-Provence, Aubagne, Bouches-du-Rhône.";
      document.head.appendChild(meta);
    }

    let metaKeywords = document.querySelector('meta[name="keywords"]');
    const keywords = "prestations rénovation marseille, travaux intérieur marseille, rénovation cuisine marseille, rénovation salle de bain marseille, peinture intérieure marseille, pose carrelage marseille, pose parquet marseille, plâtrerie marseille, menuiserie marseille, second œuvre marseille, finitions marseille, artisan tous corps d'état marseille, aménagement sur mesure marseille";
    if (metaKeywords) {
      metaKeywords.setAttribute("content", keywords);
    } else {
      const meta = document.createElement('meta');
      meta.name = "keywords";
      meta.content = keywords;
      document.head.appendChild(meta);
    }
  }, []);

  const { data: prestations = [], isLoading } = useQuery({
    queryKey: ['prestations'],
    queryFn: () => base44.entities.Prestation.filter({ visible: true }, 'ordre'),
  });

  const { data: projets = [] } = useQuery({
    queryKey: ['projets-all'],
    queryFn: () => base44.entities.Projet.filter({ visible: true }, 'ordre'),
  });

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
  ] : [];

  const handlePrevImage = () => {
    setCurrentImageIndex((prev) => (prev === 0 ? allImages.length - 1 : prev - 1));
  };

  const handleNextImage = () => {
    setCurrentImageIndex((prev) => (prev === allImages.length - 1 ? 0 : prev + 1));
  };

  const getImageLabel = (imageUrl, imageIndex) => {
    const storedLabel = allLabels[imageIndex];
    if (storedLabel === "avant") return "AVANT";
    if (storedLabel === "apres") return "APRÈS";
    
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
    <div className="min-h-screen bg-stone-50">
      {/* Hero Section - RÉDUIT ET AFFINÉ */}
      <section ref={heroRef} className="relative min-h-[60vh] -mt-12 md:-mt-16 flex items-center justify-center overflow-hidden bg-gradient-to-br from-stone-950 via-stone-900 to-amber-900 pt-16 md:pt-20">
        <div className="absolute -top-24 left-0 right-0 h-[140%] bg-gradient-to-b from-stone-950 via-stone-900/80 to-stone-900/0 pointer-events-none" />
        {/* Grille subtile */}
        <div className="absolute inset-0 opacity-[0.03]">
          <div className="absolute inset-0" style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
                             linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)`,
            backgroundSize: '50px 50px'
          }}></div>
        </div>

        {/* Effets lumineux */}
        <div className="absolute bottom-0 left-0 w-[360px] h-[360px] bg-amber-500/12 rounded-full blur-[90px] animate-pulse" style={{ animationDelay: '0.8s' }}></div>

        {/* Effets lumineux - Plus subtils */}
        <div className="absolute top-1/4 right-1/4 w-80 h-80 bg-amber-600/15 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-1/4 left-1/4 w-64 h-64 bg-amber-500/10 rounded-full blur-[80px]"></div>

        <div className={`relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center transition-all duration-1000 ${
          heroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
        }`}>
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-full mb-6">
            <Briefcase className="w-4 h-4 text-amber-300" />
            <span className="text-sm font-medium text-white">Nos Services</span>
          </div>

          {/* Titre */}
          <h1 className="text-4xl md:text-6xl font-bold mb-5 text-white">
            Prestations de Qualité
          </h1>

          {/* Sous-titre */}
          <p className="text-base md:text-lg text-stone-300 max-w-3xl mx-auto leading-relaxed">
            Artisan multiservice pour tous vos travaux d'aménagement et de rénovation<br />
            à <span className="text-white font-semibold">Marseille</span>, <span className="text-white font-semibold">Aix-en-Provence</span> et dans les <span className="text-white font-semibold">Bouches-du-Rhône</span>
          </p>
        </div>
      </section>

      {/* Prestations List */}
      <section className="py-16 md:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {isLoading ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Card key={i} className="border-none shadow-lg">
                  <CardContent className="p-4 md:p-8">
                    <Skeleton className="w-10 h-10 md:w-14 md:h-14 rounded-xl mb-3 md:mb-6" />
                    <Skeleton className="h-5 md:h-8 w-3/4 mb-2 md:mb-4" />
                    <Skeleton className="h-3 md:h-4 w-full mb-2" />
                    <Skeleton className="h-3 md:h-4 w-full mb-2" />
                    <Skeleton className="h-3 md:h-4 w-2/3 mb-3 md:mb-6" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : prestations.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-20 h-20 md:w-24 md:h-24 bg-stone-200 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10 md:w-12 md:h-12 text-stone-400" />
              </div>
              <h3 className="text-xl md:text-2xl font-bold text-stone-800 mb-4">Aucune prestation disponible</h3>
              <p className="text-stone-600">Les prestations seront bientôt ajoutées.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8">
              {prestations.map((prestation, index) => (
                <Card 
                  key={prestation.id} 
                  className="border-none shadow-xl hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 bg-white group"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <CardContent className="p-4 md:p-8">
                    <div className="w-10 h-10 md:w-16 md:h-16 bg-gradient-to-br from-amber-700 to-amber-900 rounded-xl md:rounded-2xl flex items-center justify-center mb-3 md:mb-6 transform group-hover:rotate-6 transition-transform duration-300 shadow-lg">
                      <CheckCircle2 className="w-5 h-5 md:w-8 md:h-8 text-white" />
                    </div>

                    <h3 className="text-sm md:text-2xl font-bold text-stone-800 mb-2 md:mb-4 group-hover:text-amber-800 transition-colors leading-tight">
                      {prestation.titre}
                    </h3>

                    <p className="text-xs md:text-base text-stone-600 mb-3 md:mb-6 leading-relaxed line-clamp-3 md:line-clamp-none min-h-[60px] md:min-h-[100px]">
                      {prestation.description}
                    </p>

                    {prestation.duree_estimee && (
                      <div className="pt-3 md:pt-6 border-t border-stone-200">
                        <div className="flex items-center gap-2 text-stone-600">
                          <Clock className="w-3 h-3 md:w-5 md:h-5 text-amber-700 flex-shrink-0" />
                          <span className="text-xs md:text-base">{prestation.duree_estimee}</span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Mes Réalisations */}
      {projets.length > 0 && (
        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold text-stone-800 mb-4">Mes Réalisations</h2>
              <p className="text-xl text-stone-600">Découvrez mes projets avant/après</p>
              <div className="w-24 h-1 bg-amber-700 mx-auto mt-4"></div>
            </div>
            
            <div className="relative">
              <div className="overflow-x-auto pb-8 hide-scrollbar">
                <div className="flex gap-6" style={{ minWidth: 'min-content' }}>
                  {projets.map((projet, index) => (
                    <div 
                      key={projet.id}
                      className="flex-shrink-0 w-80 cursor-pointer group"
                      onClick={() => handleProjetClick(projet)}
                    >
                      <Card className="border-none shadow-xl hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 bg-white overflow-hidden">
                        <div className="relative h-96 overflow-hidden">
                          <img
                            src={projet.image_url}
                            alt={projet.titre}
                            className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-stone-900/90 via-stone-900/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex flex-col justify-end p-6">
                            <Badge className="mb-3 w-fit bg-amber-700 text-white border-none text-sm">
                              {projet.categorie}
                            </Badge>
                            <h3 className="text-white font-bold text-2xl mb-2">{projet.titre}</h3>
                            <p className="text-stone-200 text-sm">Cliquez pour voir avant/après</p>
                          </div>
                        </div>
                        <CardContent className="p-6">
                          <div className="flex items-center justify-between">
                            <Badge className="bg-amber-100 text-amber-800 border-none">
                              {projet.categorie}
                            </Badge>
                            {projet.annee && (
                              <span className="text-sm text-stone-500">{projet.annee}</span>
                            )}
                          </div>
                          <h3 className="text-xl font-bold text-stone-800 mt-3">{projet.titre}</h3>
                        </CardContent>
                      </Card>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Process Section */}
      <section className="py-16 md:py-20 bg-stone-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 md:mb-16">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-stone-800 mb-4">
              Votre projet de A à Z dans les Bouches-du-Rhône
            </h2>
            <p className="text-xl text-stone-600">
              Un accompagnement professionnel pour tous vos travaux de rénovation et d'aménagement
            </p>
            <div className="w-24 h-1 bg-amber-700 mx-auto"></div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
            {[
              { etape: "01", titre: "Consultation", description: "Échange sur vos besoins et vos envies" },
              { etape: "02", titre: "Conception", description: "Élaboration des plans et du design" },
              { etape: "03", titre: "Réalisation", description: "Exécution des travaux avec soin" },
              { etape: "04", titre: "Livraison", description: "Remise des clés de votre nouvel espace" },
            ].map((step, index) => (
              <div key={index} className="text-center">
                <div className="w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br from-amber-700 to-amber-900 text-white rounded-full flex items-center justify-center text-2xl md:text-3xl font-bold mx-auto mb-3 md:mb-4 shadow-xl">
                  {step.etape}
                </div>
                <h3 className="text-base md:text-xl font-bold text-stone-800 mb-1 md:mb-2">{step.titre}</h3>
                <p className="text-xs md:text-base text-stone-600">{step.description}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <Card className="border-none shadow-xl bg-white inline-block">
              <CardContent className="p-8">
                <p className="text-stone-700 leading-relaxed max-w-4xl">
                  <strong>Artisan professionnel</strong> basé à Marseille, j'interviens pour tous vos 
                  <strong> travaux de rénovation</strong>, <strong>d'aménagement</strong> et de 
                  <strong> décoration intérieure</strong> à Marseille, Allauch, Plan-de-Cuques, Aubagne, 
                  La Ciotat, Bandol, Cassis, Peypin, Aix-en-Provence et dans toute la région. 
                  Spécialisé en <strong>conception 3D</strong>, <strong>plâtrerie</strong>, 
                  <strong> menuiserie</strong>, <strong>peinture</strong>, <strong>carrelage</strong> 
                  et <strong>pose de parquet</strong>, je vous garantis un travail de qualité et 
                  des finitions impeccables.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Modal Projet avec Avant/Après */}
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
                          <img src={img} alt={`Miniature ${idx + 1}`} className="w-full h-full object-cover" />
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

                  <div className="grid md:grid-cols-2 gap-3 md:gap-4 mb-6 md:mb-8">
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

