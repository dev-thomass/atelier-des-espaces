import React from "react";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Paintbrush } from "lucide-react";

const PRESET_COLORS = [
  { name: "Terre cuite", value: "#C2693F" },
  { name: "Orange", value: "#F97316" },
  { name: "Vert", value: "#22C55E" },
  { name: "Bleu clair", value: "#0EA5E9" },
  { name: "Bleu", value: "#1a5490" },
  { name: "Indigo", value: "#6366F1" },
  { name: "Violet", value: "#8B5CF6" },
  { name: "Noir", value: "#1E293B" },
];

const TABLE_STYLES = [
  { value: "rounded", label: "Bordures arrondies", description: "Coins arrondis sur les cellules" },
  { value: "horizontal", label: "Bordures horizontales", description: "Lignes horizontales uniquement" },
  { value: "vertical", label: "Bordures verticales", description: "Lignes verticales uniquement" },
  { value: "striped", label: "Lignes alternees", description: "Fond alterne sur les lignes" },
];

const FONTS = [
  { value: "Helvetica", label: "Helvetica (Standard)" },
  { value: "Times", label: "Times (Serif)" },
  { value: "Courier", label: "Courier (Monospace)" },
];

export default function DocumentAppearancePanel({ options, onChange }) {
  const updateOption = (key, value) => {
    onChange({ ...options, [key]: value });
  };

  const toggleHideOption = (key) => {
    const currentHide = options.hide || {};
    updateOption("hide", { ...currentHide, [key]: !currentHide[key] });
  };

  return (
    <div className="space-y-6 text-sm">
      {/* Couleur principale */}
      <div className="space-y-3">
        <Label className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
          Couleur principale
        </Label>
        <div className="flex flex-wrap gap-2">
          {PRESET_COLORS.map((color) => (
            <button
              key={color.value}
              type="button"
              onClick={() => updateOption("primaryColor", color.value)}
              className={`w-7 h-7 rounded-full border-2 transition-all ${
                options.primaryColor === color.value
                  ? "border-[var(--color-text-primary)] scale-110"
                  : "border-transparent hover:scale-105"
              }`}
              style={{ backgroundColor: color.value }}
              title={color.name}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded-full border border-[var(--color-border-medium)]"
            style={{ backgroundColor: options.primaryColor || "#1a5490" }}
          />
          <Input
            type="text"
            value={options.primaryColor || "#1a5490"}
            onChange={(e) => updateOption("primaryColor", e.target.value)}
            className="h-8 text-xs font-mono"
            placeholder="#1a5490"
          />
        </div>
      </div>

      {/* Police d'ecriture */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
          Police d'ecriture
        </Label>
        <Select value={options.font || "Helvetica"} onValueChange={(v) => updateOption("font", v)}>
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FONTS.map((font) => (
              <SelectItem key={font.value} value={font.value}>
                {font.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Taille du texte */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
          Taille du texte
        </Label>
        <div className="flex rounded-md border border-[var(--color-border-medium)] overflow-hidden">
          <button
            type="button"
            onClick={() => updateOption("fontSize", "normal")}
            className={`flex-1 py-1.5 text-xs font-medium transition-colors ${
              (options.fontSize || "normal") === "normal"
                ? "bg-[var(--color-primary-500)] text-white"
                : "bg-transparent hover:bg-[var(--color-bg-surface-hover)]"
            }`}
          >
            Normale
          </button>
          <button
            type="button"
            onClick={() => updateOption("fontSize", "large")}
            className={`flex-1 py-1.5 text-xs font-medium transition-colors ${
              options.fontSize === "large"
                ? "bg-[var(--color-primary-500)] text-white"
                : "bg-transparent hover:bg-[var(--color-bg-surface-hover)]"
            }`}
          >
            Grande
          </button>
        </div>
      </div>

      {/* Style des tableaux */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
          Style des tableaux
        </Label>
        <div className="space-y-2">
          {TABLE_STYLES.map((style) => (
            <label
              key={style.value}
              className="flex items-start gap-3 p-2 rounded-md hover:bg-[var(--color-bg-surface-hover)] cursor-pointer"
            >
              <Checkbox
                checked={options.tableStyle === style.value}
                onCheckedChange={() => updateOption("tableStyle", style.value)}
                className="mt-0.5"
              />
              <div className="flex-1">
                <div className="text-sm font-medium">{style.label}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Options de masquage */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
          Masquer des elements
        </Label>
        <div className="space-y-1">
          {[
            { key: "companyName", label: "Nom de l'entreprise" },
            { key: "companyActivity", label: "Slogan / activite" },
            { key: "companyAddress", label: "Adresse" },
            { key: "companyPhone", label: "Telephone" },
            { key: "companyEmail", label: "Email" },
            { key: "companySiren", label: "SIRET / SIREN" },
            { key: "companyTva", label: "N de TVA" },
          ].map((item) => (
            <label
              key={item.key}
              className="flex items-center gap-3 py-1.5 px-2 rounded-md hover:bg-[var(--color-bg-surface-hover)] cursor-pointer"
            >
              <Checkbox
                checked={options.hide?.[item.key] || false}
                onCheckedChange={() => toggleHideOption(item.key)}
              />
              <span className="text-sm">Masquer {item.label.toLowerCase()}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Afficher sous-totaux */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
          Options supplementaires
        </Label>
        <label className="flex items-center gap-3 py-1.5 px-2 rounded-md hover:bg-[var(--color-bg-surface-hover)] cursor-pointer">
          <Checkbox
            checked={options.showSectionSubtotals || false}
            onCheckedChange={(checked) => updateOption("showSectionSubtotals", checked)}
          />
          <span className="text-sm">Sous-totaux dans les titres de sections</span>
        </label>
        <label className="flex items-center gap-3 py-1.5 px-2 rounded-md hover:bg-[var(--color-bg-surface-hover)] cursor-pointer">
          <Checkbox
            checked={options.showQrCode !== false}
            onCheckedChange={(checked) => updateOption("showQrCode", checked)}
          />
          <span className="text-sm">Afficher le QR code</span>
        </label>
      </div>
    </div>
  );
}
