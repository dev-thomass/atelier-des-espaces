import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Eye, EyeOff } from "lucide-react";

export default function AdminProjetCard({ projet, onEdit, onDelete, onToggleVisibility }) {
  return (
    <Card className="border-2 hover:border-amber-700 transition-all duration-300 w-full">
      <CardContent className="p-3 md:p-6">
        <div className="flex gap-3 md:gap-4">
          {/* Image */}
          <div className="w-16 h-16 md:w-32 md:h-32 flex-shrink-0 rounded-lg overflow-hidden bg-stone-200">
            {projet.image_url && (
              <img
                src={projet.image_url}
                alt={projet.titre}
                className="w-full h-full object-cover"
              />
            )}
          </div>

          {/* Infos */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between mb-2 gap-2">
              <h3 className="text-sm md:text-xl font-bold text-stone-800 break-words flex-1 min-w-0">{projet.titre}</h3>
            </div>
            
            <div className="flex flex-wrap gap-1 md:gap-2 mb-2">
              <Badge className="bg-amber-100 text-amber-800 text-xs">
                {projet.categorie}
              </Badge>
              {projet.visible ? (
                <Badge className="bg-green-100 text-green-800 text-xs">
                  <Eye className="w-3 h-3 mr-1" />
                  Visible
                </Badge>
              ) : (
                <Badge className="bg-red-100 text-red-800 text-xs">
                  <EyeOff className="w-3 h-3 mr-1" />
                  Masqué
                </Badge>
              )}
              {projet.mis_en_avant && (
                <Badge className="bg-purple-100 text-purple-800 text-xs">
                  ⭐ En avant
                </Badge>
              )}
            </div>

            <p className="text-xs md:text-sm text-stone-600 mb-2 md:mb-3 line-clamp-2 break-words">
              {projet.description}
            </p>

            <div className="flex flex-wrap gap-1 text-xs text-stone-500 mb-2 md:mb-3">
              {projet.annee && <span className="whitespace-nowrap">📅 {projet.annee}</span>}
              {projet.surface && <span className="whitespace-nowrap">📏 {projet.surface}</span>}
              {projet.duree && <span className="whitespace-nowrap">⏱️ {projet.duree}</span>}
              {projet.images_supplementaires?.length > 0 && (
                <span className="whitespace-nowrap">🖼️ {projet.images_supplementaires.length + 1}</span>
              )}
            </div>

            {/* Actions - Responsive */}
            <div className="flex flex-wrap gap-1 md:gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onEdit(projet)}
                className="text-blue-600 border-blue-600 hover:bg-blue-50 text-xs px-2 md:px-3 flex-shrink-0"
              >
                <Pencil className="w-3 h-3 md:mr-1" />
                <span className="hidden md:inline">Modifier</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onToggleVisibility(projet)}
                className="text-amber-600 border-amber-600 hover:bg-amber-50 text-xs px-2 md:px-3 flex-shrink-0"
              >
                {projet.visible ? <EyeOff className="w-3 h-3 md:mr-1" /> : <Eye className="w-3 h-3 md:mr-1" />}
                <span className="hidden md:inline">{projet.visible ? "Masquer" : "Afficher"}</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onDelete(projet)}
                className="text-red-600 border-red-600 hover:bg-red-50 text-xs px-2 md:px-3 flex-shrink-0"
              >
                <Trash2 className="w-3 h-3 md:mr-1" />
                <span className="hidden md:inline">Supprimer</span>
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}