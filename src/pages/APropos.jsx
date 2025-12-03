
import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Award, Heart, Lightbulb, Target, ArrowRight, Zap, Hammer, Wrench, Ruler } from "lucide-react";

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

export default function APropos() {
  const [heroRef, heroVisible] = useScrollAnimation({ threshold: 0.05 });

  // SEO Meta Tags
  useEffect(() => {
    document.title = "À Propos - Artisan Passionné Rénovation Intérieur Marseille | L'Atelier des Espaces";
    
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute("content", "Découvrez mon parcours d'artisan passionné par la rénovation et l'aménagement intérieur. CAP électricien, expérience en rénovation complète. Valeurs, expertise et engagement au service de vos projets à Marseille et dans les Bouches-du-Rhône.");
    } else {
      const meta = document.createElement('meta');
      meta.name = "description";
      meta.content = "Découvrez mon parcours d'artisan passionné par la rénovation et l'aménagement intérieur. CAP électricien, expérience en rénovation complète. Valeurs, expertise et engagement au service de vos projets à Marseille et dans les Bouches-du-Rhône.";
      document.head.appendChild(meta);
    }

    const metaKeywords = document.querySelector('meta[name="keywords"]');
    const keywords = "artisan marseille, artisan passionné marseille, rénovateur marseille, spécialiste rénovation marseille, expert aménagement intérieur marseille, artisan qualifié marseille, professionnel rénovation marseille, artisan bouches-du-rhône, cap électricien marseille, rénovation complète marseille";
    if (metaKeywords) {
      metaKeywords.setAttribute("content", keywords);
    } else {
      const meta = document.createElement('meta');
      meta.name = "keywords";
      meta.content = keywords;
      document.head.appendChild(meta);
    }
  }, []);

  const valeurs = [
    {
      icon: Heart,
      titre: "Passion du métier",
      description: "La rénovation n'est pas qu'un travail, c'est ma vocation et ma fierté"
    },
    {
      icon: Award,
      titre: "Excellence & rigueur",
      description: "Un travail soigné et des finitions irréprochables à chaque chantier"
    },
    {
      icon: Lightbulb,
      titre: "Solutions créatives",
      description: "Des idées innovantes pour optimiser votre espace et votre budget"
    },
    {
      icon: Target,
      titre: "Engagement total",
      description: "Un accompagnement personnalisé et le respect des délais"
    }
  ];

  const competences = [
    {
      icon: Zap,
      titre: "Électricité",
      description: "CAP électricien - Installation complète, mise aux normes, dépannage"
    },
    {
      icon: Hammer,
      titre: "Second œuvre",
      description: "Plâtrerie, cloisons, isolation, menuiserie intérieure"
    },
    {
      icon: Wrench,
      titre: "Finitions",
      description: "Peinture, carrelage, parquet, revêtements muraux"
    },
    {
      icon: Ruler,
      titre: "Conception",
      description: "Plans 3D, scan, conseil en aménagement d'espace"
    }
  ];

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

        <div className="absolute bottom-0 left-0 w-[360px] h-[360px] bg-amber-500/12 rounded-full blur-[90px] animate-pulse" style={{ animationDelay: '0.8s' }}></div>
        {/* Effets lumineux - Plus subtils */}
        <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-amber-600/15 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-amber-500/10 rounded-full blur-[80px]"></div>

        <div className={`relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center transition-all duration-1000 ${
          heroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
        }`}>
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-full mb-6">
            <Heart className="w-4 h-4 text-amber-300" />
            <span className="text-sm font-medium text-white">À Propos</span>
          </div>

          {/* Titre */}
          <h1 className="text-4xl md:text-6xl font-bold mb-5 text-white">
            L'Art de la Rénovation
          </h1>

          {/* Sous-titre */}
          <p className="text-xl md:text-2xl font-light mb-6 bg-gradient-to-r from-amber-300 via-amber-200 to-amber-400 bg-clip-text text-transparent">
            au Service de Votre Intérieur
          </p>

          <p className="text-base md:text-lg text-stone-300 max-w-3xl mx-auto leading-relaxed">
            Artisan électricien qualifié et passionné de rénovation,<br />
            je transforme vos espaces avec expertise et créativité
          </p>
        </div>
      </section>

      {/* Mon Histoire - PHOTO CHANGÉE */}
      <section className="py-16 md:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
            <div className="order-2 md:order-1">
              <img
                src="https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&h=1000&fit=crop"
                alt="Artisan travaux rénovation Marseille"
                className="w-full h-[400px] md:h-[600px] object-cover rounded-2xl shadow-2xl"
              />
            </div>
            <div className="order-1 md:order-2">
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-stone-800 mb-4 md:mb-6">Mon Parcours</h2>
              <div className="w-24 h-1 bg-amber-700 mb-6 md:mb-8"></div>
              <div className="space-y-4 md:space-y-6 text-base md:text-lg text-stone-700 leading-relaxed">
                <p>
                  Diplômé d'un <strong>CAP électricien</strong>, ma passion pour l'artisanat et 
                  la transformation d'espaces m'a naturellement conduit vers la <strong>rénovation complète</strong>. 
                  Ce qui a commencé par l'électricité s'est progressivement étendu à tous les corps d'état: 
                  plâtrerie, menuiserie, peinture, carrelage...
                </p>
                <p>
                  Aujourd'hui, je maîtrise l'ensemble du processus de <strong>rénovation intérieure</strong>, 
                  de la <strong>conception 3D</strong> aux dernières finitions. Chaque projet est pour moi 
                  l'occasion de mettre en pratique mon expertise technique et ma vision créative pour 
                  créer des intérieurs qui allient <strong>fonctionnalité</strong>, <strong>esthétique</strong> 
                  et <strong>qualité d'exécution</strong>.
                </p>
                <p>
                  Ce qui me motive ? Voir la satisfaction de mes clients lorsqu'ils découvrent 
                  leur espace transformé. Que vous soyez à <strong>Marseille</strong>, 
                  <strong> Aix-en-Provence</strong>, <strong>Aubagne</strong>, <strong>Allauch</strong> 
                  ou <strong>La Ciotat</strong>, je me déplace pour concrétiser vos projets 
                  avec le même engagement et la même exigence de qualité.
                </p>
                <div className="bg-amber-50 border-l-4 border-amber-700 p-4 md:p-6 rounded-r-lg">
                  <p className="text-amber-900 font-semibold italic text-base md:text-lg">
                    "De l'électricité à la décoration finale, je prends en charge votre projet 
                    dans sa globalité pour vous garantir un résultat cohérent et harmonieux."
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Mes Compétences */}
      <section className="py-16 md:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 md:mb-16">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-stone-800 mb-4">Mes Compétences</h2>
            <p className="text-base md:text-xl text-stone-600 max-w-2xl mx-auto">
              Une expertise complète en rénovation, de l'électricité aux finitions
            </p>
            <div className="w-24 h-1 bg-amber-700 mx-auto mt-4"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
            {competences.map((competence, index) => (
              <Card key={index} className="border-none shadow-xl hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 bg-white group">
                <CardContent className="p-6 md:p-8 text-center">
                  <div className="w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br from-amber-700 to-amber-900 rounded-2xl flex items-center justify-center mx-auto mb-4 md:mb-6 transform group-hover:rotate-6 group-hover:scale-110 transition-all duration-300 shadow-lg">
                    <competence.icon className="w-8 h-8 md:w-10 md:h-10 text-white" />
                  </div>
                  <h3 className="text-lg md:text-xl font-bold text-stone-800 mb-2 md:mb-3 group-hover:text-amber-800 transition-colors">
                    {competence.titre}
                  </h3>
                  <p className="text-sm md:text-base text-stone-600 leading-relaxed">
                    {competence.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Formation & Expérience */}
      <section className="py-16 md:py-20 bg-stone-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 md:mb-16">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-stone-800 mb-4">Formation & Expérience</h2>
            <div className="w-24 h-1 bg-amber-700 mx-auto"></div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
            {/* Formation */}
            <Card className="border-none shadow-2xl bg-white overflow-hidden group hover:shadow-amber-700/20 transition-all duration-500">
              <div className="bg-gradient-to-br from-amber-700 to-amber-900 p-6 md:p-8">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 bg-white/20 rounded-xl flex items-center justify-center">
                    <Award className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-2xl md:text-3xl font-bold text-white">Formation</h3>
                </div>
                <p className="text-amber-100 text-lg">
                  Diplômé et qualifié
                </p>
              </div>
              <CardContent className="p-6 md:p-8">
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="w-3 h-3 bg-amber-700 rounded-full mt-2 flex-shrink-0"></div>
                    <div>
                      <h4 className="font-bold text-stone-800 text-lg mb-1">CAP Électricien</h4>
                      <p className="text-stone-600">
                        Formation professionnelle complète en installations électriques, 
                        mise aux normes et dépannage
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-3 h-3 bg-amber-700 rounded-full mt-2 flex-shrink-0"></div>
                    <div>
                      <h4 className="font-bold text-stone-800 text-lg mb-1">Formation continue</h4>
                      <p className="text-stone-600">
                        Perfectionnement constant dans tous les domaines de la rénovation: 
                        plâtrerie, menuiserie, revêtements, décoration
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-3 h-3 bg-amber-700 rounded-full mt-2 flex-shrink-0"></div>
                    <div>
                      <h4 className="font-bold text-stone-800 text-lg mb-1">Conception 3D</h4>
                      <p className="text-stone-600">
                        Maîtrise des outils de modélisation et scan 3D pour la planification 
                        de projets
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Expérience */}
            <Card className="border-none shadow-2xl bg-white overflow-hidden group hover:shadow-amber-700/20 transition-all duration-500">
              <div className="bg-gradient-to-br from-stone-800 to-stone-900 p-6 md:p-8">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 bg-white/20 rounded-xl flex items-center justify-center">
                    <Hammer className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-2xl md:text-3xl font-bold text-white">Expérience</h3>
                </div>
                <p className="text-stone-300 text-lg">
                  Des années de pratique terrain
                </p>
              </div>
              <CardContent className="p-6 md:p-8">
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="w-3 h-3 bg-amber-700 rounded-full mt-2 flex-shrink-0"></div>
                    <div>
                      <h4 className="font-bold text-stone-800 text-lg mb-1">Rénovations complètes</h4>
                      <p className="text-stone-600">
                        Nombreux projets de rénovation totale: cuisines, salles de bain, 
                        appartements, maisons
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-3 h-3 bg-amber-700 rounded-full mt-2 flex-shrink-0"></div>
                    <div>
                      <h4 className="font-bold text-stone-800 text-lg mb-1">Projets variés</h4>
                      <p className="text-stone-600">
                        De la petite rénovation aux chantiers d'envergure, chaque projet 
                        enrichit mon expertise
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-3 h-3 bg-amber-700 rounded-full mt-2 flex-shrink-0"></div>
                    <div>
                      <h4 className="font-bold text-stone-800 text-lg mb-1">Clients satisfaits</h4>
                      <p className="text-stone-600">
                        Des recommandations et une réputation bâtie sur la qualité et 
                        le professionnalisme
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Mes Valeurs */}
      <section className="py-16 md:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 md:mb-16">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-stone-800 mb-4">Mes Valeurs</h2>
            <p className="text-base md:text-xl text-stone-600 max-w-2xl mx-auto">
              Les principes qui guident chacune de mes interventions
            </p>
            <div className="w-24 h-1 bg-amber-700 mx-auto mt-4"></div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8">
            {valeurs.map((valeur, index) => (
              <Card key={index} className="border-none shadow-xl hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 bg-gradient-to-br from-white to-stone-50">
                <CardContent className="p-4 md:p-8 text-center">
                  <div className="w-12 h-12 md:w-16 md:h-16 bg-gradient-to-br from-amber-700 to-amber-900 rounded-2xl flex items-center justify-center mx-auto mb-4 md:mb-6 transform hover:rotate-6 transition-transform duration-300">
                    <valeur.icon className="w-6 h-6 md:w-8 md:h-8 text-white" />
                  </div>
                  <h3 className="text-base md:text-xl font-bold text-stone-800 mb-2 md:mb-3">{valeur.titre}</h3>
                  <p className="text-xs md:text-base text-stone-600 leading-relaxed">{valeur.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pourquoi me choisir */}
      <section className="py-16 md:py-20 bg-gradient-to-br from-stone-100 to-stone-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 md:mb-16">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-stone-800 mb-4">
              Pourquoi Choisir un Artisan Passionné ?
            </h2>
            <div className="w-24 h-1 bg-amber-700 mx-auto"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {[
              {
                titre: "Expertise technique",
                description: "CAP électricien + années d'expérience en rénovation = maîtrise complète du métier"
              },
              {
                titre: "Vision globale",
                description: "Je gère votre projet de A à Z, de la conception aux derniers détails"
              },
              {
                titre: "Qualité artisanale",
                description: "Chaque détail compte. Je ne livre que des travaux dont je suis fier"
              },
              {
                titre: "Conseil personnalisé",
                description: "J'étudie votre projet en profondeur pour vous proposer les meilleures solutions"
              },
              {
                titre: "Transparence",
                description: "Devis détaillés, communication claire, pas de surprise"
              },
              {
                titre: "Respect des délais",
                description: "Organisation rigoureuse pour tenir les plannings convenus"
              }
            ].map((item, index) => (
              <Card key={index} className="border-none shadow-xl hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 bg-white">
                <CardContent className="p-6 md:p-8">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-2 h-2 bg-amber-700 rounded-full"></div>
                    <h3 className="text-lg md:text-xl font-bold text-stone-800">{item.titre}</h3>
                  </div>
                  <p className="text-sm md:text-base text-stone-600 leading-relaxed">
                    {item.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-16 md:py-20 bg-gradient-to-r from-amber-900 via-amber-800 to-amber-900 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%23ffffff" fill-opacity="1"%3E%3Cpath d="M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }}></div>
        </div>
        
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6">
            Un Projet de Rénovation en Tête ?
          </h2>
          <p className="text-lg md:text-xl text-amber-100 mb-10 leading-relaxed">
            Discutons-en ensemble ! Je vous accompagne avec passion et professionnalisme 
            pour transformer votre intérieur.
          </p>
          <Link to={createPageUrl("Contact")}>
            <Button size="lg" className="bg-white text-amber-900 hover:bg-stone-100 px-10 py-6 text-lg shadow-2xl transform hover:scale-110 hover:rotate-2 transition-all duration-300">
              Demander un devis gratuit
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}


