import Layout from "./Layout.jsx";
import { lazy, Suspense } from "react";
import { BrowserRouter as Router, Route, Routes, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";

// Lazy-load pages to reduce initial bundle and accélérer le démarrage
const Accueil = lazy(() => import("./Accueil"));
const Prestations = lazy(() => import("./Prestations"));
const APropos = lazy(() => import("./APropos"));
const Contact = lazy(() => import("./Contact"));
const Conception3D = lazy(() => import("./Conception3D"));
const Admin = lazy(() => import("./Admin"));
const AdminLogin = lazy(() => import("./AdminLogin"));
const Gestion = lazy(() => import("./Gestion"));
const N8nTest = lazy(() => import("./N8nTest"));
const N8nChatbot = lazy(() => import("./N8nChatbot"));
const N8nInterface = lazy(() => import("./N8nInterface"));
const N8nAgent = lazy(() => import("./N8nAgent"));

const PAGES = {
    
    Accueil: Accueil,
    
    Prestations: Prestations,
    
    APropos: APropos,
    
    Contact: Contact,
    
    Conception3D: Conception3D,
    
    Admin: Admin,
    
    AdminLogin: AdminLogin,
    
    Gestion: Gestion,
    
    N8nTest: N8nTest,
    
    N8nChatbot: N8nChatbot,
    
    N8nInterface: N8nInterface,
    
    
    N8nAgent: N8nAgent,
    
}

function _getCurrentPage(url) {
    if (url.endsWith('/')) {
        url = url.slice(0, -1);
    }
    let urlLastPart = url.split('/').pop();
    if (urlLastPart.includes('?')) {
        urlLastPart = urlLastPart.split('?')[0];
    }

    const pageName = Object.keys(PAGES).find(page => page.toLowerCase() === urlLastPart.toLowerCase());
    return pageName || Object.keys(PAGES)[0];
}

// Create a wrapper component that uses useLocation inside the Router context
function PagesContent() {
    const location = useLocation();
  const currentPage = _getCurrentPage(location.pathname);
  
  return (
    <Layout currentPageName={currentPage}>
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-stone-600">Chargement...</div>}>
        <Routes>            
          <Route path="/" element={<Accueil />} />
          <Route path={createPageUrl("Accueil")} element={<Accueil />} />
          <Route path={createPageUrl("Prestations")} element={<Prestations />} />
          <Route path={createPageUrl("APropos")} element={<APropos />} />
          <Route path={createPageUrl("Contact")} element={<Contact />} />
          <Route path={createPageUrl("Conception3D")} element={<Conception3D />} />
          <Route path={createPageUrl("Admin")} element={<Admin />} />
          <Route path={createPageUrl("AdminLogin")} element={<AdminLogin />} />
          <Route path={createPageUrl("Gestion")} element={<Gestion />} />
          <Route path={createPageUrl("N8nTest")} element={<N8nTest />} />
          <Route path={createPageUrl("N8nChatbot")} element={<N8nChatbot />} />
          <Route path={createPageUrl("N8nInterface")} element={<N8nInterface />} />
          <Route path={createPageUrl("N8nAgent")} element={<N8nAgent />} />
          {/* Catch-all to avoid blank page on unknown routes */}
          <Route path="*" element={<Accueil />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}

export default function Pages() {
    return (
        <Router>
            <PagesContent />
        </Router>
    );
}
