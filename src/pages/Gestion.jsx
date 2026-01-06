
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
  RefreshCw,
  User,
  Users,
  FileText,
  Pin,
  PinOff,
  MapPin,
  Sparkles,
  ArrowRight,
  Clock,
  LinkIcon,
  BookOpen,
  Copy,
  Sun,
  Moon,
  Receipt,
  Euro,
  FolderOpen
} from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import AdminProjetCard from "../components/admin/AdminProjetCard";
import AdminProjetForm from "../components/admin/AdminProjetForm";
import PlanningChatBot from "../components/admin/PlanningChatBot";
import GestionChatBot from "../components/admin/GestionChatBot";
import { AdminHero, AdminPanel } from "../components/admin/AdminHero";
import { useTheme } from "@/context/ThemeContext";
import { sendAssistantMessage } from "@/api/assistantClient";
import { DocumentsContent } from "../components/documents";
import ClientsDirectory from "../components/documents/ClientsDirectory";
import { CalendarTimeline } from "../components/calendar";

export default function Gestion() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [activeSection, setActiveSection] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(true);
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
    { id: "documents", label: "Devis & Factures", icon: Receipt, section: "pratique" },
    { id: "clients", label: "Clients", icon: Users, section: "pratique" },
    { id: "planning", label: "Planning", icon: Calendar, section: "pratique" },
    { id: "listes", label: "Notes", icon: FileText, section: "pratique" },
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
      style={{ color: isDark ? "var(--color-text-primary)" : "#FFFFFF" }}
    >
      <GestionChatBot />

        <aside
        className={`fixed lg:sticky top-0 left-0 h-screen admin-sidebar transition-all duration-300 z-50 shadow-lg ${sidebarOpen ? "w-64" : "w-0"} overflow-hidden`}
        style={{ borderRight: `1px solid var(--color-border-light)` }}
      >
        <div className="flex flex-col h-full w-64">
          <div
            className="px-4 sm:px-6 py-5 border-b flex-shrink-0 relative overflow-hidden"
            style={{
              borderColor: "var(--color-border-light)",
              backgroundColor: "var(--color-bg-sidebar)",
            }}
          >
            <div className="relative flex items-center gap-2">
              <Shield
                className="w-5 h-5 flex-shrink-0"
                style={{ color: isDark ? "var(--color-text-primary)" : "var(--color-text-inverse)" }}
              />
              <div className="min-w-0 flex-1">
                <h2
                  className="font-semibold truncate"
                  style={{ color: isDark ? "var(--color-text-primary)" : "var(--color-text-inverse)" }}
                >
                  Administration
                </h2>
                <p
                  className="text-xs truncate"
                  style={{ color: isDark ? "var(--color-text-tertiary)" : "var(--color-text-muted)" }}
                >
                  {user?.full_name || user?.email || "Admin"}
                </p>
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
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all hover:bg-white/5"
                    style={
                      isActive
                        ? {
                            backgroundColor: "var(--color-nav-item-bg-active)",
                            color: "var(--color-nav-item-text-active)",
                            boxShadow: "var(--shadow-md), inset 3px 0 0 var(--color-accent-warm-500)",
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
          color: isDark ? "var(--color-text-primary)" : "var(--color-text-inverse)",
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
                style={{ color: isDark ? "var(--color-text-primary)" : "var(--color-text-inverse)" }}
              >
                {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </Button>

              <div className="flex-1 min-w-0">
                <h1
                  className="text-lg sm:text-xl font-semibold truncate"
                  style={{ color: isDark ? "var(--color-text-primary)" : "var(--color-text-inverse)" }}
                >
                  {navigation.find((n) => n.id === activeSection)?.label || "Tableau de bord"}
                </h1>
                <p
                  className="text-xs sm:text-sm hidden sm:block"
                  style={{ color: isDark ? "var(--color-text-tertiary)" : "var(--color-text-muted)" }}
                >
                  {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
                </p>
              </div>
            </div>

              <div className="flex items-center gap-2">
                <QuickAccessLinks activeSection={activeSection} onNavigate={handleNavigation} />
                <ThemeToggle />
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
          {activeSection === "documents" && <DocumentsContent />}
          {activeSection === "clients" && <ClientsDirectory />}
          {activeSection === "assistant-client" && <AssistantClientContent />}
          {activeSection === "assistant" && <AssistantContent />}
          {activeSection === "planning" && <PlanningContent />}
          {activeSection === "listes" && <NotesContent />}
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
    { id: "documents", label: "Devis/Factures", icon: Receipt, color: "var(--page-documents)" },
    { id: "planning", label: "Planning", icon: Calendar, color: "var(--color-secondary-500)" },
    { id: "listes", label: "Notes", icon: FileText, color: "var(--color-accent-olive-500)" },
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

// Mini chart component for CA
function MiniChart({ data, color = "#10b981" }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map(d => d.value), 1);
  const width = 100 / data.length;

  return (
    <div className="flex items-end gap-1 h-16">
      {data.map((d, i) => (
        <div key={i} className="flex flex-col items-center flex-1">
          <div
            className="w-full rounded-t transition-all hover:opacity-80"
            style={{
              height: `${(d.value / max) * 100}%`,
              minHeight: d.value > 0 ? '4px' : '0',
              backgroundColor: color,
            }}
            title={`${d.label}: ${d.value.toLocaleString('fr-FR')} €`}
          />
          <span className="text-[9px] text-[var(--color-text-tertiary)] mt-1">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

function DashboardContent({ stats, setActiveSection }) {
  useEffect(() => { window.scrollTo(0, 0); }, []);
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const { data: documents = [] } = useQuery({
    queryKey: ['documents-dashboard'],
    queryFn: async () => {
      try {
        return await api.entities.Document.list() || [];
      } catch {
        return [];
      }
    },
  });

  // Documents stats
  const devis = documents.filter(d => d.type === 'devis');
  const factures = documents.filter(d => d.type === 'facture');
  const devisEnAttente = devis.filter(d => d.statut === 'envoye').length;
  const devisAcceptes = devis.filter(d => d.statut === 'accepte').length;
  const facturesPayees = factures.filter(d => d.statut === 'paye');
  const facturesEnAttente = factures.filter(d => d.statut === 'envoyee' || d.statut === 'envoye');

  const totalCA = facturesPayees.reduce((sum, d) => sum + (Number(d.total_ttc) || 0), 0);
  const totalEnCours = facturesEnAttente.reduce((sum, d) => sum + (Number(d.total_ttc) || 0), 0);
  const totalDevis = devis.reduce((sum, d) => sum + (Number(d.total_ttc) || 0), 0);

  // CA par mois (6 derniers mois)
  const monthlyCA = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthLabel = date.toLocaleDateString('fr-FR', { month: 'short' });
    const monthFactures = facturesPayees.filter(f => {
      const fDate = new Date(f.date_emission || f.created_at);
      return fDate.getMonth() === date.getMonth() && fDate.getFullYear() === date.getFullYear();
    });
    monthlyCA.push({
      label: monthLabel,
      value: monthFactures.reduce((sum, f) => sum + (Number(f.total_ttc) || 0), 0),
    });
  }

  // Derniers documents
  const recentDocs = [...documents]
    .sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at))
    .slice(0, 8);

  const formatMoney = (v) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
  const todayLabel = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  const statusColors = {
    brouillon: 'border-[var(--color-border-light)] bg-[var(--color-bg-surface-hover)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)]',
    envoye: 'border-transparent bg-blue-100 text-blue-700 hover:text-blue-700',
    envoyee: 'border-transparent bg-blue-100 text-blue-700 hover:text-blue-700',
    accepte: 'border-transparent bg-green-100 text-green-700 hover:text-green-700',
    refuse: 'border-transparent bg-red-100 text-red-700 hover:text-red-700',
    paye: 'border-transparent bg-emerald-100 text-emerald-700 hover:text-emerald-700',
    annule: 'border-[var(--color-border-light)] bg-[var(--color-bg-surface-hover)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-tertiary)]',
  };

  const statusLabels = {
    brouillon: 'Brouillon',
    envoye: 'Envoye',
    envoyee: 'Envoyee',
    accepte: 'Accepte',
    refuse: 'Refuse',
    paye: 'Paye',
    annule: 'Annule',
  };

  return (
    <div className="space-y-6">
      <AdminHero
        icon={LayoutDashboard}
        eyebrow="Gestion pratique"
        title="Tableau de bord"
        subtitle={`Aujourd'hui, ${todayLabel}`}
        badges={[
          `${devis.length} devis`,
          `${factures.length} factures`,
          `${formatMoney(totalCA)} encaisse`,
        ]}
        color="var(--page-dashboard)"
        rightContent={
          <Button
            variant="outline"
            size="sm"
            className="hero-action hero-action--solid"
            onClick={() => setActiveSection("documents")}
          >
            <Plus className="w-4 h-4" />
            Nouveau document
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="admin-card p-4" style={{ borderColor: "var(--color-border-light)" }}>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: "var(--color-success-bg)" }}
            >
              <Euro className="w-5 h-5" style={{ color: "var(--color-success-text)" }} />
            </div>
            <div>
              <p className="text-lg font-bold text-[var(--color-text-primary)]">{formatMoney(totalCA)}</p>
              <p className="text-xs text-[var(--color-text-secondary)]">CA encaisse</p>
            </div>
          </div>
        </Card>

        <Card className="admin-card p-4" style={{ borderColor: "var(--color-border-light)" }}>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: "var(--color-warning-bg)" }}
            >
              <Clock className="w-5 h-5" style={{ color: "var(--color-warning-text)" }} />
            </div>
            <div>
              <p className="text-lg font-bold text-[var(--color-text-primary)]">{formatMoney(totalEnCours)}</p>
              <p className="text-xs text-[var(--color-text-secondary)]">En attente</p>
            </div>
          </div>
        </Card>

        <Card className="admin-card p-4" style={{ borderColor: "var(--color-border-light)" }}>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: "var(--color-primary-100)" }}
            >
              <Receipt className="w-5 h-5" style={{ color: "var(--color-primary-600)" }} />
            </div>
            <div>
              <p className="text-lg font-bold text-[var(--color-text-primary)]">{devis.length}</p>
              <p className="text-xs text-[var(--color-text-secondary)]">Devis ({devisAcceptes} acceptes)</p>
            </div>
          </div>
        </Card>

        <Card className="admin-card p-4" style={{ borderColor: "var(--color-border-light)" }}>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: "var(--color-secondary-100)" }}
            >
              <FileText className="w-5 h-5" style={{ color: "var(--color-secondary-600)" }} />
            </div>
            <div>
              <p className="text-lg font-bold text-[var(--color-text-primary)]">{factures.length}</p>
              <p className="text-xs text-[var(--color-text-secondary)]">Factures ({facturesPayees.length} payees)</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Documents et Actions */}
      <div className="grid lg:grid-cols-2 gap-6">
        <AdminPanel
          icon={FileText}
          title="Documents recents"
          accent="secondary"
          rightContent={
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              onClick={() => setActiveSection("documents")}
            >
              Voir tout <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          }
        >
          {recentDocs.length > 0 ? (
            <div className="space-y-2">
              {recentDocs.slice(0, 4).map((doc) => {
                const docLabel = doc.type === "devis" ? "Devis" : doc.type === "facture" ? "Facture" : "Document";
                const clientLabel = [doc.client_nom, doc.client_prenom].filter(Boolean).join(" ");
                return (
                  <div
                    key={doc.id}
                    onClick={() => setActiveSection("documents")}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors text-[var(--color-text-primary)]"
                  >
                    <div
                      className={`w-8 h-8 rounded flex items-center justify-center ${
                        doc.type === "devis" ? "bg-blue-100 dark:bg-blue-900/30" : "bg-green-100 dark:bg-green-900/30"
                      }`}
                    >
                      {doc.type === "devis" ? (
                        <Receipt className="w-4 h-4 text-blue-600" />
                      ) : (
                        <FileText className="w-4 h-4 text-green-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                          {docLabel} {doc.numero || "#"}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 ${statusColors[doc.statut] || "border-transparent bg-gray-100 text-gray-700"}`}
                        >
                          {statusLabels[doc.statut] || doc.statut}
                        </Badge>
                      </div>
                      <p className="text-xs text-[var(--color-text-secondary)] truncate">
                        {clientLabel || "Client"} - {formatMoney(doc.total_ttc || 0)}
                      </p>
                    </div>
                    <span className="text-xs text-[var(--color-text-secondary)]">
                      {new Date(doc.date_emission || doc.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-6">
              <FileText className="w-8 h-8 mx-auto mb-2 text-[var(--color-text-tertiary)] opacity-40" />
              <p className="text-sm text-[var(--color-text-secondary)]">Aucun document</p>
              <Button
                size="sm"
                variant="outline"
                className="mt-2 border-[var(--color-border-light)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-surface-hover)]"
                onClick={() => setActiveSection("documents")}
              >
                Creer un devis
              </Button>
            </div>
          )}
        </AdminPanel>

        {/* Actions rapides */}
        <AdminPanel icon={Sparkles} title="Actions rapides" accent="primary">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Nouveau devis", icon: Receipt, section: "documents", bg: "bg-blue-50 dark:bg-blue-900/20", iconColor: "text-blue-600" },
              { label: "Nouvelle facture", icon: FileText, section: "documents", bg: "bg-green-50 dark:bg-green-900/20", iconColor: "text-green-600" },
              { label: "Gerer clients", icon: Users, section: "clients", bg: "bg-purple-50 dark:bg-purple-900/20", iconColor: "text-purple-600" },
              { label: "Planning", icon: Calendar, section: "planning", bg: "bg-cyan-50 dark:bg-cyan-900/20", iconColor: "text-cyan-600" },
              { label: "Projets", icon: FolderOpen, section: "projets", bg: "bg-orange-50 dark:bg-orange-900/20", iconColor: "text-orange-600" },
              { label: "Assistant IA", icon: Sparkles, section: "assistant", bg: "bg-amber-50 dark:bg-amber-900/20", iconColor: "text-amber-600" },
            ].map((action) => (
              <button
                key={action.label}
                onClick={() => setActiveSection(action.section)}
                className={`flex items-center gap-3 p-3 rounded-xl border hover:shadow-md transition-all ${action.bg}`}
                style={{ borderColor: "var(--color-border-light)" }}
              >
                <action.icon className={`w-5 h-5 ${action.iconColor}`} />
                <span className="text-sm font-medium text-foreground">{action.label}</span>
              </button>
            ))}
          </div>
        </AdminPanel>
      </div>

      {/* Evolution du CA */}
      <AdminPanel
        icon={Euro}
        title="Evolution du CA"
        rightContent={<span className="text-xs text-[var(--color-text-tertiary)]">6 derniers mois</span>}
      >
        <MiniChart data={monthlyCA} color="#10b981" />
        <div className="mt-3 pt-3 border-t flex justify-between text-xs">
          <span className="text-[var(--color-text-secondary)]">Total periode</span>
          <span className="font-semibold">{formatMoney(monthlyCA.reduce((s, m) => s + m.value, 0))}</span>
        </div>
      </AdminPanel>

      {/* Aperçu Google Calendar - Pleine largeur */}
      <AdminPanel
        icon={Calendar}
        title="Agenda du mois"
        accent="olive"
        contentClassName="p-0"
        rightContent={
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            onClick={() => setActiveSection("planning")}
          >
            Voir tout <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        }
      >
        <div className="w-full rounded-b-lg overflow-hidden" style={{ height: '340px' }}>
          <iframe
            src="https://calendar.google.com/calendar/embed?src=a6a48a265c15f430290454e6e0dd9e885b3eb9fceb572248a4b78da175534a28%40group.calendar.google.com&ctz=Europe%2FParis&mode=MONTH&showTitle=0&showNav=0&showPrint=0&showCalendars=0&showTabs=0"
            style={{ border: 0, filter: isDark ? "invert(0.92) hue-rotate(180deg)" : "none" }}
            width="100%"
            height="100%"
            frameBorder="0"
            scrolling="no"
            title="Google Calendar"
          />
        </div>
      </AdminPanel>
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
        color="var(--page-projets)"
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
                <Alert className="bg-[var(--color-bg-surface-hover)]">
                  <AlertDescription className="text-center py-8">
                    {searchTerm ? "Aucun projet trouve" : "Aucun projet. Creez-en un !"}
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  <div className="bg-[var(--color-bg-surface-hover)] border border-[var(--color-border-light)] rounded-lg p-3 mb-4 text-xs md:text-sm">
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
                                      <button onClick={() => moveProjet(index, 'up')} disabled={index === 0} className="p-1.5 md:p-2 hover:bg-[var(--color-bg-surface-hover)] rounded disabled:opacity-30 bg-white border border-[var(--color-border-light)]">
                                        <ArrowUp className="w-3 h-3 md:w-4 md:h-4" />
                                      </button>
                                      <div {...provided.dragHandleProps} className="hidden md:block p-2 bg-white border border-[var(--color-border-light)] rounded cursor-grab active:cursor-grabbing">
                                        <GripVertical className="w-4 h-4 text-neutral-400" />
                                      </div>
                                      <button onClick={() => moveProjet(index, 'down')} disabled={index === filteredProjets.length - 1} className="p-1.5 md:p-2 hover:bg-[var(--color-bg-surface-hover)] rounded disabled:opacity-30 bg-white border border-[var(--color-border-light)]">
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
            <Alert className="bg-[var(--color-bg-surface-hover)]">
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
                      <button onClick={() => movePrestationOrder(index, 'up')} disabled={index === 0} className="p-1.5 hover:bg-[var(--color-bg-surface-hover)] rounded disabled:opacity-30 border border-[var(--color-border-light)]">
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button onClick={() => movePrestationOrder(index, 'down')} disabled={index === prestations.length - 1} className="p-1.5 hover:bg-[var(--color-bg-surface-hover)] rounded disabled:opacity-30 border border-[var(--color-border-light)]">
                        <ArrowDown className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <h3 className="font-bold text-neutral-800 text-sm md:text-base flex-1 min-w-0">{prestation.titre}</h3>
                        {prestation.visible ? (
                          <span className="text-xs bg-[var(--color-success-bg)] text-[var(--color-success-text)] px-2 py-0.5 rounded flex items-center gap-1 whitespace-nowrap flex-shrink-0">
                            <Eye className="w-3 h-3" /> Visible
                          </span>
                        ) : (
                          <span className="text-xs bg-[var(--color-error-bg)] text-[var(--color-error-text)] px-2 py-0.5 rounded flex items-center gap-1 whitespace-nowrap flex-shrink-0">
                            <EyeOff className="w-3 h-3" /> Masque
                          </span>
                        )}
                      </div>
                      <p className="text-xs md:text-sm text-neutral-600 mb-3 line-clamp-2">{prestation.description}</p>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleEdit(prestation)} className="text-[var(--color-primary-600)] border-[var(--color-primary-500)] hover:bg-[var(--color-primary-100)] text-xs">
                          <Edit2 className="w-3 h-3 mr-1" />Modifier
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleToggleVisibility(prestation)} className="text-neutral-600 border-[var(--color-border-medium)] hover:bg-[var(--color-bg-surface)] text-xs">
                          {prestation.visible ? <><EyeOff className="w-3 h-3 mr-1" />Masquer</> : <><Eye className="w-3 h-3 mr-1" />Afficher</>}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleDelete(prestation)} className="text-[var(--color-error-text)] border-[var(--color-error-border)] hover:bg-[var(--color-error-bg)] text-xs">
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
    <Card className="border-[var(--color-border-light)] shadow-lg mb-6">
      <CardHeader className="border-b border-[var(--color-border-light)]">
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
            <input type="checkbox" id="visible" checked={formData.visible} onChange={(e) => setFormData({ ...formData, visible: e.target.checked })} className="w-4 h-4 rounded border-[var(--color-border-medium)]" />
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
  const [leads, setLeads] = useState([]);
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [showSummary, setShowSummary] = useState(false);
  const [summary, setSummary] = useState(null);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  const scrollToBottom = () => {
    // Scroll within the container, not the whole page
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    // Only scroll if user is already near the bottom to avoid interrupting reading
    if (messagesContainerRef.current && messages.length > 0) {
      const container = messagesContainerRef.current;
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
      if (isNearBottom) {
        scrollToBottom();
      }
    }
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
    const loadLeads = async () => {
      try {
        setLoadingLeads(true);
        const data = await api.leads.list(200);
        setLeads(data || []);
      } catch (error) {
        console.error("Error loading leads:", error);
      } finally {
        setLoadingLeads(false);
      }
    };
    loadLeads();
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
        {!isUser && <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[var(--color-accent-olive-400)] to-[var(--color-accent-olive-500)] flex items-center justify-center flex-shrink-0 shadow-md"><MessageSquare className="w-5 h-5 text-white" /></div>}
        <div className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm ${isUser ? 'bg-gradient-to-br from-[var(--color-primary-500)] to-[var(--color-primary-600)] text-white' : 'bg-white border-2 border-[var(--color-border-light)] text-stone-800'}`}>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
        </div>
        {isUser && <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[var(--color-primary-500)] to-[var(--color-primary-700)] flex items-center justify-center flex-shrink-0 shadow-md"><User className="w-5 h-5 text-white" /></div>}
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
        color="var(--page-clients)"
      />

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 border-[var(--color-border-light)] shadow-lg" style={{ borderColor: "var(--color-border-light)" }}>
          <CardHeader className="border-b p-4" style={{ background: "linear-gradient(135deg, var(--color-accent-warm-100), var(--color-accent-warm-200))" }}>
            <CardTitle className="text-base flex items-center gap-2" style={{ color: "var(--color-text-primary)" }}>
              <MessageSquare className="w-5 h-5" />Conversations ({conversations.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 max-h-[600px] overflow-y-auto" style={{ backgroundColor: "var(--color-bg-surface)" }}>
            {loadingConversations ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 text-[var(--color-accent-warm-500)] animate-spin" /></div>
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

        <Card className="lg:col-span-2 border-[var(--color-border-light)] shadow-lg" style={{ borderColor: "var(--color-border-light)" }}>
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
                    <div ref={messagesContainerRef} className="h-[500px] overflow-y-auto p-6" style={{ backgroundColor: "var(--color-accent-warm-100)" }}>
                      {messages.map((message, index) => (<MessageBubble key={index} message={message} />))}
                      {isLoading && (
                        <div className="flex gap-3 justify-start mb-4">
                          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[var(--color-accent-warm-400)] to-[var(--color-accent-warm-500)] flex items-center justify-center flex-shrink-0 shadow-md">
                            <MessageSquare className="w-5 h-5 text-white" />
                          </div>
                          <div className="bg-white border-2 border-[var(--color-border-light)] rounded-2xl px-4 py-3 shadow-sm">
                            <div className="flex gap-1">
                              <div className="w-2 h-2 bg-[var(--color-accent-warm-500)] rounded-full animate-bounce"></div>
                              <div className="w-2 h-2 bg-[var(--color-accent-warm-500)] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                              <div className="w-2 h-2 bg-[var(--color-accent-warm-500)] rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                            </div>
                          </div>
                        </div>
                      )}
                      <div ref={messagesEndRef} />
                    </div>
                    <div className="p-4 border-t-2 bg-white" style={{ borderColor: 'var(--color-accent-warm-300)' }}>
                      <div className="flex gap-3">
                        <Textarea value={inputMessage} onChange={(e) => setInputMessage(e.target.value)} onKeyPress={handleKeyPress} placeholder="Repondre au client..." className="resize-none text-sm" rows={2} disabled={isLoading} style={{ borderColor: "var(--color-warning-border)" }} />
                        <Button onClick={handleSendMessage} disabled={!inputMessage.trim() || isLoading} className="px-6 shadow-lg btn-primary">
                          <Send className="w-5 h-5" />
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="p-6 max-h-[600px] overflow-y-auto">
                    {summary?.error ? (
                      <div className="text-center"><AlertCircle className="w-12 h-12 mx-auto mb-3 text-[var(--color-error-text)]" /><p className="text-[var(--color-error-text)]">{summary.error}</p></div>
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
                      <div className="flex items-center justify-center h-96"><Loader2 className="w-8 h-8 text-[var(--color-accent-warm-500)] animate-spin" /></div>
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

      <Card className="border-[var(--color-border-light)] shadow-lg" style={{ borderColor: "var(--color-border-light)" }}>
        <CardHeader className="border-b p-4" style={{ background: "linear-gradient(135deg, var(--color-accent-warm-100), var(--color-accent-warm-200))" }}>
          <CardTitle className="text-base flex items-center gap-2" style={{ color: "var(--color-text-primary)" }}>
            <FileText className="w-5 h-5" />Demandes formulaire ({leads.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4" style={{ backgroundColor: "var(--color-bg-surface)" }}>
          {loadingLeads ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 text-[var(--color-accent-warm-500)] animate-spin" /></div>
          ) : leads.length === 0 ? (
            <div className="text-center py-8 text-stone-500">
              <FileText className="w-12 h-12 mx-auto mb-3 text-stone-300" />
              <p className="text-sm">Aucune demande</p>
            </div>
          ) : (
            <div className="space-y-3">
              {leads.map((lead) => {
                const sourceLabel = lead.source === "assistant" ? "Assistant IA" : "Formulaire";
                const createdLabel = lead.created_at
                  ? new Date(lead.created_at).toLocaleDateString("fr-FR")
                  : "";
                return (
                  <div
                    key={lead.id}
                    className="rounded-lg border p-4"
                    style={{
                      borderColor: "var(--color-border-light)",
                      backgroundColor: "var(--color-bg-surface)",
                    }}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate" style={{ color: "var(--color-text-primary)" }}>
                          {lead.name || lead.email || "Sans nom"}
                        </p>
                        <p className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>
                          {lead.project_type || "Type a preciser"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          className="badge-secondary"
                          style={{
                            backgroundColor: "var(--color-accent-warm-100)",
                            color: "var(--color-primary-600)",
                          }}
                        >
                          {sourceLabel}
                        </Badge>
                        {createdLabel && (
                          <span className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>
                            {createdLabel}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 text-xs" style={{ color: "var(--color-text-secondary)" }}>
                      {lead.email && <span>{lead.email}</span>}
                      {lead.email && lead.phone && <span> • </span>}
                      {lead.phone && <span>{lead.phone}</span>}
                    </div>
                    {lead.description && (
                      <p className="mt-2 text-xs" style={{ color: "var(--color-text-tertiary)" }}>
                        {lead.description}
                      </p>
                    )}
                    {Array.isArray(lead.photos) && lead.photos.length > 0 && (
                      <p className="mt-2 text-xs" style={{ color: "var(--color-text-tertiary)" }}>
                        Photos: {lead.photos.length}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

const PERSONAL_ASSISTANT_PROMPT = `Tu es l'assistant personnel interne de L'Atelier des Espaces.

Ta mission: aider le gerant a piloter l'activite (planning, chantiers, taches, achats, relances, devis, suivi).

Regles:
- Pose une seule question a la fois si besoin de precision.
- Donne des conseils clairs et actionnables.
- Ne collecte pas de donnees sensibles inutiles.
- Si une action ne peut pas etre executee ici, explique et propose des etapes manuelles.

Format de reponse OBLIGATOIRE (JSON uniquement):
{
  "message": "ta reponse",
  "summary": null
}

Reponds uniquement en JSON valide.`;

const ASSISTANT_PERSONNEL_CONVERSATION_KEY = "assistant_personnel_conversation_id";
const ASSISTANT_PERSONNEL_PROMPT_KEY = "assistant_personnel_system_prompt";

function AssistantContent() {
  const { theme } = useTheme();
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(ASSISTANT_PERSONNEL_CONVERSATION_KEY);
  });
  const [systemPrompt, setSystemPrompt] = useState(() => {
    if (typeof window === "undefined") return PERSONAL_ASSISTANT_PROMPT;
    const saved = localStorage.getItem(ASSISTANT_PERSONNEL_PROMPT_KEY);
    return saved && saved.trim() ? saved : PERSONAL_ASSISTANT_PROMPT;
  });
  const [promptDraft, setPromptDraft] = useState(systemPrompt);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{
        role: 'assistant',
        content: "Salut Thomas \n\nJe suis ton assistant personnel. Je peux t'aider a :\n\n Suivre l'etat des chantiers\n Gerer les taches prioritaires\n Calculer les charges URSSAF\n Organiser le planning\n\nQu'est-ce que je peux faire pour toi ?",
        noAction: true
      }]);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (conversationId) {
      localStorage.setItem(ASSISTANT_PERSONNEL_CONVERSATION_KEY, conversationId);
    } else {
      localStorage.removeItem(ASSISTANT_PERSONNEL_CONVERSATION_KEY);
    }
  }, [conversationId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (systemPrompt && systemPrompt.trim()) {
      localStorage.setItem(ASSISTANT_PERSONNEL_PROMPT_KEY, systemPrompt);
    } else {
      localStorage.removeItem(ASSISTANT_PERSONNEL_PROMPT_KEY);
    }
  }, [systemPrompt]);

  useEffect(() => {
    if (isSettingsOpen) {
      setPromptDraft(systemPrompt);
    }
  }, [isSettingsOpen, systemPrompt]);

  const sendToAssistant = async (userMessage) => {
    const ctx = {
      agent_name: "assistant_personnel",
      page: "admin",
    };

    const result = await sendAssistantMessage({
      message: userMessage,
      conversationId,
      context: ctx,
      systemPrompt: systemPrompt && systemPrompt.trim() ? systemPrompt : PERSONAL_ASSISTANT_PROMPT,
    });

    if (!conversationId && result.conversationId) {
      setConversationId(result.conversationId);
    }

    return {
      message: result.reply || "Reponse indisponible",
      actions: [],
      noAction: true,
    };
  };

  const handleSavePrompt = () => {
    const nextPrompt = promptDraft.trim();
    setSystemPrompt(nextPrompt ? nextPrompt : PERSONAL_ASSISTANT_PROMPT);
    setIsSettingsOpen(false);
  };

  const handleResetPrompt = () => {
    setPromptDraft(PERSONAL_ASSISTANT_PROMPT);
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;
    const userMessage = inputMessage.trim();
    setInputMessage("");
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const aiResponse = await sendToAssistant(userMessage);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: aiResponse.message,
        actions: aiResponse.actions,
        noAction: aiResponse.noAction,
      }]);
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
      : { backgroundColor: "var(--color-bg-surface)", borderColor: "var(--color-border-light)", color: "var(--color-text-primary)" };
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
          style={isUser ? { background: theme === "dark" ? "linear-gradient(135deg, var(--color-primary-300), var(--color-primary-500))" : "linear-gradient(135deg, #404040, #262626)" } : undefined}>
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
                    backgroundColor: theme === "dark" ? "var(--color-success-bg)" : "var(--color-success-bg)",
                    borderColor: theme === "dark" ? "var(--color-success-border)" : "var(--color-success-border)",
                    color: theme === "dark" ? "var(--color-text-primary)" : "var(--color-success-text)",
                  }}
                >
                  <div className="flex items-center gap-2 mb-2" style={{ color: "var(--color-success-icon)" }}>
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
        {isUser && <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[var(--color-primary-500)] to-[var(--color-primary-700)] flex items-center justify-center flex-shrink-0 shadow-lg"><span className="text-white text-sm font-bold">T</span></div>}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <AdminHero
        icon={Lightbulb}
        eyebrow="Assistant interne"
        title="Pilotage intelligent"
        subtitle="Gestion des taches, suivi quotidien et conseils"
        badges={["Conseils", "Organisation", "Suivi"]}
        color="var(--page-assistant)"
      />

      <Card className="border-[var(--color-border-light)] shadow-lg" style={{ borderColor: "var(--color-border-light)" }}>
        <CardHeader
          className="p-6"
          style={{
            background:
              theme === "dark"
                ? "linear-gradient(135deg, var(--color-bg-surface), var(--color-bg-surface-hover))"
                : "linear-gradient(135deg, var(--color-accent-warm-100), var(--color-accent-warm-200))",
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-xl" style={{ color: "var(--color-text-primary)" }}>Assistant personnel</CardTitle>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsSettingsOpen(true)}
              className="btn-tertiary"
              style={{ color: "var(--color-text-secondary)" }}
            >
              <Settings className="w-4 h-4 mr-2" />
              Reglages
            </Button>
          </div>
          <p className="text-xs mt-2" style={{ color: "var(--color-text-tertiary)" }}>
            Message systeme: {systemPrompt === PERSONAL_ASSISTANT_PROMPT ? "par defaut" : "personnalise"}
          </p>
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
              <Textarea value={inputMessage} onChange={(e) => setInputMessage(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())} placeholder="Ex: Ou j'en suis sur le chantier Dupont ?" className="resize-none text-sm" rows={2} disabled={isLoading} style={{ borderColor: "var(--color-warning-border)" }} />
              <Button onClick={handleSendMessage} disabled={!inputMessage.trim() || isLoading} className="px-6 shadow-lg btn-primary">
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin text-[var(--color-text-primary)]" /> : <Send className="w-5 h-5 text-[var(--color-text-primary)]" />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent
          className="sm:max-w-[720px]"
          style={{
            backgroundColor: "var(--color-bg-surface)",
            color: "var(--color-text-primary)",
            borderColor: "var(--color-border-light)",
          }}
        >
          <DialogHeader>
            <DialogTitle>Reglages assistant personnel</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="assistant-personnel-system">Message systeme</Label>
              <Textarea
                id="assistant-personnel-system"
                value={promptDraft}
                onChange={(e) => setPromptDraft(e.target.value)}
                rows={10}
                className="text-sm"
              />
              <p className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>
                Garde le format JSON pour des reponses stables.
              </p>
            </div>
            <div className="flex items-center justify-between gap-3">
              <Button type="button" variant="ghost" className="btn-tertiary" onClick={handleResetPrompt}>
                Revenir au prompt par defaut
              </Button>
              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" className="btn-tertiary" onClick={() => setIsSettingsOpen(false)}>
                  Annuler
                </Button>
                <Button type="button" className="btn-primary" onClick={handleSavePrompt}>
                  Enregistrer
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PlanningContent() {
  const queryClient = useQueryClient();

  useEffect(() => { window.scrollTo(0, 0); }, []);

  const handleEventCreatedByChatbot = () => {
    queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
  };

  const handleOpenNewRdv = () => {
    window.dispatchEvent(new CustomEvent('open-new-rdv'));
  };

  return (
    <div className="space-y-6">
      <PlanningChatBot onEventCreated={handleEventCreatedByChatbot} />

      <AdminHero
        icon={Calendar}
        eyebrow="Gestion pratique"
        title="Planning"
        subtitle="Calendrier synchronise avec Google Calendar"
        badges={["Google Calendar", "RDV Clients", "Synchro temps reel"]}
        color="var(--page-planning)"
        rightContent={
          <Button
            onClick={handleOpenNewRdv}
            className="hero-action hero-action--solid"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nouveau RDV
          </Button>
        }
      />

      <Card className="admin-card overflow-hidden" style={{ borderColor: "var(--color-border-light)" }}>
        <CardContent className="p-0" style={{ height: "calc(100vh - 320px)", minHeight: "600px" }}>
          <CalendarTimeline />
        </CardContent>
      </Card>
    </div>
  );
}


const NOTE_COLORS = [
  { id: "sand", label: "Sable", bg: "bg-[var(--color-secondary-100)]", border: "border-[var(--color-secondary-300)]", text: "text-[var(--color-secondary-700)]", dot: "bg-[var(--color-secondary-500)]" },
  { id: "sage", label: "Sauge", bg: "bg-[var(--color-accent-olive-100)]", border: "border-[var(--color-accent-olive-300)]", text: "text-[var(--color-accent-olive-500)]", dot: "bg-[var(--color-accent-olive-400)]" },
  { id: "sky", label: "Ciel", bg: "bg-[var(--color-primary-100)]", border: "border-[var(--color-primary-300)]", text: "text-[var(--color-primary-700)]", dot: "bg-[var(--color-primary-500)]" },
  { id: "rose", label: "Rose", bg: "bg-[var(--color-accent-warm-100)]", border: "border-[var(--color-accent-warm-300)]", text: "text-[var(--color-accent-warm-500)]", dot: "bg-[var(--color-accent-warm-400)]" },
  { id: "stone", label: "Pierre", bg: "bg-[var(--color-bg-surface-hover)]", border: "border-[var(--color-border-light)]", text: "text-[var(--color-text-primary)]", dot: "bg-[var(--color-border-medium)]" },
];

const resolveNoteColor = (colorId) => NOTE_COLORS.find((color) => color.id === colorId) || NOTE_COLORS[0];

const noteLabel = (note) => {
  const title = (note?.title || "").toString().trim();
  return title || "Note sans titre";
};

const noteTimestamp = (note) => note?.updated_at || note?.created_at || null;

function NotesContent() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [draft, setDraft] = useState({
    title: "",
    content: "",
    color: NOTE_COLORS[0].id,
    pinned: false,
  });
  const [editingNote, setEditingNote] = useState(null);
  const [editDraft, setEditDraft] = useState({
    title: "",
    content: "",
    color: NOTE_COLORS[0].id,
    pinned: false,
  });

  useEffect(() => { window.scrollTo(0, 0); }, []);

  const { data: notes = [] } = useQuery({
    queryKey: ['notes'],
    queryFn: () => api.entities.Note.list('updated_at'),
  });

  const createMutation = useMutation({
    mutationFn: (data) => api.entities.Note.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notes'] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.entities.Note.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notes'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.entities.Note.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notes'] }),
  });

  const normalizedNotes = notes.map((note) => ({
    ...note,
    pinned: Boolean(note?.pinned),
    archived: Boolean(note?.archived),
    color: note?.color || NOTE_COLORS[0].id,
  }));

  const term = searchTerm.trim().toLowerCase();
  const visibleNotes = normalizedNotes.filter((note) => !note.archived);
  const filteredNotes = visibleNotes.filter((note) => {
    if (!term) return true;
    const haystack = `${note?.title || ""} ${note?.content || ""}`.toLowerCase();
    return haystack.includes(term);
  });

  const sortByRecent = (a, b) => {
    const aTime = new Date(noteTimestamp(a) || 0).getTime();
    const bTime = new Date(noteTimestamp(b) || 0).getTime();
    return bTime - aTime;
  };

  const pinnedNotes = filteredNotes.filter((note) => note.pinned).sort(sortByRecent);
  const otherNotes = filteredNotes.filter((note) => !note.pinned).sort(sortByRecent);

  const handleCreateNote = () => {
    const title = draft.title.trim();
    const content = draft.content.trim();
    if (!title && !content) return;
    createMutation.mutate({
      title: title || null,
      content: content || null,
      color: draft.color,
      pinned: draft.pinned,
      archived: false,
    });
    setDraft((prev) => ({
      ...prev,
      title: "",
      content: "",
      pinned: false,
    }));
  };

  const handleTogglePin = (note) => {
    updateMutation.mutate({ id: note.id, data: { pinned: !note.pinned } });
  };

  const handleDeleteNote = (note) => {
    if (!note?.id) return;
    if (confirm("Supprimer cette note ?")) {
      deleteMutation.mutate(note.id);
    }
  };

  const openEdit = (note) => {
    setEditingNote(note);
    setEditDraft({
      title: note?.title || "",
      content: note?.content || "",
      color: note?.color || NOTE_COLORS[0].id,
      pinned: Boolean(note?.pinned),
    });
  };

  const closeEdit = () => {
    setEditingNote(null);
    setEditDraft({
      title: "",
      content: "",
      color: NOTE_COLORS[0].id,
      pinned: false,
    });
  };

  const handleSaveEdit = () => {
    if (!editingNote) return;
    const title = editDraft.title.trim();
    const content = editDraft.content.trim();
    if (!title && !content) return;
    updateMutation.mutate({
      id: editingNote.id,
      data: {
        title: title || null,
        content: content || null,
        color: editDraft.color,
        pinned: editDraft.pinned,
      },
    });
    closeEdit();
  };

  const formatNoteDate = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
  };

  const totalNotes = visibleNotes.length;
  const pinnedCount = visibleNotes.filter((note) => note.pinned).length;

  return (
    <div className="space-y-4">
      <AdminHero
        icon={FileText}
        eyebrow="Gestion pratique"
        title="Notes"
        subtitle="Un bloc-notes inspire de Google Keep"
        badges={["Epinglage", "Recherche", "Couleurs"]}
        color="var(--page-notes)"
        iconTint="rgba(255,255,255,0.14)"
      />

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 border-[var(--color-border-light)] shadow-lg">
          <CardHeader className="border-b p-5" style={{ borderColor: "var(--color-border-light)" }}>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-lg flex items-center gap-2" style={{ color: "var(--color-text-primary)" }}>
                <FileText className="w-5 h-5" />Nouvelle note
              </CardTitle>
              <Button
                variant={draft.pinned ? "default" : "outline"}
                size="sm"
                onClick={() => setDraft((prev) => ({ ...prev, pinned: !prev.pinned }))}
                className={draft.pinned ? "bg-[var(--color-secondary-500)] hover:bg-[var(--color-secondary-600)] text-white" : ""}
              >
                {draft.pinned ? <PinOff className="w-4 h-4 mr-2" /> : <Pin className="w-4 h-4 mr-2" />}
                {draft.pinned ? "Epinglee" : "Epingler"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <div className="space-y-3">
              <Input
                value={draft.title}
                onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Titre (optionnel)"
                className="text-sm"
              />
              <Textarea
                value={draft.content}
                onChange={(e) => setDraft((prev) => ({ ...prev, content: e.target.value }))}
                placeholder="Ecris ta note..."
                rows={4}
                className="text-sm"
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {NOTE_COLORS.map((color) => (
                  <button
                    key={color.id}
                    type="button"
                    onClick={() => setDraft((prev) => ({ ...prev, color: color.id }))}
                    className={`h-7 w-7 rounded-full border ${color.bg} ${color.border} ${draft.color === color.id ? "ring-2 ring-offset-2 ring-[var(--color-secondary-500)]" : ""}`}
                    title={color.label}
                  />
                ))}
              </div>
              <Button onClick={handleCreateNote} className="bg-[var(--color-secondary-500)] hover:bg-[var(--color-secondary-600)] text-white">
                <Plus className="w-4 h-4 mr-2" />
                Ajouter
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[var(--color-border-light)] shadow-lg">
          <CardHeader className="border-b p-5" style={{ borderColor: "var(--color-border-light)" }}>
            <CardTitle className="text-lg flex items-center gap-2" style={{ color: "var(--color-text-primary)" }}>
              <Search className="w-5 h-5" />Recherche
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filtrer par titre ou contenu..."
              className="text-sm"
            />
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border p-3 text-center" style={{ borderColor: "var(--color-border-light)" }}>
                <p className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>Total</p>
                <p className="text-xl font-bold" style={{ color: "var(--color-text-primary)" }}>{totalNotes}</p>
              </div>
              <div className="rounded-lg border p-3 text-center" style={{ borderColor: "var(--color-border-light)" }}>
                <p className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>Epingles</p>
                <p className="text-xl font-bold" style={{ color: "var(--color-text-primary)" }}>{pinnedCount}</p>
              </div>
            </div>
            <div className="rounded-lg border p-3" style={{ borderColor: "var(--color-border-light)" }}>
              <p className="text-xs mb-1" style={{ color: "var(--color-text-tertiary)" }}>Astuce</p>
              <p className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
                Clique sur une note pour la modifier, ou epingle-la pour la garder en haut.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {pinnedNotes.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Pin className="w-4 h-4 text-[var(--color-secondary-600)]" />
            <h3 className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>Epingles</h3>
          </div>
          <div className="columns-1 md:columns-2 xl:columns-3 gap-4">
            {pinnedNotes.map((note) => {
              const color = resolveNoteColor(note.color);
              const title = noteLabel(note);
              const dateLabel = formatNoteDate(noteTimestamp(note));
              return (
                <div key={note.id} className="mb-4 break-inside-avoid">
                  <div className={`rounded-xl border shadow-sm p-4 ${color.bg} ${color.border}`}>
                    <div className="flex items-start justify-between gap-2">
                      <h4 className={`text-sm font-semibold ${color.text} truncate`}>{title}</h4>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleTogglePin(note)} title="Desepingler">
                          <PinOff className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(note)} title="Modifier">
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteNote(note)} title="Supprimer">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    {note?.content && (
                      <p className="mt-2 text-sm text-slate-700 whitespace-pre-wrap">{note.content}</p>
                    )}
                    <div className="mt-3 flex items-center justify-between text-xs text-slate-600">
                      <span>{dateLabel ? `Modifiee ${dateLabel}` : "Modifiee recemment"}</span>
                      <Badge className="bg-white/80 text-slate-700 border border-white/70">Epinglee</Badge>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-[var(--color-secondary-600)]" />
          <h3 className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
            {pinnedNotes.length > 0 ? "Autres notes" : "Toutes les notes"}
          </h3>
        </div>
        {otherNotes.length > 0 ? (
          <div className="columns-1 md:columns-2 xl:columns-3 gap-4">
            {otherNotes.map((note) => {
              const color = resolveNoteColor(note.color);
              const title = noteLabel(note);
              const dateLabel = formatNoteDate(noteTimestamp(note));
              return (
                <div key={note.id} className="mb-4 break-inside-avoid">
                  <div className={`rounded-xl border shadow-sm p-4 ${color.bg} ${color.border}`}>
                    <div className="flex items-start justify-between gap-2">
                      <h4 className={`text-sm font-semibold ${color.text} truncate`}>{title}</h4>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleTogglePin(note)} title="Epingler">
                          <Pin className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(note)} title="Modifier">
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteNote(note)} title="Supprimer">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    {note?.content && (
                      <p className="mt-2 text-sm text-slate-700 whitespace-pre-wrap">{note.content}</p>
                    )}
                    <div className="mt-3 flex items-center justify-between text-xs text-slate-600">
                      <span>{dateLabel ? `Modifiee ${dateLabel}` : "Modifiee recemment"}</span>
                      <div className={`h-2.5 w-2.5 rounded-full ${color.dot}`} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <Card className="border-[var(--color-border-light)] shadow-sm">
            <CardContent className="p-6 text-center">
              <FileText className="w-10 h-10 mx-auto mb-3 text-slate-300" />
              <p className="text-sm text-slate-600">Aucune note a afficher.</p>
              <p className="text-xs text-slate-500 mt-1">Ajoute-en une au-dessus.</p>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={Boolean(editingNote)} onOpenChange={(open) => { if (!open) closeEdit(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Modifier la note</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              value={editDraft.title}
              onChange={(e) => setEditDraft((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Titre"
              className="text-sm"
            />
            <Textarea
              value={editDraft.content}
              onChange={(e) => setEditDraft((prev) => ({ ...prev, content: e.target.value }))}
              placeholder="Contenu"
              rows={6}
              className="text-sm"
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {NOTE_COLORS.map((color) => (
                  <button
                    key={color.id}
                    type="button"
                    onClick={() => setEditDraft((prev) => ({ ...prev, color: color.id }))}
                    className={`h-7 w-7 rounded-full border ${color.bg} ${color.border} ${editDraft.color === color.id ? "ring-2 ring-offset-2 ring-[var(--color-secondary-500)]" : ""}`}
                    title={color.label}
                  />
                ))}
              </div>
              <Button
                variant={editDraft.pinned ? "default" : "outline"}
                size="sm"
                onClick={() => setEditDraft((prev) => ({ ...prev, pinned: !prev.pinned }))}
                className={editDraft.pinned ? "bg-[var(--color-secondary-500)] hover:bg-[var(--color-secondary-600)] text-white" : ""}
              >
                {editDraft.pinned ? <PinOff className="w-4 h-4 mr-2" /> : <Pin className="w-4 h-4 mr-2" />}
                {editDraft.pinned ? "Epinglee" : "Epingler"}
              </Button>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeEdit}>Annuler</Button>
              <Button onClick={handleSaveEdit} className="bg-[var(--color-secondary-500)] hover:bg-[var(--color-secondary-600)] text-white">
                Enregistrer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SettingsContent({ user, handleLogout }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="space-y-6">
      <AdminHero
        icon={Settings}
        eyebrow="Administration"
        title="Parametres"
        subtitle="Personnalise ta console admin et garde les acces au propre"
        badges={["Profil actif", user?.full_name || "Admin"]}
        color="var(--page-settings)"
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-[var(--color-border-light)] shadow-sm lg:col-span-2" style={{ borderColor: "var(--color-border-light)" }}>
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

        <Card className="border-[var(--color-border-light)] shadow-lg" style={{ borderColor: "var(--color-border-medium)" }}>
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
            <Button onClick={handleLogout} variant="outline" className="w-full text-[var(--color-error-text)] border-[var(--color-error-border)] hover:bg-[var(--color-error-bg)]">
              <LogOut className="w-4 h-4 mr-2" />Se deconnecter
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="border-[var(--color-border-light)] shadow-sm" style={{ backgroundColor: "var(--color-bg-surface)" }}>
        <CardHeader className="border-b" style={{ borderColor: "var(--color-border-light)" }}>
          <CardTitle className="flex items-center gap-2 text-lg" style={{ color: "var(--color-text-primary)" }}>
            <Wrench className="w-5 h-5" style={{ color: "var(--page-settings)" }} /> Preferences visuelles
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {/* Theme Toggle */}
          <div className="flex items-center justify-between p-4 rounded-xl border" style={{ borderColor: "var(--color-border-light)", backgroundColor: "var(--color-bg-elevated)" }}>
            <div className="flex items-center gap-3">
              {theme === "dark" ? (
                <Moon className="w-5 h-5" style={{ color: "var(--color-secondary-500)" }} />
              ) : (
                <Sun className="w-5 h-5" style={{ color: "var(--color-accent-warm-500)" }} />
              )}
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                  Mode {theme === "dark" ? "sombre" : "clair"}
                </p>
                <p className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>
                  {theme === "dark" ? "Nuit Mediterraneenne" : "Atelier lumineux"}
                </p>
              </div>
            </div>
            <Button
              onClick={toggleTheme}
              variant="outline"
              size="sm"
              className="gap-2"
              style={{ borderColor: "var(--color-border-medium)" }}
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              Basculer
            </Button>
          </div>

          {/* Palette de couleurs */}
          <div>
            <p className="text-sm font-semibold mb-3" style={{ color: "var(--color-text-primary)" }}>Palette active</p>
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="rounded-lg border p-3" style={{ borderColor: "var(--color-border-light)", backgroundColor: "var(--color-primary-100)" }}>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "var(--color-primary-500)" }} />
                  <p className="text-sm font-semibold" style={{ color: "var(--color-primary-600)" }}>Terre cuite</p>
                </div>
                <p className="text-xs opacity-80" style={{ color: "var(--color-primary-600)" }}>Couleur principale</p>
              </div>
              <div className="rounded-lg border p-3" style={{ borderColor: "var(--color-border-light)", backgroundColor: "var(--color-secondary-100)" }}>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "var(--color-secondary-500)" }} />
                  <p className="text-sm font-semibold" style={{ color: "var(--color-secondary-600)" }}>Calanques</p>
                </div>
                <p className="text-xs opacity-80" style={{ color: "var(--color-secondary-600)" }}>Couleur secondaire</p>
              </div>
              <div className="rounded-lg border p-3" style={{ borderColor: "var(--color-border-light)", backgroundColor: "var(--color-accent-olive-100)" }}>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "var(--color-accent-olive-500)" }} />
                  <p className="text-sm font-semibold" style={{ color: "var(--color-accent-olive-500)" }}>Olivier</p>
                </div>
                <p className="text-xs opacity-80" style={{ color: "var(--color-accent-olive-500)" }}>Accent vegetal</p>
              </div>
            </div>
          </div>

          {/* Couleurs par page */}
          <div>
            <p className="text-sm font-semibold mb-3" style={{ color: "var(--color-text-primary)" }}>Couleurs par section</p>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
              <div className="flex flex-col items-center gap-1">
                <div className="w-8 h-8 rounded-lg shadow-sm" style={{ backgroundColor: "var(--page-dashboard)" }} />
                <span className="text-[10px]" style={{ color: "var(--color-text-tertiary)" }}>Dashboard</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="w-8 h-8 rounded-lg shadow-sm" style={{ backgroundColor: "var(--page-documents)" }} />
                <span className="text-[10px]" style={{ color: "var(--color-text-tertiary)" }}>Documents</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="w-8 h-8 rounded-lg shadow-sm" style={{ backgroundColor: "var(--page-projets)" }} />
                <span className="text-[10px]" style={{ color: "var(--color-text-tertiary)" }}>Projets</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="w-8 h-8 rounded-lg shadow-sm" style={{ backgroundColor: "var(--page-planning)" }} />
                <span className="text-[10px]" style={{ color: "var(--color-text-tertiary)" }}>Planning</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="w-8 h-8 rounded-lg shadow-sm" style={{ backgroundColor: "var(--page-notes)" }} />
                <span className="text-[10px]" style={{ color: "var(--color-text-tertiary)" }}>Notes</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="w-8 h-8 rounded-lg shadow-sm" style={{ backgroundColor: "var(--page-assistant)" }} />
                <span className="text-[10px]" style={{ color: "var(--color-text-tertiary)" }}>Assistant</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="w-8 h-8 rounded-lg shadow-sm" style={{ backgroundColor: "var(--page-clients)" }} />
                <span className="text-[10px]" style={{ color: "var(--color-text-tertiary)" }}>Clients</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="w-8 h-8 rounded-lg shadow-sm" style={{ backgroundColor: "var(--page-settings)" }} />
                <span className="text-[10px]" style={{ color: "var(--color-text-tertiary)" }}>Params</span>
              </div>
            </div>
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
    <button
      type="button"
      onClick={toggleTheme}
      title={isDark ? "Mode clair" : "Mode sombre"}
      className="flex items-center justify-center w-8 h-8 rounded-lg transition-all hover:scale-105"
      style={{
        backgroundColor: "var(--color-bg-surface)",
        border: "1px solid var(--color-border-light)",
        color: "var(--color-text-secondary)",
      }}
    >
      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}

