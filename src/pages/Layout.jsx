

import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Home, User, Mail, Phone, MapPin, Briefcase, Box, Menu, X, Shield, ArrowLeft, Globe, LayoutDashboard, Calendar, Wrench, Zap } from "lucide-react";

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  
  // DETECTION TRES AGRESSIVE DES PAGES ADMIN
  const path = location.pathname.toLowerCase();
  const pageName = (currentPageName || '').toLowerCase();
  
  const isAdmin = 
    path.includes('gestion') ||
    path.includes('adminlogin') || 
    path.includes('admin') ||
    path.includes('n8nhub') ||
    path.includes('n8ntest') ||
    path.includes('n8nchatbot') ||
    path.includes('n8ninterface') ||
    path.includes('n8nagent') || // AJOUT
    pageName === 'gestion' ||
    pageName === 'adminlogin' ||
    pageName === 'admin' ||
    pageName === 'n8nhub' ||
    pageName === 'n8ntest' ||
    pageName === 'n8nchatbot' ||
    pageName === 'n8ninterface' ||
    pageName === 'n8nagent'; // AJOUT

  // SI ADMIN : PAS DE HEADER, JUSTE LE CONTENU + FOOTER MINIMAL
  if (isAdmin) {
    return (
      <div className="min-h-screen flex flex-col admin-surface bg-[radial-gradient(circle_at_20%_25%,rgba(59,130,246,0.12),transparent_38%),radial-gradient(circle_at_80%_10%,rgba(16,185,129,0.12),transparent_32%),radial-gradient(circle_at_50%_80%,rgba(14,26,51,0.55),rgba(5,9,21,0.85))] bg-[#0b1529] text-slate-100">
        <main className="flex-1 w-full">
          {children}
        </main>
        
        {/* Footer minimal pour pages admin */}
        <footer className="glass-dark text-white py-6 border-t border-white/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <img 
                  src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6901ebfc5e146f4dd7ae429a/2828a036b_Designsanstitre1.png"
                  alt="L'Atelier des Espaces"
                  className="w-8 h-8 shadow-apple rounded-lg"
                />
                <div>
                  <h3 className="text-sm font-bold text-white">L'Atelier des Espaces</h3>
                  <p className="text-xs text-slate-300">Espace Administration</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <Link
                  to={createPageUrl("Accueil")}
                  className="text-sm text-amber-300 hover:text-amber-200 transition-colors flex items-center gap-2"
                >
                  <Globe className="w-4 h-4" />
                  Voir le site web
                </Link>
              </div>

              <p className="text-xs text-slate-400">
                &copy; {new Date().getFullYear()} - Tous droits reserves
              </p>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  // TOUT LE RESTE EST POUR LE SITE PUBLIC
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [scrolled, setScrolled] = useState(false);
  const [heroHeight, setHeroHeight] = useState(520);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  useEffect(() => {
    const measure = () => {
      const hero = document.getElementById('layout-hero-overlay');
      if (hero) {
        setHeroHeight(hero.getBoundingClientRect().height || 520);
      }
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      // Accueil plus long : bascule plus tard pour ne changer qu'en bas du hero
      const isAccueil =
        path === '/' ||
        path.includes('accueil') ||
        pageName === 'accueil';
      const threshold = isAccueil
        ? Math.max(heroHeight * 1.3, 360)
        : Math.max(heroHeight * 0.85, 200);
      setScrolled(window.scrollY > threshold);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [heroHeight, path, pageName]);

  useEffect(() => {
    const checkUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        setUser(null);
      }
    };
    checkUser();
  }, []);

  const navigation = [
    { name: "Accueil", url: createPageUrl("Accueil"), icon: Home },
    { name: "Prestations", url: createPageUrl("Prestations"), icon: Briefcase },
    { name: "Conception 3D", url: createPageUrl("Conception3D"), icon: Box },
    { name: "A Propos", url: createPageUrl("APropos"), icon: User },
    { name: "Contact", url: createPageUrl("Contact"), icon: Mail },
  ];

  const isActive = (url) => location.pathname === url;

  return (
    <div className="relative min-h-screen bg-transparent overflow-hidden">
      {/* Fond anime identique a l'accueil pour toutes les pages publiques */}
      <div
        id="layout-hero-overlay"
        className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-gradient-to-br from-stone-950 via-stone-900 to-amber-900"
      >
        <div className="absolute -top-32 left-0 right-0 h-[180%] bg-gradient-to-b from-stone-950 via-stone-900/85 to-stone-900/0" />
        <div className="absolute inset-0 opacity-[0.03]">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
                               linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)`,
              backgroundSize: "50px 50px",
            }}
          ></div>
        </div>
        <div className="absolute -top-20 -right-24 w-[520px] h-[520px] bg-amber-600/25 rounded-full blur-[120px] animate-pulse"></div>
        <div
          className="absolute -bottom-16 -left-24 w-[480px] h-[480px] bg-amber-500/15 rounded-full blur-[100px] animate-pulse"
          style={{ animationDelay: "0.8s" }}
        ></div>
      </div>

      <style>{`
        :root {
          --primary: #78350f;
          --primary-dark: #451a03;
          --accent: #d97706;
        }
        
        .glass-nav {
          backdrop-filter: blur(20px) saturate(180%);
          -webkit-backdrop-filter: blur(20px) saturate(180%);
        }
      `}</style>

      {/* Navigation */}
      <nav
        className={`glass-nav fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-transparent border-transparent shadow-none backdrop-blur-0'
            : 'bg-transparent border-transparent shadow-none'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <Link to={createPageUrl("Accueil")} className="flex items-center gap-3 group">
              <img
                src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6901ebfc5e146f4dd7ae429a/2828a036b_Designsanstitre1.png"
                alt="L'Atelier des Espaces"
                className="w-12 h-12 transform group-hover:scale-105 transition-transform duration-300"
              />
              <div className="flex flex-col">
                <div
                  className="text-lg md:text-xl font-bold leading-tight bg-gradient-to-r from-amber-600 via-amber-700 to-amber-900 bg-clip-text text-transparent"
                >
                  L'Atelier des Espaces
                </div>
                <div
                  className={`text-xs md:text-sm font-medium ${
                    scrolled ? "text-stone-600" : "text-stone-200"
                  }`}
                >
                  Artisan d'interieur
                </div>
              </div>
            </Link>

            <div className="hidden md:flex items-center gap-1">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.url}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-300 ${
                    isActive(item.url)
                      ? scrolled
                        ? "bg-amber-900 text-white shadow-lg shadow-amber-900/30"
                        : "bg-amber-900 text-white shadow-lg shadow-amber-900/30"
                      : scrolled
                        ? "text-stone-900 hover:bg-stone-100/70 hover:text-amber-900"
                        : "text-white hover:text-white hover:bg-white/10"
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  <span className="font-medium text-sm">{item.name}</span>
                </Link>
              ))}
            </div>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className={`md:hidden p-2.5 rounded-xl transition-all duration-300 ${
                scrolled
                  ? "text-stone-700 hover:bg-stone-100/70"
                  : "text-stone-100 hover:text-white hover:bg-white/10"
              }`}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div
            className={`md:hidden glass-nav border-t ${
              scrolled
                ? "bg-white/90 border-stone-200/50"
                : "bg-stone-900/95 border-white/10"
            }`}
          >
            <div className="px-4 py-4 space-y-2">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.url}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${
                    isActive(item.url)
                      ? "bg-amber-900 text-white shadow-lg shadow-amber-900/30"
                      : scrolled
                        ? "text-stone-700 hover:bg-stone-100/70"
                        : "text-white hover:text-white hover:bg-white/10"
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="font-medium">{item.name}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </nav>

      <main className="relative z-10 pt-20">{children}</main>

      {/* Footer */}
      <footer className="bg-gradient-to-r from-stone-900 via-amber-900 to-stone-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <img 
                  src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6901ebfc5e146f4dd7ae429a/2828a036b_Designsanstitre1.png"
                  alt="L'Atelier des Espaces"
                  className="w-10 h-10"
                />
                <div>
                  <h3 className="text-xl font-bold text-amber-100">L'Atelier des Espaces</h3>
                  <p className="text-sm text-stone-300">Artisan d'interieur</p>
                </div>
              </div>
              <p className="text-stone-300 leading-relaxed">
                Specialiste en amenagement et renovation d'interieur, nous transformons vos espaces en lieux uniques et fonctionnels.
              </p>
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-4 text-amber-100">Navigation</h4>
              <ul className="space-y-2">
                {navigation.map((item) => (
                  <li key={item.name}>
                    <Link
                      to={item.url}
                      className="text-stone-300 hover:text-amber-100 transition-colors duration-300"
                    >
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-4 text-amber-100">Contact</h4>
              <ul className="space-y-2 text-stone-300">
                <li className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-amber-200" />
                  <span>contact@atelierdesespaces.fr</span>
                </li>
                <li className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-amber-200" />
                  <span>06 95 07 10 84</span>
                </li>
                <li className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-amber-200" />
                  <span>Bouches-du-Rhone, France</span>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-stone-700 mt-8 pt-8">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <p className="text-center text-stone-400">
                &copy; {new Date().getFullYear()} L'Atelier des Espaces. Tous droits reserves.
              </p>
              <Link
                to={createPageUrl("AdminLogin")}
                className="text-xs text-stone-500 hover:text-amber-300 transition-colors"
              >
                Espace Administration
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}









