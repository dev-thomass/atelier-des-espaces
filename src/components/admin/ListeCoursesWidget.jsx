import React, { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/apiClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  ShoppingCart, 
  Plus, 
  X, 
  Check, 
  Trash2, 
  GripVertical,
  Minimize2,
  Maximize2,
  Package,
  Wrench,
  Lightbulb,
  AlertCircle,
  ChevronDown,
  ChevronUp
} from "lucide-react";

export default function ListeCoursesWidget() {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [newItem, setNewItem] = useState("");
  const [selectedCategorie, setSelectedCategorie] = useState("courses");
  const [expandedCategories, setExpandedCategories] = useState({
    courses: true,
    materiaux: true,
    outils: true,
    a_retenir: true,
    autre: true
  });

  const widgetRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: items = [] } = useQuery({
    queryKey: ['liste-courses'],
    queryFn: () => api.entities.ListeCourse.list('ordre'),
  });

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

  const handleMouseDown = (e) => {
    if (e.target.closest('.no-drag')) return;
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging]);

  const handleAddItem = () => {
    if (!newItem.trim()) return;
    createMutation.mutate({
      titre: newItem,
      categorie: selectedCategorie,
      fait: false,
      ordre: items.length
    });
    setNewItem("");
  };

  const handleToggleItem = (item) => {
    updateMutation.mutate({
      id: item.id,
      data: { ...item, fait: !item.fait }
    });
  };

  const handleDeleteItem = (id) => {
    deleteMutation.mutate(id);
  };

  const handleDeleteDone = () => {
    items.filter(item => item.fait).forEach(item => {
      deleteMutation.mutate(item.id);
    });
  };

  const toggleCategory = (cat) => {
    setExpandedCategories(prev => ({
      ...prev,
      [cat]: !prev[cat]
    }));
  };

  const categories = {
    courses: { label: "Courses", icon: ShoppingCart, color: "bg-[var(--color-primary-100)] text-[var(--color-primary-700)]" },
    materiaux: { label: "Matériaux", icon: Package, color: "bg-purple-100 text-purple-800" },
    outils: { label: "Outils", icon: Wrench, color: "bg-[var(--color-secondary-100)] text-[var(--color-secondary-700)]" },
    a_retenir: { label: "À Retenir", icon: Lightbulb, color: "bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]" },
    autre: { label: "Autre", icon: AlertCircle, color: "bg-[var(--color-bg-surface-hover)] text-[var(--color-text-primary)]" }
  };

  const groupedItems = items.reduce((acc, item) => {
    if (!acc[item.categorie]) acc[item.categorie] = [];
    acc[item.categorie].push(item);
    return acc;
  }, {});

  const totalItems = items.length;
  const doneItems = items.filter(i => i.fait).length;

  return (
    <div
      ref={widgetRef}
      className={`fixed z-50 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: isMinimized ? '280px' : '350px',
        maxHeight: isMinimized ? 'auto' : '80vh'
      }}
      onMouseDown={handleMouseDown}
    >
      <Card className="border-2 border-[var(--color-secondary-600)] shadow-2xl bg-white/95 backdrop-blur-sm overflow-hidden">
        <CardHeader 
          className="bg-gradient-to-r from-[var(--color-secondary-600)] to-[var(--color-secondary-700)] text-white p-3 flex flex-row items-center justify-between cursor-grab active:cursor-grabbing"
        >
          <div className="flex items-center gap-2">
            <GripVertical className="w-4 h-4" />
            <ShoppingCart className="w-4 h-4" />
            <CardTitle className="text-sm font-bold">
              Mes Listes ({totalItems})
            </CardTitle>
            {doneItems > 0 && (
              <Badge className="bg-[var(--color-success-text)] text-white text-xs px-1.5 py-0.5">
                {doneItems} ✓
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-white hover:bg-white/20 no-drag"
              onClick={(e) => {
                e.stopPropagation();
                setIsMinimized(!isMinimized);
              }}
            >
              {isMinimized ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3" />}
            </Button>
          </div>
        </CardHeader>

        {!isMinimized && (
          <CardContent className="p-3 space-y-3 overflow-y-auto no-drag max-h-[calc(80vh-60px)]">
            {/* Ajout rapide */}
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  value={newItem}
                  onChange={(e) => setNewItem(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') handleAddItem();
                  }}
                  placeholder="Ajouter un item..."
                  className="text-sm"
                />
                <Button
                  size="sm"
                  onClick={handleAddItem}
                  className="bg-[var(--color-secondary-600)] hover:bg-[var(--color-secondary-700)] px-3"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              {/* Sélecteur de catégorie */}
              <div className="flex gap-1 flex-wrap">
                {Object.entries(categories).map(([key, cat]) => {
                  const Icon = cat.icon;
                  return (
                    <Button
                      key={key}
                      size="sm"
                      variant={selectedCategorie === key ? "default" : "outline"}
                      onClick={() => setSelectedCategorie(key)}
                      className={`text-xs h-7 px-2 ${
                        selectedCategorie === key 
                          ? 'bg-[var(--color-secondary-600)] hover:bg-[var(--color-secondary-700)] text-white' 
                          : 'hover:bg-[var(--color-bg-surface-hover)]'
                      }`}
                    >
                      <Icon className="w-3 h-3 mr-1" />
                      {cat.label}
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Bouton supprimer cochés */}
            {doneItems > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleDeleteDone}
                className="w-full text-xs text-[var(--color-success-text)] border-[var(--color-success-border)] hover:bg-[var(--color-success-bg)]"
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Supprimer les {doneItems} cochés
              </Button>
            )}

            {/* Listes par catégorie */}
            <div className="space-y-2">
              {Object.entries(categories).map(([key, cat]) => {
                const categoryItems = groupedItems[key] || [];
                if (categoryItems.length === 0) return null;

                const Icon = cat.icon;
                const notDone = categoryItems.filter(i => !i.fait).length;

                return (
                  <div key={key} className="border border-[var(--color-border-light)] rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleCategory(key)}
                      className="w-full flex items-center justify-between p-2 bg-[var(--color-bg-surface-hover)] hover:bg-[var(--color-bg-surface-hover)] transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="w-3 h-3 text-[var(--color-text-secondary)]" />
                        <span className="text-xs font-semibold text-[var(--color-text-primary)]">
                          {cat.label}
                        </span>
                        <Badge className={`${cat.color} text-xs px-1.5 py-0`}>
                          {notDone}/{categoryItems.length}
                        </Badge>
                      </div>
                      {expandedCategories[key] ? (
                        <ChevronUp className="w-3 h-3 text-[var(--color-text-secondary)]" />
                      ) : (
                        <ChevronDown className="w-3 h-3 text-[var(--color-text-secondary)]" />
                      )}
                    </button>

                    {expandedCategories[key] && (
                      <div className="p-2 space-y-1">
                        {categoryItems.map((item) => (
                          <div
                            key={item.id}
                            className={`flex items-center gap-2 p-2 rounded-lg border transition-all ${
                              item.fait 
                                ? 'bg-[var(--color-success-bg)] border-[var(--color-success-border)] opacity-60' 
                                : 'bg-[var(--color-bg-surface)] border-[var(--color-border-light)] hover:border-[var(--color-secondary-600)]'
                            }`}
                          >
                            <button
                              onClick={() => handleToggleItem(item)}
                              className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                                item.fait 
                                  ? 'bg-[var(--color-success-text)] border-[var(--color-success-text)]' 
                                  : 'border-[var(--color-border-medium)] hover:border-[var(--color-secondary-600)]'
                              }`}
                            >
                              {item.fait && <Check className="w-3 h-3 text-white" />}
                            </button>
                            <span className={`flex-1 text-xs ${item.fait ? 'line-through text-[var(--color-text-tertiary)]' : 'text-[var(--color-text-primary)]'}`}>
                              {item.titre}
                              {item.quantite && (
                                <span className="text-[var(--color-text-tertiary)] ml-1">({item.quantite})</span>
                              )}
                            </span>
                            <button
                              onClick={() => handleDeleteItem(item.id)}
                              className="flex-shrink-0 text-[var(--color-error-text)] hover:text-[var(--color-error-icon)] p-1"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {items.length === 0 && (
              <div className="text-center py-8 text-[var(--color-text-tertiary)]">
                <ShoppingCart className="w-8 h-8 mx-auto mb-2 text-[var(--color-text-muted)]" />
                <p className="text-xs">Aucun item</p>
                <p className="text-xs">Ajoutez-en un ci-dessus !</p>
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}
