
import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { X, Upload, Loader2, CheckCircle2, GripVertical, ArrowUp, ArrowDown } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

export default function AdminProjetForm({ projet, onCancel, onSuccess }) {
  const formRef = useRef(null);
  
  const [formData, setFormData] = useState(projet || {
    titre: "",
    description: "",
    categorie: "Autre",
    image_url: "",
    image_label: null,
    images_supplementaires: [],
    images_labels: [],
    client: "",
    annee: new Date().getFullYear().toString(),
    surface: "",
    duree: "",
    visible: true,
    mis_en_avant: false
  });

  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const categories = ["Cuisine", "Salon", "Chambre", "Salle de bain", "Bureau", "Commercial", "Autre"];

  useEffect(() => {
    if (formRef.current) {
      formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const handleChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleFileUpload = async (e, isMain = true) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);

    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      if (isMain) {
        handleChange("image_url", file_url);
      } else {
        const newImages = [...(formData.images_supplementaires || []), file_url];
        const newLabels = [...(formData.images_labels || []), null];
        setFormData({
          ...formData,
          images_supplementaires: newImages,
          images_labels: newLabels
        });
      }
    } catch (err) {
      setError("Erreur lors de l'upload de l'image");
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  const removeSupplementaryImage = (index) => {
    const newImages = formData.images_supplementaires.filter((_, i) => i !== index);
    const newLabels = formData.images_labels?.filter((_, i) => i !== index) || [];
    setFormData({
      ...formData,
      images_supplementaires: newImages,
      images_labels: newLabels
    });
  };

  const moveImage = (index, direction) => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= formData.images_supplementaires.length) return;

    const newImages = [...formData.images_supplementaires];
    const newLabels = [...(formData.images_labels || [])];

    [newImages[index], newImages[newIndex]] = [newImages[newIndex], newImages[index]];
    [newLabels[index], newLabels[newIndex]] = [newLabels[newIndex], newLabels[index]];

    setFormData({
      ...formData,
      images_supplementaires: newImages,
      images_labels: newLabels
    });
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;

    const items = Array.from(formData.images_supplementaires);
    const labels = Array.from(formData.images_labels || []);
    const [reorderedItem] = items.splice(result.source.index, 1);
    const [reorderedLabel] = labels.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    labels.splice(result.destination.index, 0, reorderedLabel);

    setFormData({
      ...formData,
      images_supplementaires: items,
      images_labels: labels
    });
  };

  const updateImageLabel = (index, label) => {
    const newLabels = [...(formData.images_labels || [])];
    newLabels[index] = label;
    handleChange("images_labels", newLabels);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      if (projet) {
        await base44.entities.Projet.update(projet.id, formData);
      } else {
        await base44.entities.Projet.create(formData);
      }
      onSuccess();
    } catch (err) {
      setError("Erreur lors de l'enregistrement");
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card ref={formRef} className="border-2 border-amber-700 shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
      <CardHeader className="bg-gradient-to-r from-amber-900 to-amber-800 text-white flex-shrink-0 py-4 px-4 md:py-6 md:px-6">
        <CardTitle className="flex items-center justify-between text-lg md:text-xl">
          <span>{projet ? "Modifier" : "Nouveau projet"}</span>
          <Button variant="ghost" size="icon" onClick={onCancel} className="text-white hover:bg-white/20 h-8 w-8 md:h-10 md:w-10">
            <X className="w-4 h-4 md:w-5 md:h-5" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 md:p-6 overflow-y-auto flex-1">
        {error && (
          <Alert className="mb-4 md:mb-6 bg-red-50 border-red-500">
            <AlertDescription className="text-red-800 text-sm">{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
          {/* Titre */}
          <div>
            <Label htmlFor="titre" className="text-stone-700 font-semibold text-sm md:text-base">
              Titre du projet *
            </Label>
            <Input
              id="titre"
              value={formData.titre}
              onChange={(e) => handleChange("titre", e.target.value)}
              required
              className="mt-2 text-sm md:text-base"
              placeholder="Ex: Rénovation Cuisine Moderne"
            />
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="description" className="text-stone-700 font-semibold text-sm md:text-base">
              Description *
            </Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleChange("description", e.target.value)}
              required
              rows={4}
              className="mt-2 text-sm md:text-base"
              placeholder="Décrivez le projet en détail..."
            />
          </div>

          {/* Catégorie */}
          <div>
            <Label className="text-stone-700 font-semibold text-sm md:text-base">Catégorie *</Label>
            <Select value={formData.categorie} onValueChange={(value) => handleChange("categorie", value)}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Image principale */}
          <div>
            <Label className="text-stone-700 font-semibold text-sm md:text-base">Image principale *</Label>
            {formData.image_url ? (
              <div className="mt-2 space-y-2">
                <div className="relative">
                  <img src={formData.image_url} alt="Preview" className="w-full h-48 md:h-64 object-cover rounded-lg" />
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    className="absolute top-2 right-2"
                    onClick={() => handleChange("image_url", "")}
                  >
                    <X className="w-3 h-3 md:w-4 md:h-4" />
                  </Button>
                </div>
                <div>
                  <Label className="text-xs md:text-sm text-stone-600">Label (optionnel)</Label>
                  <Select 
                    value={formData.image_label || "none"} 
                    onValueChange={(value) => handleChange("image_label", value === "none" ? null : value)}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Aucun label" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucun label</SelectItem>
                      <SelectItem value="avant">AVANT</SelectItem>
                      <SelectItem value="apres">APRÈS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              <div className="mt-2">
                <label className="flex flex-col items-center justify-center w-full h-48 md:h-64 border-2 border-dashed border-stone-300 rounded-lg cursor-pointer hover:bg-stone-50">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-8 h-8 md:w-10 md:h-10 text-stone-400 mb-2 md:mb-3" />
                    <p className="text-xs md:text-sm text-stone-600">Cliquez pour uploader</p>
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, true)}
                    disabled={isUploading}
                  />
                </label>
              </div>
            )}
          </div>

          {/* Images supplémentaires avec drag & drop */}
          <div>
            <Label className="text-stone-700 font-semibold text-sm md:text-base mb-2 block">
              Images supplémentaires
            </Label>
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="images">
                {(provided) => (
                  <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2 md:space-y-3 max-h-[300px] md:max-h-[400px] overflow-y-auto pr-1 md:pr-2">
                    {formData.images_supplementaires?.map((img, index) => (
                      <Draggable key={img} draggableId={img} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={`bg-white border-2 rounded-lg p-2 md:p-3 ${
                              snapshot.isDragging ? 'border-amber-700 shadow-xl' : 'border-stone-200'
                            }`}
                          >
                            <div className="flex gap-2 md:gap-3">
                              {/* Flèches Mobile - En dehors du drag handle */}
                              <div className="flex sm:hidden flex-col justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    moveImage(index, 'up');
                                  }}
                                  disabled={index === 0}
                                  className="p-1.5 hover:bg-stone-100 rounded disabled:opacity-30 bg-stone-100 border border-stone-300"
                                >
                                  <ArrowUp className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    moveImage(index, 'down');
                                  }}
                                  disabled={index === formData.images_supplementaires.length - 1}
                                  className="p-1.5 hover:bg-stone-100 rounded disabled:opacity-30 bg-stone-100 border border-stone-300"
                                >
                                  <ArrowDown className="w-3 h-3" />
                                </button>
                              </div>

                              {/* Drag Handle Desktop + Flèches */}
                              <div className="hidden sm:flex flex-col justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    moveImage(index, 'up');
                                  }}
                                  disabled={index === 0}
                                  className="p-1 hover:bg-stone-100 rounded disabled:opacity-30"
                                >
                                  <ArrowUp className="w-3 h-3 md:w-4 md:h-4" />
                                </button>
                                <div {...provided.dragHandleProps}>
                                  <GripVertical className="w-4 h-4 md:w-5 md:h-5 text-stone-400 cursor-grab active:cursor-grabbing" />
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    moveImage(index, 'down');
                                  }}
                                  disabled={index === formData.images_supplementaires.length - 1}
                                  className="p-1 hover:bg-stone-100 rounded disabled:opacity-30"
                                >
                                  <ArrowDown className="w-3 h-3 md:w-4 md:h-4" />
                                </button>
                              </div>

                              {/* Image */}
                              <img src={img} alt={`Sup ${index + 1}`} className="w-16 h-16 md:w-24 md:h-24 object-cover rounded-lg flex-shrink-0" />

                              {/* Label et suppression */}
                              <div className="flex-1 flex flex-col justify-between min-w-0">
                                <div>
                                  <Label className="text-xs text-stone-600">Label</Label>
                                  <Select 
                                    value={formData.images_labels?.[index] || "none"} 
                                    onValueChange={(value) => updateImageLabel(index, value === "none" ? null : value)}
                                  >
                                    <SelectTrigger className="mt-1 h-7 md:h-8 text-xs md:text-sm">
                                      <SelectValue placeholder="Aucun" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="none">Aucun label</SelectItem>
                                      <SelectItem value="avant">AVANT</SelectItem>
                                      <SelectItem value="apres">APRÈS</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="destructive"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    removeSupplementaryImage(index);
                                  }}
                                  className="w-fit mt-2 h-7 text-xs"
                                >
                                  <X className="w-3 h-3 mr-1" />
                                  Supprimer
                                </Button>
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

            {/* Bouton ajouter image */}
            <label className="mt-3 flex flex-col items-center justify-center w-full h-20 md:h-24 border-2 border-dashed border-stone-300 rounded-lg cursor-pointer hover:bg-stone-50">
              <div className="flex items-center gap-2">
                <Upload className="w-4 h-4 md:w-5 md:h-5 text-stone-400" />
                <span className="text-xs md:text-sm text-stone-600">Ajouter une image</span>
              </div>
              <input
                type="file"
                className="hidden"
                accept="image/*"
                onChange={(e) => handleFileUpload(e, false)}
                disabled={isUploading}
              />
            </label>
          </div>

          {/* Détails */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
            <div>
              <Label htmlFor="annee" className="text-stone-700 font-semibold text-sm">Année</Label>
              <Input
                id="annee"
                value={formData.annee}
                onChange={(e) => handleChange("annee", e.target.value)}
                className="mt-2 text-sm"
                placeholder="2024"
              />
            </div>
            <div>
              <Label htmlFor="surface" className="text-stone-700 font-semibold text-sm">Surface</Label>
              <Input
                id="surface"
                value={formData.surface}
                onChange={(e) => handleChange("surface", e.target.value)}
                className="mt-2 text-sm"
                placeholder="Ex: 25 m²"
              />
            </div>
            <div>
              <Label htmlFor="duree" className="text-stone-700 font-semibold text-sm">Durée</Label>
              <Input
                id="duree"
                value={formData.duree}
                onChange={(e) => handleChange("duree", e.target.value)}
                className="mt-2 text-sm"
                placeholder="Ex: 3 semaines"
              />
            </div>
          </div>

          {/* Options */}
          <div className="space-y-2 md:space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.visible}
                onChange={(e) => handleChange("visible", e.target.checked)}
                className="w-4 h-4 md:w-5 md:h-5 text-amber-700 rounded"
              />
              <span className="text-sm md:text-base text-stone-700 font-semibold">Visible sur le site</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.mis_en_avant}
                onChange={(e) => handleChange("mis_en_avant", e.target.checked)}
                className="w-4 h-4 md:w-5 md:h-5 text-amber-700 rounded"
              />
              <span className="text-sm md:text-base text-stone-700 font-semibold">Mettre en avant</span>
            </label>
          </div>

          {/* Actions - Sticky au bas */}
          <div className="sticky bottom-0 bg-white pt-3 md:pt-4 pb-2 flex gap-2 md:gap-3 border-t border-stone-200 -mx-3 md:-mx-6 px-3 md:px-6 -mb-3 md:-mb-6">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              className="flex-1 text-sm md:text-base"
              disabled={isSubmitting}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-amber-700 hover:bg-amber-800 text-sm md:text-base"
              disabled={isSubmitting || isUploading || !formData.image_url}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3 h-3 md:w-4 md:h-4 mr-2 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3 h-3 md:w-4 md:h-4 mr-2" />
                  {projet ? "Mettre à jour" : "Créer"}
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
