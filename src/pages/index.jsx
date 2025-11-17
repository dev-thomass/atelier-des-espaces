import Layout from "./Layout.jsx";

import Accueil from "./Accueil";

import Prestations from "./Prestations";

import APropos from "./APropos";

import Contact from "./Contact";

import Conception3D from "./Conception3D";

import Admin from "./Admin";

import AdminLogin from "./AdminLogin";

import Gestion from "./Gestion";

import N8nTest from "./N8nTest";

import N8nChatbot from "./N8nChatbot";

import N8nInterface from "./N8nInterface";

import N8nHub from "./N8nHub";

import N8nAgent from "./N8nAgent";

import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';

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
    
    N8nHub: N8nHub,
    
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
            <Routes>            
                
                    <Route path="/" element={<Accueil />} />
                
                
                <Route path="/Accueil" element={<Accueil />} />
                
                <Route path="/Prestations" element={<Prestations />} />
                
                <Route path="/APropos" element={<APropos />} />
                
                <Route path="/Contact" element={<Contact />} />
                
                <Route path="/Conception3D" element={<Conception3D />} />
                
                <Route path="/Admin" element={<Admin />} />
                
                <Route path="/AdminLogin" element={<AdminLogin />} />
                
                <Route path="/Gestion" element={<Gestion />} />
                
                <Route path="/N8nTest" element={<N8nTest />} />
                
                <Route path="/N8nChatbot" element={<N8nChatbot />} />
                
                <Route path="/N8nInterface" element={<N8nInterface />} />
                
                <Route path="/N8nHub" element={<N8nHub />} />
                
                <Route path="/N8nAgent" element={<N8nAgent />} />
                
            </Routes>
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