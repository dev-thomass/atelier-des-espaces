
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { api } from "@/api/apiClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  LayoutDashboard,
  Globe,
  Briefcase,
  MessageSquare,
  Lightbulb,
  Calendar,
  ListChecks,
  Settings,
  Menu,
  X,
  CheckCircle2,
  AlertCircle,
  Shield,
  Wrench,
  Plus,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  Loader2,
  Search,
  LogOut,
  Send,
  GripVertical,
  ArrowUp,
  ArrowDown,
  ShoppingCart,
  Check,
  Package,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  User,
  FileText,
  MapPin,
  Sparkles,
  ArrowRight,
  Clock,
  LinkIcon,
  BookOpen,
  Copy,
  Sun,
  Moon
} from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import AdminProjetCard from "../components/admin/AdminProjetCard";
import AdminProjetForm from "../components/admin/AdminProjetForm";
import PlanningChatBot from "../components/admin/PlanningChatBot";
import ListesChatBot from "../components/admin/ListesChatBot";
import GestionChatBot from "../components/admin/GestionChatBot";
import { AdminHero } from "../components/admin/AdminHero";
import { useTheme } from "@/context/ThemeContext";

export default function Gestion() {
  const { theme } = useTheme();
  const [activeSection, setActiveSection] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showProjetForm, setShowProjetForm] = useState(false);
  const [editingProjet, setEditingProjet] = useState(null);
  
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const currentUser = await api.auth.me();
        setUser(currentUser);
        setIsLoading(false);
      } catch (error) {
        navigate(createPageUrl("AdminLogin"));
      }
    };
    checkAuth();
  }, [navigate]);

  const handleLogout = async () => {
    api.auth.logout();
    navigate(createPageUrl("Accueil"));
  };

  const { data: projets = [] } = useQuery({
    queryKey: ['admin-projets'],
    queryFn: () => api.entities.Projet.list('ordre'),
  });

  const { data: prestations = [] } = useQuery({
    queryKey: ['admin-prestations'],
    queryFn: () => api.entities.Prestation.list('ordre'),
  });

  const { data: conversationsProjet = [] } = useQuery({
    queryKey: ['admin-conversations-projet'],
    queryFn: async () => {
      try {
        return await api.agents.listConversations({ agent_name: "assistant_projet" }) || [];
      } catch (error) {
        return [];
      }
    },
  });

  const { data: conversationsChantier = [] } = useQuery({
    queryKey: ['admin-conversations-chantier'],
    queryFn: async () => {
      try {
        return await api.agents.listConversations({ agent_name: "assistant_suivi_chantier" }) || [];
      } catch (error) {
        return [];
      }
    },
  });

  const deleteProjetMutation = useMutation({
    mutationFn: (id) => api.entities.Projet.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-projets'] }),
  });

  const updateProjetMutation = useMutation({
    mutationFn: ({ id, data }) => api.entities.Projet.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-projets'] }),
  });

  const handleEditProjet = (projet) => {
    setEditingProjet(projet);
    setShowProjetForm(true);
  };

  const handleDeleteProjet = async (projet) => {
    if (confirm(`Supprimer "${projet.titre}" ?`)) {
      deleteProjetMutation.mutate(projet.id);
    }
  };

  const handleToggleProjetVisibility = async (projet) => {
    updateProjetMutation.mutate({
      id: projet.id,
      data: { visible: !projet.visible }
    });
  };

  const handleProjetFormSuccess = () => {
    setShowProjetForm(false);
    setEditingProjet(null);
    queryClient.invalidateQueries({ queryKey: ['admin-projets'] });
  };

  const handleProjetDragEnd = async (result) => {
    if (!result.destination) return;
    const sourceIndex = result.source.index;
    const destIndex = result.destination.index;
    if (sourceIndex === destIndex) return;

    const updates = [];
    const items = Array.from(filteredProjets);
    const [reorderedItem] = items.splice(sourceIndex, 1);
    items.splice(destIndex, 0, reorderedItem);

    items.forEach((projet, index) => {
      updates.push(api.entities.Projet.update(projet.id, { ordre: index }));
    });

    await Promise.all(updates);
    queryClient.invalidateQueries({ queryKey: ['admin-projets'] });
  };

  const moveProjet = async (index, direction) => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= filteredProjets.length) return;

    const projet1 = filteredProjets[index];
    const projet2 = filteredProjets[newIndex];

    await Promise.all([
      api.entities.Projet.update(projet1.id, { ordre: newIndex }),
      api.entities.Projet.update(projet2.id, { ordre: index })
    ]);

    queryClient.invalidateQueries({ queryKey: ['admin-projets'] });
  };

  const filteredProjets = projets.filter(projet =>
    projet.titre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    projet.categorie.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const navigation = [
    { id: "dashboard", label: "Tableau de bord", icon: LayoutDashboard, section: "main" },
    { id: "divider-pratique", label: "Gestion Pratique", section: "divider" },
    { id: "planning", label: "Planning", icon: Calendar, section: "pratique" },
    { id: "listes", label: "Listes", icon: ListChecks, section: "pratique" },
    { id: "assistant", label: "Assistant", icon: Lightbulb, section: "pratique" },
    { id: "divider-web", label: "Gestion Web", section: "divider" },
    { id: "projets", label: "Projets & Prestations", icon: Globe, section: "web" },
    { id: "assistant-client", label: "Assistant Client", icon: MessageSquare, section: "web" },
    { id: "divider-settings", label: "", section: "divider" },
    { id: "settings", label: "Parametres", icon: Settings, section: "settings" }
  ];

  const handleNavigation = useCallback((id) => {
    setActiveSection(id);
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  }, []);

  useEffect(() => {
    const handleCustomNavigation = (event) => {
      handleNavigation(event.detail);
    };
    window.addEventListener('navigate-section', handleCustomNavigation);
    return () => {
      window.removeEventListener('navigate-section', handleCustomNavigation);
    };
  }, [handleNavigation]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-neutral-700 animate-spin" />
      </div>
    );
  }

  const stats = {
    totalProjets: projets.length,
    projetsVisibles: projets.filter(p => p.visible).length,
    totalPrestations: prestations.length,
    prestationsVisibles: prestations.filter(p => p.visible).length,
    totalConversationsProjet: conversationsProjet.length,
    conversationsProjetsRecentes: conversationsProjet.filter(c => {
      const diffDays = (new Date().getTime() - new Date(c.created_date).getTime()) / (1000 * 60 * 60 * 24);
      return diffDays <= 7;
    }).length,
    totalConversationsChantier: conversationsChantier.length,
    conversationsChantierRecentes: conversationsChantier.filter(c => {
      const diffDays = (new Date().getTime() - new Date(c.created_date).getTime()) / (1000 * 60 * 60 * 24);
      return diffDays <= 7;
    }).length
  };

  return (
    <div
      className={`min-h-screen flex ${theme === "dark" ? "admin-textured-bg-dark" : "admin-textured-bg"}`}
      style={{ color: "var(--color-text-primary)" }}
    >
      <GestionChatBot />

      <aside
        className={`fixed lg:sticky top-0 left-0 h-screen admin-sidebar transition-all duration-300 z-50 shadow-lg ${sidebarOpen ? "w-64" : "w-0"} overflow-hidden`}
        style={{ borderRight: `1px solid var(--color-border-light)` }}
      >
        <div className="flex flex-col h-full w-64">
          <div className="px-4 sm:px-6 py-5 border-b flex-shrink-0" style={{ borderColor: "var(--color-border-light)" }}>
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 flex-shrink-0" color="var(--color-badge-primary-text)" />
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold truncate" style={{ color: "var(--color-text-inverse)" }}>Administration</h2>
                <p className="text-xs truncate" style={{ color: "var(--color-text-muted)" }}>{user?.full_name || user?.email || "Admin"}</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto py-4">
            <div className="space-y-1 px-4 sm:px-6">
              {navigation.map((item) => {
                if (item.section === "divider") {
                  return (
                    <div key={item.id} className="py-3 px-3">
                      {item.label && <p className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>{item.label}</p>}
                      {!item.label && <div className="border-t" style={{ borderColor: "var(--color-bg-sidebar-hover)" }} />}
                    </div>
                  );
                }

                const Icon = item.icon;
                const isActive = activeSection === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavigation(item.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all"
                    style={
                      isActive
                        ? {
                            backgroundColor: "var(--color-nav-item-bg-active)",
                            color: "var(--color-nav-item-text-active)",
                            boxShadow: "var(--shadow-md)",
                          }
                        : {
                            color: "var(--color-nav-item-text)",
                          }
                    }
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    <span className="text-sm font-medium truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </nav>

          <div className="px-4 sm:px-6 py-4 border-t flex-shrink-0" style={{ borderColor: "var(--color-border-light)" }}>
            <Button
              onClick={handleLogout}
              variant="outline"
              className="w-full btn-ghost"
              size="sm"
              style={{
                color: "var(--color-text-inverse)",
                borderColor: "var(--color-border-light)",
              }}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Deconnexion
            </Button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <header
        className="sticky top-0 z-40 border-b"
        style={{
          backgroundColor: "var(--color-bg-sidebar)",
          borderColor: "var(--color-bg-sidebar-hover)",
          boxShadow: "var(--shadow-sm)",
          color: "var(--color-text-inverse)",
        }}
      >
        <div className="px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <Button
                variant="ghost"
                size="icon"
                className="flex-shrink-0 btn-ghost"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                style={{ color: "var(--color-text-inverse)" }}
              >
                {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </Button>

              <div className="flex-1 min-w-0">
                <h1 className="text-lg sm:text-xl font-semibold truncate" style={{ color: "var(--color-text-inverse)" }}>
                  {navigation.find((n) => n.id === activeSection)?.label || "Tableau de bord"}
                </h1>
                <p className="text-xs sm:text-sm hidden sm:block" style={{ color: "var(--color-text-muted)" }}>
                  {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
                </p>
              </div>
            </div>

              <div className="flex items-center gap-2">
                <ThemeToggle />
                <QuickAccessLinks activeSection={activeSection} onNavigate={handleNavigation} />
              </div>
            </div>
          </div>
        </header>

        <div className="p-4 sm:p-6 w-full mx-auto">
          {activeSection === "dashboard" && <DashboardContent stats={stats} setActiveSection={setActiveSection} />}
          {activeSection === "projets" && (
            <ProjetsContent 
              showProjetForm={showProjetForm}
              setShowProjetForm={setShowProjetForm}
              editingProjet={editingProjet}
              setEditingProjet={setEditingProjet}
              handleProjetFormSuccess={handleProjetFormSuccess}
              projets={projets}
              filteredProjets={filteredProjets}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              handleEditProjet={handleEditProjet}
              handleDeleteProjet={handleDeleteProjet}
              handleToggleProjetVisibility={handleToggleProjetVisibility}
              handleProjetDragEnd={handleProjetDragEnd}
              moveProjet={moveProjet}
              prestations={prestations}
            />
          )}
          {activeSection === "assistant-client" && <AssistantClientContent />}
          {activeSection === "assistant" && <AssistantContent />}
          {activeSection === "planning" && <PlanningContent />}
          {activeSection === "listes" && <ListesContent />}
          {activeSection === "settings" && <SettingsContent user={user} handleLogout={handleLogout} />}
        </div>
      </main>

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm lg:hidden z-40" onClick={() => setSidebarOpen(false)} />
      )}
    </div>
  );
}

function QuickAccessLinks({ activeSection, onNavigate }) {
  const quickLinks = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, color: "var(--color-primary-500)" },
    { id: "planning", label: "Planning", icon: Calendar, color: "var(--color-secondary-500)" },
    { id: "listes", label: "Listes", icon: ListChecks, color: "var(--color-accent-olive-500)" },
    { id: "assistant", label: "Assistant", icon: Lightbulb, color: "var(--color-accent-warm-500)" }
  ];

  return (
    <div className="flex items-center gap-1.5">
      {quickLinks.map((link) => {
        const Icon = link.icon;
        const isActive = activeSection === link.id;
        
        return (
          <button key={link.id} onClick={() => onNavigate(link.id)} className="group relative" title={link.label}>
            <div
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all"
              style={
                isActive
                  ? { backgroundColor: link.color, color: "var(--color-text-inverse)", boxShadow: "var(--shadow-sm)" }
                  : { backgroundColor: "var(--color-bg-surface)", color: "var(--color-text-secondary)", border: `1px solid var(--color-border-light)` }
              }
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="text-xs font-medium hidden lg:inline">{link.label}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function DashboardContent({ stats, setActiveSection }) {
  useEffect(() => { window.scrollTo(0, 0); }, []);

  const { data: items = [] } = useQuery({
    queryKey: ['liste-courses'],
    queryFn: () => api.entities.ListeCourse.list('ordre'),
  });

  const activeItems = items.filter(i => !i.fait);
  const urgentItems = activeItems.filter(i => i.urgence === "urgente");
  const categories = {
    courses: { label: "Courses", color: "#E3F2FD", icon: ShoppingCart },
    materiaux: { label: "Materiaux", color: "#F3E5F5", icon: Package },
    outils: { label: "Outils", color: "#FFF9C4", icon: Wrench },
    a_retenir: { label: "A retenir", color: "#FFE0B2", icon: Lightbulb }
  };

  const todayLabel = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="space-y-6">
      <AdminHero
        icon={LayoutDashboard}
        eyebrow="Gestion Web • Assistant Client"
        title="Tableau de bord"
        subtitle={`Synthèse du jour — ${todayLabel}`}
        badges={["Vue globale", "Accès rapide"]}
        gradient="linear-gradient(135deg, var(--color-primary-500), var(--color-primary-400))"
      />

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 admin-card" style={{ borderColor: "var(--color-border-light)" }}>
          <CardHeader className="p-5 border-b" style={{ borderColor: "var(--color-border-light)" }}>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2 font-bold" style={{ color: "var(--color-text-primary)" }}>
                <Calendar className="w-5 h-5" />Planning
              </CardTitle>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setActiveSection("planning")}
                className="btn-tertiary"
                style={{ color: "var(--color-secondary-600)" }}
              >
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="w-full" style={{ height: '500px', backgroundColor: "var(--color-bg-surface)" }}>
              <iframe
                src="https://calendar.google.com/calendar/embed?src=a6a48a265c15f430290454e6e0dd9e885b3eb9fceb572248a4b78da175534a28%40group.calendar.google.com&ctz=Europe%2FParis&showTitle=0&showNav=1&showDate=1&showPrint=0&showTabs=0&showCalendars=0&mode=AGENDA"
                style={{ border: 0 }}
                width="100%"
                height="100%"
                frameBorder="0"
                scrolling="yes"
                title="Google Calendar"
                className="w-full h-full"
              />
            </div>
            <div className="p-3 border-t" style={{ borderColor: "var(--color-border-light)", backgroundColor: "var(--color-secondary-100)" }}>
              <p className="text-xs text-center flex items-center justify-center gap-2" style={{ color: "var(--color-secondary-700)" }}>
                <Sparkles className="w-3 h-3" />Synchronise avec Google Calendar
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-1 admin-card" style={{ borderColor: "var(--color-border-light)" }}>
          <CardHeader className="p-5 border-b" style={{ borderColor: "var(--color-border-light)" }}>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2 font-bold" style={{ color: "var(--color-text-primary)" }}>
                <ListChecks className="w-5 h-5" />Listes
              </CardTitle>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setActiveSection("listes")}
                className="btn-tertiary"
                style={{ color: "var(--color-primary-600)" }}
              >
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-5">
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div
                className="rounded-lg p-2 text-center border"
                style={{
                  backgroundColor: "var(--color-secondary-100)",
                  borderColor: "var(--color-secondary-300)",
                  color: "var(--color-secondary-700)",
                }}
              >
                <div className="text-xl font-bold" style={{ color: "var(--color-secondary-700)" }}>{activeItems.length}</div>
                <div className="text-xs" style={{ color: "var(--color-secondary-600)" }}>Actifs</div>
              </div>
              <div
                className="rounded-lg p-2 text-center border"
                style={{
                  backgroundColor: "var(--color-warning-bg)",
                  borderColor: "var(--color-warning-border)",
                  color: "var(--color-warning-text)",
                }}
              >
                <div className="text-xl font-bold">{urgentItems.length}</div>
                <div className="text-xs" style={{ color: "var(--color-warning-text)" }}>Urgent</div>
              </div>
              <div
                className="rounded-lg p-2 text-center border"
                style={{
                  backgroundColor: "var(--color-success-bg)",
                  borderColor: "var(--color-success-border)",
                  color: "var(--color-success-text)",
                }}
              >
                <div className="text-xl font-bold">{items.filter(i => i.fait).length}</div>
                <div className="text-xs" style={{ color: "var(--color-success-text)" }}>Fait</div>
              </div>
            </div>

            {urgentItems.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-4 h-4 text-red-600" />
                  <span className="text-sm font-semibold text-red-900">Urgent</span>
                </div>
                <div className="space-y-2">
                  {urgentItems.slice(0, 3).map(item => (
                    <div key={item.id} className="flex items-center gap-2 p-2 bg-red-50 rounded-lg border border-red-200">
                      <div className="w-1.5 h-1.5 bg-red-600 rounded-full flex-shrink-0"></div>
                      <span className="text-sm text-red-900 flex-1 truncate">{item.titre}</span>
                      <Badge className="bg-red-100 text-red-800 text-xs">{categories[item.categorie]?.label}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              {Object.entries(categories).map(([key, cat]) => {
                const count = activeItems.filter(i => i.categorie === key).length;
                if (count === 0) return null;
                const Icon = cat.icon;
                return (
                    <div
                      key={key}
                      className="flex items-center justify-between p-2 rounded-lg border transition-all hover:shadow-sm"
                      style={{ backgroundColor: "var(--color-primary-100)", borderColor: "var(--color-primary-200)" }}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4 text-amber-900" />
                        <span className="text-sm font-medium text-amber-900">{cat.label}</span>
                      </div>
                      <Badge className="bg-white/80 text-amber-900">{count}</Badge>
                  </div>
                );
              })}
            </div>

            {activeItems.length === 0 && (
              <div className="text-center py-8">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-amber-300" />
                <p className="text-sm text-amber-700">Toutes les listes sont a jour !</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-1 admin-card" style={{ borderColor: "var(--color-border-light)" }}>
          <CardHeader className="border-b p-5" style={{ borderColor: "var(--color-border-light)", backgroundColor: "var(--color-primary-100)" }}>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2 font-bold" style={{ color: "var(--color-primary-600)" }}>
                <Sparkles className="w-5 h-5" />Assistant
              </CardTitle>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setActiveSection("assistant")}
                className="btn-tertiary"
                style={{ color: "var(--color-primary-600)" }}
              >
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-5">
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold mb-3" style={{ color: "var(--color-text-secondary)" }}>Actions rapides</p>
                <div className="space-y-2">
                  <button
                    onClick={() => setActiveSection("assistant")}
                    className="w-full text-left p-3 rounded-xl border transition-all group"
                    style={{ backgroundColor: "var(--color-bg-surface)", borderColor: "var(--color-border-medium)" }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors"
                        style={{ backgroundColor: "var(--color-primary-100)" }}
                      >
                        <MessageSquare className="w-5 h-5" color="var(--color-primary-600)" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>Discuter</p>
                        <p className="text-xs" style={{ color: "var(--color-text-secondary)" }}>Pose tes questions a l'IA</p>
                      </div>
                      <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" color="var(--color-primary-600)" />
                    </div>
                  </button>

                  <button
                    onClick={() => setActiveSection("planning")}
                    className="w-full text-left p-3 rounded-xl border transition-all group"
                    style={{ backgroundColor: "var(--color-bg-surface)", borderColor: "var(--color-secondary-300)" }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors"
                        style={{ backgroundColor: "var(--color-secondary-100)" }}
                      >
                        <Calendar className="w-5 h-5" color="var(--color-secondary-600)" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>Planning</p>
                        <p className="text-xs" style={{ color: "var(--color-text-secondary)" }}>Gerer mes evenements</p>
                      </div>
                      <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" color="var(--color-secondary-600)" />
                    </div>
                  </button>

                  <button
                    onClick={() => setActiveSection("listes")}
                    className="w-full text-left p-3 rounded-xl border transition-all group"
                    style={{ backgroundColor: "var(--color-bg-surface)", borderColor: "var(--color-border-medium)" }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors"
                        style={{ backgroundColor: "var(--color-accent-warm-100)" }}
                      >
                        <ListChecks className="w-5 h-5" color="var(--color-primary-600)" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>Listes</p>
                        <p className="text-xs" style={{ color: "var(--color-text-secondary)" }}>Ajouter des items</p>
                      </div>
                      <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" color="var(--color-primary-600)" />
                    </div>
                  </button>
                </div>
              </div>

              <div className="rounded-xl border p-4" style={{ backgroundColor: "var(--color-accent-warm-100)", borderColor: "var(--color-accent-warm-300)" }}>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm">
                    <Lightbulb className="w-5 h-5" color="var(--color-primary-600)" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold mb-1" style={{ color: "var(--color-text-primary)" }}> Astuce</p>
                    <p className="text-xs leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
                      Utilise l'assistant pour creer rapidement des evenements, gerer tes listes et suivre tes projets en langage naturel.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Projets", value: stats.totalProjets, icon: Globe, gradient: "from-blue-600 to-blue-400" },
          { label: "Prestations", value: stats.totalPrestations, icon: Briefcase, gradient: "from-amber-500 to-amber-300" },
          { label: "Conv. Clients", value: stats.totalConversationsProjet, icon: MessageSquare, gradient: "from-emerald-500 to-cyan-400" },
          { label: "Sessions", value: stats.totalConversationsChantier || 0, icon: Wrench, gradient: "from-indigo-500 to-blue-500" },
        ].map((item, idx) => {
          const Icon = item.icon;
          return (
            <Card key={idx} className="admin-card" style={{ borderColor: "var(--color-border-light)" }}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs mb-1" style={{ color: "var(--color-text-tertiary)" }}>{item.label}</p>
                    <p className="text-2xl font-bold" style={{ color: "var(--color-text-primary)" }}>{item.value}</p>
                  </div>
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white"
                    style={{ backgroundColor: idx === 0 ? "var(--color-primary-500)" : idx === 1 ? "var(--color-secondary-500)" : idx === 2 ? "var(--color-accent-warm-500)" : "var(--color-accent-olive-500)" }}
                  >
                    <Icon className="w-5 h-5" color="var(--color-text-inverse)" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function ProjetsContent({ showProjetForm, setShowProjetForm, editingProjet, setEditingProjet, handleProjetFormSuccess, projets, filteredProjets, searchTerm, setSearchTerm, handleEditProjet, handleDeleteProjet, handleToggleProjetVisibility, handleProjetDragEnd, moveProjet, prestations }) {
  const [view, setView] = useState("projets");
  const [editingPrestation, setEditingPrestation] = useState(null);
  const [showPrestationForm, setShowPrestationForm] = useState(false);
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: (id) => api.entities.Prestation.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-prestations'] }),
  });

  const toggleVisibilityMutation = useMutation({
    mutationFn: ({ id, visible }) => api.entities.Prestation.update(id, { visible }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-prestations'] }),
  });

  const movePrestationOrder = async (index, direction) => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= prestations.length) return;

    await Promise.all([
      api.entities.Prestation.update(prestations[index].id, { ordre: newIndex }),
      api.entities.Prestation.update(prestations[newIndex].id, { ordre: index })
    ]);

    queryClient.invalidateQueries({ queryKey: ['admin-prestations'] });
  };

  const handleEdit = (prestation) => {
    setEditingPrestation(prestation);
    setShowPrestationForm(true);
  };

  const handleDelete = (prestation) => {
    if (confirm(`Supprimer "${prestation.titre}" ?`)) {
      deleteMutation.mutate(prestation.id);
    }
  };

  const handleToggleVisibility = (prestation) => {
    toggleVisibilityMutation.mutate({ id: prestation.id, visible: !prestation.visible });
  };

  const handleFormSuccess = () => {
    setShowPrestationForm(false);
    setEditingPrestation(null);
  };

  return (
    <div className="space-y-6">
      <AdminHero
        icon={Globe}
        eyebrow="Gestion Web"
        title="Projets & Prestations"
        subtitle="Pilote ton portfolio, visibilité et services"
        badges={["Publies", "En avant", "SEO-ready"]}
        gradient="linear-gradient(135deg, var(--color-primary-500), var(--color-accent-warm-400))"
        iconTint="rgba(255,255,255,0.14)"
      />

      <div className="flex items-center gap-2 border-b" style={{ borderColor: "var(--color-border-light)" }}>
        <button onClick={() => setView("projets")} className="px-4 py-2 text-sm font-medium border-b-2 transition-colors"
          style={view === "projets"
            ? { borderColor: "var(--color-primary-500)", color: "var(--color-text-primary)" }
            : { borderColor: "transparent", color: "var(--color-text-secondary)" }}>
          <Globe className="w-4 h-4 inline mr-2" />Projets Portfolio
        </button>
        <button onClick={() => setView("prestations")} className="px-4 py-2 text-sm font-medium border-b-2 transition-colors"
          style={view === "prestations"
            ? { borderColor: "var(--color-secondary-500)", color: "var(--color-text-primary)" }
            : { borderColor: "transparent", color: "var(--color-text-secondary)" }}>
          <Briefcase className="w-4 h-4 inline mr-2" />Services & Prestations
        </button>
      </div>

      {view === "projets" && (
        <div>
          {showProjetForm ? (
            <div className="mb-6">
              <AdminProjetForm projet={editingProjet} onCancel={() => { setShowProjetForm(false); setEditingProjet(null); }} onSuccess={handleProjetFormSuccess} />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 mb-6">
                {[
                  { label: "Total", value: projets.length, color: "var(--color-text-primary)" },
                  { label: "Visibles", value: projets.filter(p => p.visible).length, color: "var(--color-success-text)" },
                  { label: "Masques", value: projets.filter(p => !p.visible).length, color: "var(--color-error-text)" },
                  { label: "En avant", value: projets.filter(p => p.mis_en_avant).length, color: "var(--color-primary-600)" },
                ].map((tile, idx) => (
                  <div key={idx} className="rounded-lg shadow-sm p-3 md:p-4" style={{ backgroundColor: "var(--color-bg-surface)", border: `1px solid var(--color-border-light)` }}>
                    <div className="text-xl md:text-3xl font-bold" style={{ color: tile.color }}>{tile.value}</div>
                    <div className="text-xs md:text-sm" style={{ color: "var(--color-text-secondary)" }}>{tile.label}</div>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                  <Input placeholder="Rechercher..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
                </div>
                <Button
                  onClick={() => { setEditingProjet(null); setShowProjetForm(true); }}
                  className="btn-primary whitespace-nowrap"
                  style={{ backgroundColor: "var(--color-primary-500)", color: "var(--color-btn-primary-text)" }}
                >
                  <Plus className="w-4 h-4 mr-2" />Nouveau projet
                </Button>
              </div>

              {filteredProjets.length === 0 ? (
                <Alert className="bg-neutral-100">
                  <AlertDescription className="text-center py-8">
                    {searchTerm ? "Aucun projet trouve" : "Aucun projet. Creez-en un !"}
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  <div className="bg-neutral-100 border border-neutral-200 rounded-lg p-3 mb-4 text-xs md:text-sm">
                     Utilisez les fleches pour reorganiser
                  </div>
                  <DragDropContext onDragEnd={handleProjetDragEnd}>
                    <Droppable droppableId="projets">
                      {(provided) => (
                        <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-3">
                          {filteredProjets.map((projet, index) => (
                            <Draggable key={projet.id} draggableId={projet.id} index={index}>
                              {(provided, snapshot) => (
                                <div ref={provided.innerRef} {...provided.draggableProps} className={snapshot.isDragging ? 'opacity-50' : ''}>
                                  <div className="flex gap-2 items-start">
                                    <div className="flex flex-col gap-1 flex-shrink-0">
                                      <button onClick={() => moveProjet(index, 'up')} disabled={index === 0} className="p-1.5 md:p-2 hover:bg-neutral-100 rounded disabled:opacity-30 bg-white border border-neutral-200">
                                        <ArrowUp className="w-3 h-3 md:w-4 md:h-4" />
                                      </button>
                                      <div {...provided.dragHandleProps} className="hidden md:block p-2 bg-white border border-neutral-200 rounded cursor-grab active:cursor-grabbing">
                                        <GripVertical className="w-4 h-4 text-neutral-400" />
                                      </div>
                                      <button onClick={() => moveProjet(index, 'down')} disabled={index === filteredProjets.length - 1} className="p-1.5 md:p-2 hover:bg-neutral-100 rounded disabled:opacity-30 bg-white border border-neutral-200">
                                        <ArrowDown className="w-3 h-3 md:w-4 md:h-4" />
                                      </button>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <AdminProjetCard projet={projet} onEdit={handleEditProjet} onDelete={handleDeleteProjet} onToggleVisibility={handleToggleProjetVisibility} />
                                    </div>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </DragDropContext>
                </>
              )}
            </>
          )}
        </div>
      )}

      {view === "prestations" && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>Services affiches sur votre site web</p>
            <Button
              onClick={() => { setEditingPrestation(null); setShowPrestationForm(true); }}
              className="btn-secondary"
              style={{ backgroundColor: "var(--color-secondary-500)", color: "var(--color-btn-secondary-text)" }}
            >
              <Plus className="w-4 h-4 mr-2" />Nouvelle prestation
            </Button>
          </div>

          {showPrestationForm && (
            <PrestationForm prestation={editingPrestation} onCancel={() => { setShowPrestationForm(false); setEditingPrestation(null); }} onSuccess={handleFormSuccess} />
          )}

          {prestations.length === 0 ? (
            <Alert className="bg-neutral-100">
              <AlertDescription className="text-center py-8">Aucune prestation. Creez-en une !</AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-3">
              {prestations.map((prestation, index) => (
                <div
                  key={prestation.id}
                  className="bg-white rounded-lg shadow-lg p-3 md:p-4 border-2 transition-all hover:shadow-md"
                  style={{ borderColor: "var(--color-border-light)" }}
                >
                  <div className="flex gap-2 md:gap-3">
                    <div className="flex flex-col gap-1 flex-shrink-0">
                      <button onClick={() => movePrestationOrder(index, 'up')} disabled={index === 0} className="p-1.5 hover:bg-neutral-100 rounded disabled:opacity-30 border border-neutral-200">
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button onClick={() => movePrestationOrder(index, 'down')} disabled={index === prestations.length - 1} className="p-1.5 hover:bg-neutral-100 rounded disabled:opacity-30 border border-neutral-200">
                        <ArrowDown className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <h3 className="font-bold text-neutral-800 text-sm md:text-base flex-1 min-w-0">{prestation.titre}</h3>
                        {prestation.visible ? (
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded flex items-center gap-1 whitespace-nowrap flex-shrink-0">
                            <Eye className="w-3 h-3" /> Visible
                          </span>
                        ) : (
                          <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded flex items-center gap-1 whitespace-nowrap flex-shrink-0">
                            <EyeOff className="w-3 h-3" /> Masque
                          </span>
                        )}
                      </div>
                      <p className="text-xs md:text-sm text-neutral-600 mb-3 line-clamp-2">{prestation.description}</p>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleEdit(prestation)} className="text-blue-600 border-blue-600 hover:bg-blue-50 text-xs">
                          <Edit2 className="w-3 h-3 mr-1" />Modifier
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleToggleVisibility(prestation)} className="text-neutral-600 border-neutral-600 hover:bg-neutral-50 text-xs">
                          {prestation.visible ? <><EyeOff className="w-3 h-3 mr-1" />Masquer</> : <><Eye className="w-3 h-3 mr-1" />Afficher</>}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleDelete(prestation)} className="text-red-600 border-red-600 hover:bg-red-50 text-xs">
                          <Trash2 className="w-3 h-3 mr-1" />Supprimer
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PrestationForm({ prestation, onCancel, onSuccess }) {
  const [formData, setFormData] = useState(prestation || { titre: "", description: "", prix_indicatif: "", duree_estimee: "", ordre: 0, visible: true });
  const queryClient = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (prestation) {
        return api.entities.Prestation.update(prestation.id, data);
      } else {
        return api.entities.Prestation.create(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-prestations'] });
      onSuccess();
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  return (
    <Card className="border-neutral-200 shadow-lg mb-6">
      <CardHeader className="border-b border-neutral-100">
        <CardTitle className="text-base font-semibold text-neutral-900">
          {prestation ? "Modifier la prestation" : "Nouvelle prestation"}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label className="text-sm font-medium text-neutral-700">Titre *</Label>
            <Input value={formData.titre} onChange={(e) => setFormData({ ...formData, titre: e.target.value })} placeholder="Ex: Renovation de cuisine" required className="mt-1" />
          </div>

          <div>
            <Label className="text-sm font-medium text-neutral-700">Description *</Label>
            <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Decrivez la prestation..." required rows={4} className="mt-1" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium text-neutral-700">Prix indicatif</Label>
              <Input value={formData.prix_indicatif} onChange={(e) => setFormData({ ...formData, prix_indicatif: e.target.value })} placeholder="Ex: A partir de 5000" className="mt-1" />
            </div>
            <div>
              <Label className="text-sm font-medium text-neutral-700">Duree estimee</Label>
              <Input value={formData.duree_estimee} onChange={(e) => setFormData({ ...formData, duree_estimee: e.target.value })} placeholder="Ex: 2 a 3 semaines" className="mt-1" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="visible" checked={formData.visible} onChange={(e) => setFormData({ ...formData, visible: e.target.checked })} className="w-4 h-4 rounded border-neutral-300" />
            <Label htmlFor="visible" className="text-sm text-neutral-700 cursor-pointer">Visible sur le site</Label>
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onCancel} className="flex-1">Annuler</Button>
            <Button type="submit" className="flex-1 bg-neutral-900 hover:bg-neutral-800" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Enregistrement...</> : <>{prestation ? "Mettre a jour" : "Creer"}</>}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function AssistantClientContent() {
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [showSummary, setShowSummary] = useState(false);
  const [summary, setSummary] = useState(null);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const loadConversations = async () => {
      try {
        setLoadingConversations(true);
        const convs = await api.agents.listConversations({ agent_name: "assistant_projet" });
        const nonEmptyConvs = convs.filter(conv => {
          const messageCount = conv.messages?.filter(m => m.content)?.length || 0;
          return messageCount > 1;
        });
        setConversations(nonEmptyConvs.sort((a, b) => new Date(b.updated_date) - new Date(a.updated_date)));
      } catch (error) {
        console.error("Error loading conversations:", error);
      } finally {
        setLoadingConversations(false);
      }
    };
    loadConversations();
  }, []);

  useEffect(() => {
    if (!selectedConversation) return;
    const unsubscribe = api.agents.subscribeToConversation(selectedConversation.id, (data) => {
      setMessages(data.messages.filter(m => m.content));
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [selectedConversation]);

  const handleSelectConversation = async (conv) => {
    setSelectedConversation(conv);
    setMessages(conv.messages?.filter(m => m.content) || []);
    setShowSummary(false);
    setSummary(null);
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !selectedConversation || isLoading) return;
    const userMessage = inputMessage.trim();
    setInputMessage("");
    setIsLoading(true);
    try {
      await api.agents.addMessage(selectedConversation, { role: "user", content: userMessage });
    } catch (error) {
      console.error("Error sending message:", error);
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const generateDevisSummary = async () => {
    if (!selectedConversation || !messages.length) return;
    setGeneratingSummary(true);
    setShowSummary(true);
    try {
      const conversationText = messages.map(msg => `${msg.role === 'user' ? 'Client' : 'Assistant'}: ${msg.content}`).join('\n\n');
      const response = await api.integrations.Core.InvokeLLM({
        prompt: `Analyse cette conversation et genere un resume structure pour devis.\n\n${conversationText}`,
        response_json_schema: {
          type: "object",
          properties: {
            projet: { type: "object", properties: { type: { type: "string" }, description_courte: { type: "string" } } },
            niveau_avancement: { type: "string" }
          }
        }
      });
      setSummary(response);
    } catch (error) {
      setSummary({ error: "Erreur" });
    } finally {
      setGeneratingSummary(false);
    }
  };

  const MessageBubble = ({ message }) => {
    const isUser = message.role === 'user';
    return (
      <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
        {!isUser && <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-green-600 to-green-800 flex items-center justify-center flex-shrink-0 shadow-md"><MessageSquare className="w-5 h-5 text-white" /></div>}
        <div className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm ${isUser ? 'bg-gradient-to-br from-green-600 to-green-700 text-white' : 'bg-white border-2 border-stone-200 text-stone-800'}`}>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
        </div>
        {isUser && <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-stone-600 to-stone-800 flex items-center justify-center flex-shrink-0 shadow-md"><User className="w-5 h-5 text-white" /></div>}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <AdminHero
        icon={MessageSquare}
        eyebrow="Assistant Client"
        title="Conversations prospects"
        subtitle="Suivi des échanges, relances et résumés pour devis"
        badges={["Live", "Résumé devis", "Base44"]}
        gradient="linear-gradient(135deg, var(--color-accent-warm-400), var(--color-primary-500))"
      />

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 border-orange-200 shadow-lg" style={{ borderColor: "var(--color-border-light)" }}>
          <CardHeader className="border-b p-4" style={{ background: "linear-gradient(135deg, var(--color-accent-warm-100), var(--color-accent-warm-200))" }}>
            <CardTitle className="text-base flex items-center gap-2" style={{ color: "var(--color-text-primary)" }}>
              <MessageSquare className="w-5 h-5" />Conversations ({conversations.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 max-h-[600px] overflow-y-auto" style={{ backgroundColor: "var(--color-bg-surface)" }}>
            {loadingConversations ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 text-orange-600 animate-spin" /></div>
            ) : conversations.length === 0 ? (
              <div className="text-center py-8 text-stone-500">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 text-stone-300" />
                <p className="text-sm">Aucune conversation</p>
              </div>
            ) : (
              <div className="space-y-2">
                {conversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => handleSelectConversation(conv)}
                    className={`w-full text-left p-3 rounded-lg transition-all ${selectedConversation?.id === conv.id ? 'bg-[var(--color-accent-warm-100)] border-2' : 'bg-white border hover:bg-[var(--color-bg-surface-hover)]'}`}
                    style={selectedConversation?.id === conv.id ? { borderColor: "var(--color-primary-500)", color: "var(--color-text-primary)" } : { borderColor: "var(--color-border-light)", color: "var(--color-text-primary)" }}
                  >
                    <p className="font-semibold text-sm truncate">{conv.metadata?.name || "Sans titre"}</p>
                    <p className="text-xs mt-1" style={{ color: "var(--color-text-tertiary)" }}>{conv.messages?.filter(m => m.content)?.length || 0} messages</p>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 border-orange-200 shadow-lg" style={{ borderColor: "var(--color-border-light)" }}>
          {selectedConversation ? (
            <>
              <CardHeader className="border-b p-4" style={{ background: "linear-gradient(135deg, var(--color-accent-warm-100), var(--color-accent-warm-200))" }}>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl" style={{ color: "var(--color-text-primary)" }}>{selectedConversation.metadata?.name || "Conversation"}</CardTitle>
                    <p className="text-xs mt-1" style={{ color: "var(--color-text-secondary)" }}>Creee le {new Date(selectedConversation.created_date).toLocaleDateString('fr-FR')}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="badge-secondary" style={{ backgroundColor: "var(--color-accent-warm-100)", color: "var(--color-primary-600)" }}>{messages.length} messages</Badge>
                    <div className="flex gap-1">
                      <Button size="sm" variant={!showSummary ? "default" : "outline"} onClick={() => setShowSummary(false)} className={!showSummary ? "btn-primary" : "btn-tertiary"}>
                        <MessageSquare className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant={showSummary ? "default" : "outline"} onClick={() => { if (!summary && !generatingSummary) { generateDevisSummary(); } else { setShowSummary(true); }}} className={showSummary ? "btn-primary" : "btn-tertiary"} disabled={generatingSummary}>
                        {generatingSummary ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {!showSummary ? (
                  <>
                    <div className="h-[500px] overflow-y-auto p-6" style={{ backgroundColor: "var(--color-accent-warm-100)" }}>
                      {messages.map((message, index) => (<MessageBubble key={index} message={message} />))}
                      {isLoading && (
                        <div className="flex gap-3 justify-start mb-4">
                          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-orange-600 to-orange-800 flex items-center justify-center flex-shrink-0 shadow-md">
                            <MessageSquare className="w-5 h-5 text-white" />
                          </div>
                          <div className="bg-white border-2 border-stone-200 rounded-2xl px-4 py-3 shadow-sm">
                            <div className="flex gap-1">
                              <div className="w-2 h-2 bg-orange-600 rounded-full animate-bounce"></div>
                              <div className="w-2 h-2 bg-orange-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                              <div className="w-2 h-2 bg-orange-600 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                            </div>
                          </div>
                        </div>
                      )}
                      <div ref={messagesEndRef} />
                    </div>
                    <div className="p-4 border-t-2 bg-white" style={{ borderColor: 'var(--color-accent-warm-300)' }}>
                      <div className="flex gap-3">
                        <Textarea value={inputMessage} onChange={(e) => setInputMessage(e.target.value)} onKeyPress={handleKeyPress} placeholder="Repondre au client..." className="resize-none text-sm" rows={2} disabled={isLoading} style={{ borderColor: '#FFCC80' }} />
                        <Button onClick={handleSendMessage} disabled={!inputMessage.trim() || isLoading} className="px-6 shadow-lg btn-primary">
                          <Send className="w-5 h-5" />
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="p-6 max-h-[600px] overflow-y-auto">
                    {summary?.error ? (
                      <div className="text-center"><AlertCircle className="w-12 h-12 mx-auto mb-3 text-red-500" /><p className="text-red-700">{summary.error}</p></div>
                    ) : summary ? (
                      <div className="space-y-4">
                        <div className="rounded-xl p-4" style={{ backgroundColor: "var(--color-accent-warm-100)", border: "1px solid var(--color-accent-warm-300)" }}>
                          <h3 className="text-lg font-bold" style={{ color: "var(--color-text-primary)" }}>Resume pour Devis</h3>
                          <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>Niveau: {summary.niveau_avancement}</p>
                        </div>
                        <div className="bg-white rounded-xl border p-4" style={{ borderColor: "var(--color-border-light)" }}>
                          <h4 className="font-bold mb-2" style={{ color: "var(--color-text-primary)" }}><Briefcase className="w-5 h-5 inline" color="var(--color-primary-500)" /> Projet</h4>
                          <p className="text-sm"><strong>Type:</strong> {summary.projet?.type}</p>
                          <p className="text-sm"><strong>Description:</strong> {summary.projet?.description_courte}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-96"><Loader2 className="w-8 h-8 text-orange-600 animate-spin" /></div>
                    )}
                  </div>
                )}
              </CardContent>
            </>
          ) : (
            <div className="flex items-center justify-center h-[600px]">
              <div className="text-center"><MessageSquare className="w-16 h-16 mx-auto mb-4 text-stone-300" /><p className="text-lg font-medium text-stone-400">Selectionnez une conversation</p></div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function AssistantContent() {
  const { theme } = useTheme();
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{
        role: 'assistant',
        content: "Salut Thomas \n\nJe suis ton assistant de gestion. Je peux t'aider a :\n\n Suivre l'etat de tes chantiers\n Gerer tes taches prioritaires\n Calculer tes charges URSSAF\n Organiser ton planning\n\nQu'est-ce que je peux faire pour toi ?",
        noAction: true
      }]);
    }
  }, []);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;
    const userMessage = inputMessage.trim();
    setInputMessage("");
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const res = await api.functions.invoke('invokeAgent', { userMessage, context: "gestion" });
      const msg = res.data?.message || res.data?.output || " Action effectuee";
      const actions = res.data?.actions || [];
      const hasRealActions = actions.some(a => a.type !== 'refresh' && a.status !== 'pending_frontend');

      setMessages(prev => [...prev, { role: 'assistant', content: msg, actions, noAction: !hasRealActions }]);
      
      if (res.data?.actions) {
        for (const act of res.data.actions) {
          if (act.type === 'refresh') {
            queryClient.invalidateQueries({ queryKey: [act.entity.toLowerCase() + 's'] });
          }
        }
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Desole, une erreur s'est produite. Reessaye.", noAction: true }]);
    } finally {
      setIsLoading(false);
    }
  };

  const MessageBubble = ({ message }) => {
    const isUser = message.role === 'user';
    const assistantBubbleStyle = theme === "dark"
      ? { backgroundColor: "var(--color-bg-surface-hover)", borderColor: "var(--color-border-medium)", color: "var(--color-text-primary)" }
      : { backgroundColor: "#ffffff", borderColor: "var(--color-accent-warm-300)", color: "var(--color-text-primary)" };
    return (
      <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
        {!isUser && (
          <div
            className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg"
            style={{
              background: theme === "dark" ? "linear-gradient(135deg, var(--color-primary-400), var(--color-primary-600))" : "linear-gradient(135deg, #f97316, #c2410c)",
            }}
          >
            <Wrench className="w-5 h-5 text-white" />
          </div>
        )}
        <div className={`max-w-[85%] ${isUser ? 'rounded-2xl px-4 py-3 shadow-md text-white' : 'space-y-2'}`}
          style={isUser ? { background: theme === "dark" ? "linear-gradient(135deg, #1f2937, #0f172a)" : "linear-gradient(135deg, #404040, #262626)" } : undefined}>
          {isUser ? (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
          ) : (
            <>
              <div className="rounded-2xl px-4 py-3 shadow-md border" style={assistantBubbleStyle}>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
              </div>
              {message.actions && message.actions.length > 0 && (
                <div
                  className="rounded-lg p-3 text-xs border"
                  style={{
                    backgroundColor: theme === "dark" ? "rgba(99, 198, 196, 0.12)" : "var(--color-success-bg)",
                    borderColor: theme === "dark" ? "rgba(63,198,196,0.35)" : "var(--color-success-border)",
                    color: theme === "dark" ? "var(--color-text-primary)" : "var(--color-success-text)",
                  }}
                >
                  <div className="flex items-center gap-2 mb-2" style={{ color: theme === "dark" ? "#63c6c4" : "var(--color-success-icon)" }}>
                    <CheckCircle2 className="w-4 h-4" /> <span className="font-semibold">Actions effectuees :</span>
                  </div>
                  {message.actions.map((action, idx) => (
                    <div key={idx}>
                      {action.type === 'create' && ' Creation'} {action.type === 'update' && ' Modification'} {action.type === 'delete' && ' Suppression'} <strong>{action.entity}</strong>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        {isUser && <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-neutral-700 to-neutral-900 flex items-center justify-center flex-shrink-0 shadow-lg"><span className="text-white text-sm font-bold">T</span></div>}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <AdminHero
        icon={Lightbulb}
        eyebrow="Assistant interne"
        title="Pilotage intelligent"
        subtitle="Gestion des tâches, actions automatiques et suivi"
        badges={["Automation", "Base44", "Actions live"]}
        gradient="linear-gradient(135deg, var(--color-accent-warm-500), var(--color-accent-warm-400))"
      />

      <Card className="border-orange-200 shadow-lg" style={{ borderColor: "var(--color-border-light)" }}>
        <CardHeader
          className="p-6"
          style={{
            background:
              theme === "dark"
                ? "linear-gradient(135deg, var(--color-bg-surface), var(--color-bg-surface-hover))"
                : "linear-gradient(135deg, var(--color-accent-warm-100), var(--color-accent-warm-200))",
          }}
        >
          <CardTitle className="text-xl" style={{ color: "var(--color-text-primary)" }}>Assistant de Gestion</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div
            className="h-[500px] overflow-y-auto p-6"
            style={{
              backgroundColor: theme === "dark" ? "var(--color-bg-surface)" : "var(--color-accent-warm-100)",
              borderBottom: theme === "dark" ? `1px solid var(--color-border-medium)` : undefined,
            }}
          >
            {messages.map((message, index) => (<MessageBubble key={index} message={message} />))}
            {isLoading && (
              <div className="flex gap-3 justify-start mb-4">
                <div
                  className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg"
                  style={{
                    background: theme === "dark" ? "linear-gradient(135deg, var(--color-primary-400), var(--color-primary-600))" : "linear-gradient(135deg, #f97316, #c2410c)",
                  }}
                >
                  <Wrench className="w-5 h-5 text-white" />
                </div>
                <div
                  className="rounded-2xl px-4 py-3 shadow-md border"
                  style={{
                    backgroundColor: theme === "dark" ? "var(--color-bg-surface-hover)" : "#ffffff",
                    borderColor: theme === "dark" ? "var(--color-border-medium)" : "var(--color-accent-warm-300)",
                  }}
                >
                  <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: "var(--color-primary-500)" }}></div>
                    <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: "var(--color-primary-500)", animationDelay: '0.2s' }}></div>
                    <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: "var(--color-primary-500)", animationDelay: '0.4s' }}></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div
            className="p-4 border-t-2"
            style={{
              borderColor: theme === "dark" ? "var(--color-border-medium)" : "var(--color-accent-warm-300)",
              backgroundColor: theme === "dark" ? "var(--color-bg-surface-hover)" : "#ffffff",
            }}
          >
            <div className="flex gap-3">
              <Textarea value={inputMessage} onChange={(e) => setInputMessage(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())} placeholder="Ex: Ou j'en suis sur le chantier Dupont ?" className="resize-none text-sm" rows={2} disabled={isLoading} style={{ borderColor: '#FFCC80' }} />
              <Button onClick={handleSendMessage} disabled={!inputMessage.trim() || isLoading} className="px-6 shadow-lg btn-primary">
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin text-orange-900" /> : <Send className="w-5 h-5 text-orange-900" />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PlanningContent() {
  const [calendarKey, setCalendarKey] = useState(0);
  const queryClient = useQueryClient();

  useEffect(() => { window.scrollTo(0, 0); }, []);

  const { data: events = [] } = useQuery({
    queryKey: ['events'],
    queryFn: () => api.entities.Event.list('start'),
  });

  const handleEventCreatedByChatbot = () => {
    queryClient.invalidateQueries({ queryKey: ['events'] });
    setCalendarKey(prev => prev + 1);
  };

  const todayEvents = events.filter(e => new Date(e.start).toDateString() === new Date().toDateString()).sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  return (
    <div className="space-y-4">
      <PlanningChatBot onEventCreated={handleEventCreatedByChatbot} />

      <AdminHero
        icon={Calendar}
        eyebrow="Gestion pratique"
        title="Planning"
        subtitle="Synchronisé Google Calendar + chatbot"
        badges={["Agenda", "Synchro", "Chatbot"]}
        gradient="linear-gradient(135deg, var(--color-secondary-600), var(--color-secondary-400))"
      />

      {todayEvents.length > 0 && (
        <Card className="border-blue-50 shadow-sm bg-white">
          <CardHeader className="p-3 bg-blue-50"><CardTitle className="text-sm font-semibold text-blue-900 flex items-center gap-2"><Clock className="w-4 h-4" />Aujourd'hui ({todayEvents.length})</CardTitle></CardHeader>
          <CardContent className="p-3">
            <div className="flex gap-2 overflow-x-auto">
              {todayEvents.map(event => (
                <div key={event.id} className="flex-shrink-0 w-48 p-2 rounded-lg border-l-4 bg-white shadow-sm" style={{ borderLeftColor: event.color || '#007AFF' }}>
                  <div className="font-semibold text-stone-800 text-xs truncate">{event.title}</div>
                  <div className="text-xs text-stone-600 mt-1">{new Date(event.start).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-blue-200 shadow-2xl">
        <CardHeader className="border-b p-6 bg-gradient-to-r from-blue-50 to-blue-100">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg text-blue-900 flex items-center gap-2"><Calendar className="w-5 h-5" />Calendrier Principal</CardTitle>
            <Button size="sm" variant="outline" onClick={() => setCalendarKey(prev => prev + 1)} className="text-blue-600 border-blue-600 hover:bg-blue-50">
              <RefreshCw className="w-4 h-4 mr-2" />Actualiser
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="w-full bg-white" style={{ height: '800px' }}>
            <iframe key={calendarKey} src="https://calendar.google.com/calendar/embed?src=a6a48a265c15f430290454e6e0dd9e885b3eb9fceb572248a4b78da175534a28%40group.calendar.google.com&ctz=Europe%2FParis" style={{ border: 0 }} width="100%" height="100%" frameBorder="0" scrolling="no" title="Google Calendar" className="w-full h-full" />
          </div>
          <div className="p-3 bg-gradient-to-r from-blue-50 to-blue-100 border-t border-blue-200">
            <p className="text-xs text-blue-800 text-center flex items-center justify-center gap-2"><Sparkles className="w-3 h-3" />Synchronise automatiquement avec Google Calendar</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ListesContent() {
  const [newItem, setNewItem] = useState("");
  const [selectedCategorie, setSelectedCategorie] = useState("courses");
  const [expandedCategories, setExpandedCategories] = useState({ courses: true, materiaux: true, outils: true, a_retenir: true, autre: true });
  const [viewMode, setViewMode] = useState("dashboard");
  const queryClient = useQueryClient();

  useEffect(() => { window.scrollTo(0, 0); }, []);

  const { data: items = [] } = useQuery({
    queryKey: ['liste-courses'],
    queryFn: () => api.entities.ListeCourse.list('ordre'),
  });

  const handleItemCreatedByChatbot = () => {
    queryClient.invalidateQueries({ queryKey: ['liste-courses'] });
  };

  const createMutation = useMutation({
    mutationFn: (data) => api.entities.ListeCourse.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['liste-courses'] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.entities.ListeCourse.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['liste-courses'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.entities.ListeCourse.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['liste-courses'] }),
  });

  const handleAddItem = () => {
    if (!newItem.trim()) return;
    createMutation.mutate({ titre: newItem, categorie: selectedCategorie, fait: false, urgence: "normale", ordre: items.length });
    setNewItem("");
  };

  const handleToggleItem = (item) => {
    updateMutation.mutate({ id: item.id, data: { ...item, fait: !item.fait } });
  };

  const handleToggleUrgence = (item) => {
    const urgences = ["normale", "importante", "urgente"];
    const currentIndex = urgences.indexOf(item.urgence || "normale");
    const nextIndex = (currentIndex + 1) % urgences.length;
    updateMutation.mutate({ id: item.id, data: { ...item, urgence: urgences[nextIndex] } });
  };

  const handleDeleteItem = (id) => {
    deleteMutation.mutate(id);
  };

  const handleDeleteDone = () => {
    items.filter(item => item.fait).forEach(item => deleteMutation.mutate(item.id));
  };

  const toggleCategory = (cat) => {
    setExpandedCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  const categories = {
    courses: { label: "Courses", icon: ShoppingCart, color: "bg-blue-500", lightColor: "bg-blue-100", textColor: "text-blue-900" },
    materiaux: { label: "Materiaux", icon: Package, color: "bg-purple-500", lightColor: "bg-purple-100", textColor: "text-purple-900" },
    outils: { label: "Outils", icon: Wrench, color: "bg-amber-500", lightColor: "bg-amber-100", textColor: "text-amber-900" },
    a_retenir: { label: "A Retenir", icon: Lightbulb, color: "bg-yellow-500", lightColor: "bg-yellow-100", textColor: "text-yellow-900" },
    autre: { label: "Autre", icon: AlertCircle, color: "bg-stone-500", lightColor: "bg-stone-100", textColor: "text-stone-900" }
  };

  const groupedItems = items.reduce((acc, item) => {
    if (!acc[item.categorie]) acc[item.categorie] = [];
    acc[item.categorie].push(item);
    return acc;
  }, {});

  const totalItems = items.length;
  const doneItems = items.filter(i => i.fait).length;
  const urgentItems = items.filter(i => !i.fait && i.urgence === "urgente");
  const importantItems = items.filter(i => !i.fait && i.urgence === "importante");

  const getUrgenceIcon = (urgence) => {
    if (urgence === "urgente") return "";
    if (urgence === "importante") return "";
    return "";
  };

  return (
    <div className="space-y-4">
      <ListesChatBot onItemCreated={handleItemCreatedByChatbot} />

      <AdminHero
        icon={ListChecks}
        eyebrow="Gestion pratique"
        title="Mes listes"
        subtitle="Courses, matériaux et tâches du quotidien"
        badges={["Dashboard", "Vue liste"]}
        gradient="linear-gradient(135deg, var(--color-accent-olive-500), var(--color-accent-olive-400))"
        iconTint="rgba(255,255,255,0.14)"
        rightContent={
          <div className="flex rounded-lg p-1 gap-1 bg-white/10 border border-white/25">
            <button
              onClick={() => setViewMode("dashboard")}
              className="px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5"
              style={viewMode === "dashboard"
                ? { backgroundColor: "rgba(255,255,255,0.16)", color: "var(--color-text-inverse)", boxShadow: "var(--shadow-sm)" }
                : { color: "var(--color-text-inverse)" }}
            >
              <LayoutDashboard className="w-3.5 h-3.5" /><span className="hidden sm:inline">Dashboard</span>
            </button>
            <button
              onClick={() => setViewMode("liste")}
              className="px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5"
              style={viewMode === "liste"
                ? { backgroundColor: "rgba(255,255,255,0.16)", color: "var(--color-text-inverse)", boxShadow: "var(--shadow-sm)" }
                : { color: "var(--color-text-inverse)" }}
            >
              <ListChecks className="w-3.5 h-3.5" /><span className="hidden sm:inline">Liste</span>
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-neutral-200 shadow-sm"><CardContent className="p-4"><div className="text-xs text-neutral-500 mb-1">Total</div><div className="text-3xl font-bold text-neutral-900">{totalItems}</div></CardContent></Card>
        <Card className="border-red-200 shadow-sm"><CardContent className="p-4"><div className="text-xs text-red-600 mb-1"> Urgent</div><div className="text-3xl font-bold text-red-600">{urgentItems.length}</div></CardContent></Card>
        <Card className="border-orange-200 shadow-sm"><CardContent className="p-4"><div className="text-xs text-orange-600 mb-1"> Important</div><div className="text-3xl font-bold text-orange-600">{importantItems.length}</div></CardContent></Card>
        <Card className="border-green-200 shadow-sm"><CardContent className="p-4"><div className="text-xs text-green-600 mb-1">Fait</div><div className="text-3xl font-bold text-green-600">{doneItems}</div></CardContent></Card>
      </div>

      <Card className="border-yellow-200 shadow-lg">
        <CardContent className="p-6">
          <div className="flex gap-3">
            <Input value={newItem} onChange={(e) => setNewItem(e.target.value)} onKeyPress={(e) => { if (e.key === 'Enter') handleAddItem(); }} placeholder="Ajouter un nouvel item..." className="text-sm" />
            <div className="flex gap-2">
              {Object.entries(categories).map(([key, cat]) => {
                const Icon = cat.icon;
                return (
                  <Button key={key} size="sm" variant={selectedCategorie === key ? "default" : "outline"} onClick={() => setSelectedCategorie(key)} className={selectedCategorie === key ? `${cat.color} hover:opacity-90 text-white` : ''} title={cat.label}>
                    <Icon className="w-4 h-4" />
                  </Button>
                );
              })}
              <Button onClick={handleAddItem} className="bg-amber-600 hover:bg-amber-700"><Plus className="w-4 h-4 mr-2" />Ajouter</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {viewMode === "dashboard" && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {urgentItems.length > 0 && (
            <Card className="md:col-span-2 lg:col-span-2 border-red-300 shadow-lg bg-gradient-to-br from-red-50 to-white">
              <CardHeader className="border-b bg-red-100/50 p-4">
                <CardTitle className="text-red-900 flex items-center gap-2"> Urgent <Badge className="bg-red-600 text-white">{urgentItems.length}</Badge></CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-2 max-h-[400px] overflow-y-auto">
                {urgentItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg bg-white border-2 border-red-200">
                    <button onClick={() => handleToggleItem(item)} className="flex-shrink-0 w-6 h-6 rounded border-2 border-red-400 hover:bg-red-400 flex items-center justify-center">
                      {item.fait && <Check className="w-4 h-4 text-white" />}
                    </button>
                    <span className="flex-1 text-sm text-neutral-800 font-medium">{item.titre}</span>
                    <button onClick={() => handleDeleteItem(item.id)} className="flex-shrink-0 text-red-600 hover:text-red-800 p-1"><X className="w-4 h-4" /></button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {Object.entries(groupedItems).map(([key, itemsInCategory]) => {
            const categoryItems = itemsInCategory.filter(i => !i.fait);
            if (categoryItems.length === 0) return null;
            const cat = categories[key];
            const Icon = cat.icon;

            return (
              <Card key={key} className="border-neutral-200 shadow-lg">
                <CardHeader className={`border-b p-4 ${cat.lightColor}`}>
                  <CardTitle className={`flex items-center gap-2 ${cat.textColor}`}>
                    <Icon className="w-5 h-5" />{cat.label}<Badge className={cat.color + " text-white"}>{categoryItems.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-2 max-h-[300px] overflow-y-auto">
                  {categoryItems.slice(0, 5).map((item) => (
                    <div key={item.id} className="flex items-center gap-2 p-2 rounded-lg bg-neutral-50 border">
                      <button onClick={() => handleToggleUrgence(item)} className="flex-shrink-0 text-sm">{getUrgenceIcon(item.urgence)}</button>
                      <button onClick={() => handleToggleItem(item)} className="flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center">
                        {item.fait && <Check className="w-3 h-3" />}
                      </button>
                      <span className="flex-1 text-xs truncate">{item.titre}</span>
                      <button onClick={() => handleDeleteItem(item.id)} className="flex-shrink-0 text-neutral-400 hover:text-red-600"><X className="w-3 h-3" /></button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {viewMode === "liste" && (
        <div className="space-y-3">
          {Object.entries(categories).map(([key, cat]) => {
            const categoryItems = groupedItems[key] || [];
            if (categoryItems.length === 0) return null;
            const Icon = cat.icon;
            const notDone = categoryItems.filter(i => !i.fait).length;

            return (
              <Card key={key} className="border-neutral-200 shadow-lg">
                <button onClick={() => toggleCategory(key)} className={`w-full flex items-center justify-between p-4 ${cat.lightColor}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg ${cat.color} flex items-center justify-center`}><Icon className="w-5 h-5 text-white" /></div>
                    <span className={`font-bold ${cat.textColor}`}>{cat.label}</span>
                    <Badge className={cat.color + " text-white"}>{notDone}/{categoryItems.length}</Badge>
                  </div>
                  {expandedCategories[key] ? <ChevronUp className={`w-5 h-5 ${cat.textColor}`} /> : <ChevronDown className={`w-5 h-5 ${cat.textColor}`} />}
                </button>

                {expandedCategories[key] && (
                  <CardContent className="p-4 space-y-2">
                    {categoryItems.map((item) => (
                      <div key={item.id} className={`flex items-center gap-3 p-3 rounded-lg border-2 ${item.fait ? 'bg-green-50 border-green-200 opacity-70' : 'bg-white border-neutral-200'}`}>
                        <button onClick={() => handleToggleUrgence(item)} className="flex-shrink-0 text-lg">{getUrgenceIcon(item.urgence)}</button>
                        <button onClick={() => handleToggleItem(item)} className={`flex-shrink-0 w-6 h-6 rounded border-2 flex items-center justify-center ${item.fait ? 'bg-green-500 border-green-500' : 'border-neutral-300'}`}>
                          {item.fait && <Check className="w-4 h-4 text-white" />}
                        </button>
                        <span className={`flex-1 text-sm ${item.fait ? 'line-through text-neutral-500' : 'text-neutral-800'}`}>{item.titre}</span>
                        <button onClick={() => handleDeleteItem(item.id)} className="flex-shrink-0 text-red-600 hover:text-red-800"><X className="w-4 h-4" /></button>
                      </div>
                    ))}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SettingsContent({ user, handleLogout }) {
  return (
    <div className="space-y-6">
      <div
        className="relative overflow-hidden rounded-2xl border shadow-lg p-6 sm:p-8"
        style={{
          background: "linear-gradient(135deg, var(--color-secondary-500), var(--color-accent-warm-400))",
          color: "var(--color-text-inverse)",
          borderColor: "rgba(255,255,255,0.18)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <div
          className="absolute inset-0 opacity-25"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.45) 0, rgba(255,255,255,0) 40%), radial-gradient(circle at 80% 10%, rgba(255,255,255,0.25) 0, rgba(255,255,255,0) 35%)",
          }}
        />
        <div className="relative flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.25)" }}
              >
                <Settings className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-white/80">Gestion Web • Assistant Client</p>
                <h2 className="text-2xl sm:text-3xl font-bold">Parametres</h2>
                <p className="text-sm text-white/80">Personnalise ta console admin et garde les acces au propre.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-white/15 text-white border border-white/25">Profil actif</Badge>
              <Badge className="bg-white/15 text-white border border-white/25">Derniere maj : aujourd'hui</Badge>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-white/25 bg-white/10 p-3">
              <p className="text-xs text-white/70 mb-1">Identite</p>
              <p className="text-sm font-semibold truncate">{user?.full_name || "Administrateur"}</p>
            </div>
            <div className="rounded-xl border border-white/25 bg-white/10 p-3">
              <p className="text-xs text-white/70 mb-1">Email</p>
              <p className="text-sm font-semibold truncate">{user?.email || "admin@site.local"}</p>
            </div>
            <div className="rounded-xl border border-white/25 bg-white/10 p-3">
              <p className="text-xs text-white/70 mb-1">Espace</p>
              <p className="text-sm font-semibold flex items-center gap-2">
                Gestion Web <Sparkles className="w-4 h-4 text-white/80" />
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-neutral-200 shadow-sm lg:col-span-2" style={{ borderColor: "var(--color-border-light)" }}>
          <CardHeader className="border-b" style={{ borderColor: "var(--color-border-light)" }}>
            <CardTitle className="flex items-center gap-2 text-lg" style={{ color: "var(--color-text-primary)" }}>
              <User className="w-5 h-5 text-[var(--color-primary-500)]" /> Profil administrateur
            </CardTitle>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-4 p-6">
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-neutral-700">Nom complet</Label>
              <p className="text-neutral-600 rounded-lg border px-3 py-2" style={{ borderColor: "var(--color-border-light)" }}>
                {user?.full_name || "Non renseigne"}
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-neutral-700">Email</Label>
              <p className="text-neutral-600 rounded-lg border px-3 py-2" style={{ borderColor: "var(--color-border-light)" }}>
                {user?.email || "admin@site.local"}
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-neutral-700">Role</Label>
              <div className="flex items-center gap-2">
                <Badge className="badge-primary">Superviseur</Badge>
                <Badge className="badge-secondary">Edition</Badge>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-neutral-700">Zones actives</Label>
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-[var(--color-primary-100)] text-[var(--color-primary-600)] border border-[var(--color-primary-300)]">Gestion Web</Badge>
                <Badge className="bg-[var(--color-secondary-100)] text-[var(--color-secondary-600)] border border-[var(--color-secondary-300)]">Assistant Client</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-neutral-200 shadow-lg" style={{ borderColor: "var(--color-border-medium)" }}>
          <CardHeader className="border-b" style={{ borderColor: "var(--color-border-light)" }}>
            <CardTitle className="flex items-center gap-2 text-lg" style={{ color: "var(--color-text-primary)" }}>
              <Shield className="w-5 h-5 text-[var(--color-secondary-500)]" /> Securite
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            <div className="rounded-lg border p-3 bg-[var(--color-info-bg)]" style={{ borderColor: "var(--color-info-border)" }}>
              <p className="text-sm font-semibold" style={{ color: "var(--color-info-text)" }}>Authentification Base44 activee</p>
              <p className="text-xs mt-1 opacity-80" style={{ color: "var(--color-info-text)" }}>Session chiffree, acces restreint aux administrateurs.</p>
            </div>
            <div className="flex items-center justify-between text-sm text-neutral-700">
              <span>Session actuelle</span>
              <Badge className="badge-secondary">Connecte</Badge>
            </div>
            <Button onClick={handleLogout} variant="outline" className="w-full text-red-600 border-red-600 hover:bg-red-50">
              <LogOut className="w-4 h-4 mr-2" />Se deconnecter
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="border-neutral-200 shadow-sm">
        <CardHeader className="border-b" style={{ borderColor: "var(--color-border-light)" }}>
          <CardTitle className="flex items-center gap-2 text-lg" style={{ color: "var(--color-text-primary)" }}>
            <Wrench className="w-5 h-5 text-[var(--color-accent-olive-500)]" /> Preferences visuelles
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 grid sm:grid-cols-3 gap-4">
          <div className="rounded-lg border p-3" style={{ borderColor: "var(--color-border-light)", background: "var(--color-primary-100)" }}>
            <p className="text-sm font-semibold" style={{ color: "var(--color-primary-600)" }}>Mode atelier</p>
            <p className="text-xs opacity-80" style={{ color: "var(--color-primary-600)" }}>Palette terre cuite</p>
          </div>
          <div className="rounded-lg border p-3" style={{ borderColor: "var(--color-border-light)", background: "var(--color-secondary-100)" }}>
            <p className="text-sm font-semibold" style={{ color: "var(--color-secondary-600)" }}>Accent calanques</p>
            <p className="text-xs opacity-80" style={{ color: "var(--color-secondary-600)" }}>Bleu profond</p>
          </div>
          <div className="rounded-lg border p-3" style={{ borderColor: "var(--color-border-light)", background: "var(--color-accent-olive-100)" }}>
            <p className="text-sm font-semibold" style={{ color: "var(--color-accent-olive-500)" }}>Touches olivier</p>
            <p className="text-xs opacity-80" style={{ color: "var(--color-accent-olive-500)" }}>Contraste doux</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  return (
    <Button
      variant="ghost"
      size="icon"
      className="btn-ghost"
      onClick={toggleTheme}
      title={isDark ? "Mode clair" : "Mode sombre"}
      style={{ color: "var(--color-text-inverse)" }}
    >
      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </Button>
  );
}

