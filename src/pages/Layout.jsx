

import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "./utils";
import { base44 } from "@/api/base44Client";
import { Home, User, Mail, Briefcase, Box, Menu, X, Shield, ArrowLeft, Globe, LayoutDashboard, Calendar, Wrench, Zap } from "lucide-react";

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  
  // DÉTECTION TRÈS AGRESSIVE DES PAGES ADMIN
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
      <div className="min-h-screen bg-neutral-50 flex flex-col">
        <main className="flex-1 p-6">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
        
        {/* Footer minimal pour pages admin */}
        <footer className="bg-gradient-to-r from-neutral-900 via-neutral-800 to-neutral-900 text-white py-6 border-t border-neutral-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <img 
                  src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6901ebfc5e146f4dd7ae429a/2828a036b_Designsanstitre1.png"
                  alt="L'Atelier des Espaces"
                  className="w-8 h-8"
                />
                <div>
                  <h3 className="text-sm font-bold text-white">L'Atelier des Espaces</h3>
                  <p className="text-xs text-neutral-400">Espace Administration</p>
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

              <p className="text-xs text-neutral-500">
                &copy; {new Date().getFullYear()} - Tous droits réservés
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

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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
    { name: "À Propos", url: createPageUrl("APropos"), icon: User },
    { name: "Contact", url: createPageUrl("Contact"), icon: Mail },
  ];

  const isActive = (url) => location.pathname === url;

  return (
    <div className="min-h-screen bg-stone-50">
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
      <nav className={`glass-nav fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled 
          ? 'bg-white/70 border-b border-stone-200/50 shadow-lg shadow-stone-900/5' 
          : 'bg-white/80 border-b border-200/30'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <Link to={createPageUrl("Accueil")} className="flex items-center gap-3 group">
              <img 
                src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6901ebfc5e146f4dd7ae429a/2828a036b_Designsanstitre1.png"
                alt="L'Atelier des Espaces"
                className="w-12 h-12 transform group-hover:scale-105 transition-transform duration-300"
              />
              <div className="flex flex-col">
                <div className="text-lg md:text-xl font-bold bg-gradient-to-r from-amber-900 via-amber-700 to-stone-900 bg-clip-text text-transparent leading-tight">
                  L'Atelier des Espaces
                </div>
                <div className="text-xs md:text-sm text-stone-600 font-medium">
                  Artisan d'intérieur
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
                      ? "bg-amber-900 text-white shadow-lg shadow-amber-900/30"
                      : "text-stone-700 hover:bg-stone-100/70 hover:text-amber-900"
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  <span className="font-medium text-sm">{item.name}</span>
                </Link>
              ))}
            </div>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2.5 rounded-xl text-stone-700 hover:bg-stone-100/70 transition-all duration-300"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden glass-nav bg-white/90 border-t border-stone-200/50">
            <div className="px-4 py-4 space-y-2">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.url}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${
                    isActive(item.url)
                      ? "bg-amber-900 text-white shadow-lg shadow-amber-900/30"
                      : "text-stone-700 hover:bg-stone-100/70"
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

      <main className="pt-20">{children}</main>

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
                  <p className="text-sm text-stone-300">Artisan d'intérieur</p>
                </div>
              </div>
              <p className="text-stone-300 leading-relaxed">
                Spécialiste en aménagement et rénovation d'intérieur, nous transformons vos espaces en lieux uniques et fonctionnels.
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
                <li>▸ contact@atelierdesespaces.fr</li>
                <li>▸ 06 95 07 10 84</li>
                <li>▸ Bouches-du-Rhône, France</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-stone-700 mt-8 pt-8">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <p className="text-center text-stone-400">
                &copy; {new Date().getFullYear()} L'Atelier des Espaces. Tous droits réservés.
              </p>
              <Link
                to={createPageUrl("AdminLogin")}
                className="text-xs text-stone-500 hover:text-amber-300 transition-colors"
              >
                🔒 Espace Administration
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

