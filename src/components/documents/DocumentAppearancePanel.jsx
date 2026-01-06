import { useState, useRef } from "react";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { ChevronDown, ChevronRight, Palette, Type, Table2, LayoutGrid, FileText, PenTool, ImageIcon, Upload, X } from "lucide-react";

const PRESET_COLORS = [
  { name: "Bleu marine", value: "#1a5490" },
  { name: "Bleu clair", value: "#0EA5E9" },
  { name: "Indigo", value: "#4F46E5" },
  { name: "Violet", value: "#7C3AED" },
  { name: "Vert", value: "#059669" },
  { name: "Vert clair", value: "#10B981" },
  { name: "Orange", value: "#EA580C" },
  { name: "Terre cuite", value: "#C2693F" },
  { name: "Rouge", value: "#DC2626" },
  { name: "Rose", value: "#DB2777" },
  { name: "Gris", value: "#475569" },
  { name: "Noir", value: "#1E293B" },
];

const TABLE_STYLES = [
  { value: "striped", label: "Lignes alternees" },
  { value: "bordered", label: "Bordures completes" },
  { value: "horizontal", label: "Lignes horizontales" },
  { value: "minimal", label: "Minimaliste" },
];

const FONTS = [
  { value: "Helvetica", label: "Helvetica" },
  { value: "Times", label: "Times New Roman" },
  { value: "Courier", label: "Courier" },
];

const CLIENT_POSITIONS = [
  { value: "right", label: "A droite" },
  { value: "left", label: "A gauche" },
];

const HEADER_STYLES = [
  { value: "classic", label: "Classique" },
  { value: "modern", label: "Moderne" },
  { value: "ultra", label: "Ultra moderne" },
  { value: "minimal", label: "Minimaliste" },
];

const LAYOUT_PRESETS = [
  { value: "premium-split", label: "Premium split (2 colonnes)", description: "Note au client pleine largeur, bas en 2 colonnes." },
  { value: "premium-grid", label: "Grille premium (2x2)", description: "Blocs en grille avec contraste equilibré." },
  { value: "centered-stack", label: "Colonne centree", description: "Blocs empiles et centres pour un rendu luxe." },
];

function Section({ title, icon: Icon, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-[var(--color-border-light)] pb-3">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full py-2 text-left hover:text-[var(--color-primary-600)]"
      >
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        {Icon && <Icon className="w-4 h-4" />}
        <span className="text-xs font-semibold uppercase tracking-wide">{title}</span>
      </button>
      {open && <div className="space-y-3 pt-2 pl-6">{children}</div>}
    </div>
  );
}

export default function DocumentAppearancePanel({ options, onChange }) {
  const fileInputRef = useRef(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const updateOption = (key, value) => {
    onChange({ ...options, [key]: value });
  };

  const toggleHideOption = (key) => {
    const currentHide = options.hide || {};
    updateOption("hide", { ...currentHide, [key]: !currentHide[key] });
  };

  const toggleColumnOption = (key) => {
    const currentColumns = options.columns || {};
    updateOption("columns", { ...currentColumns, [key]: !currentColumns[key] });
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      updateOption("logo", event.target.result);
    };
    reader.readAsDataURL(file);
  };

  const removeLogo = () => {
    updateOption("logo", null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-1 text-sm pb-16">
      {/* COULEURS */}
      <Section title="Couleurs" icon={Palette} defaultOpen={true}>
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-[var(--color-text-secondary)] mb-2 block">Couleur principale</Label>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => updateOption("primaryColor", color.value)}
                  className={`w-6 h-6 rounded-full border-2 transition-all ${
                    options.primaryColor === color.value
                      ? "border-[var(--color-text-primary)] scale-110 ring-2 ring-offset-1 ring-[var(--color-primary-300)]"
                      : "border-transparent hover:scale-105"
                  }`}
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                />
              ))}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Input
                type="color"
                value={options.primaryColor || "#1a5490"}
                onChange={(e) => updateOption("primaryColor", e.target.value)}
                className="w-8 h-8 p-0 border-0 cursor-pointer"
              />
              <Input
                type="text"
                value={options.primaryColor || "#1a5490"}
                onChange={(e) => updateOption("primaryColor", e.target.value)}
                className="h-7 text-xs font-mono flex-1"
                placeholder="#1a5490"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs text-[var(--color-text-secondary)] mb-2 block">Couleur secondaire (bordures)</Label>
            <div className="flex items-center gap-2">
              <Input
                type="color"
                value={options.secondaryColor || "#e2e8f0"}
                onChange={(e) => updateOption("secondaryColor", e.target.value)}
                className="w-8 h-8 p-0 border-0 cursor-pointer"
              />
              <Input
                type="text"
                value={options.secondaryColor || "#e2e8f0"}
                onChange={(e) => updateOption("secondaryColor", e.target.value)}
                className="h-7 text-xs font-mono flex-1"
              />
            </div>
          </div>
        </div>
      </Section>

      {/* LOGO */}
      <Section title="Logo" icon={ImageIcon}>
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-[var(--color-text-secondary)] mb-2 block">Image du logo</Label>
            {options.logo ? (
              <div className="relative inline-block">
                <img
                  src={options.logo}
                  alt="Logo"
                  className="max-w-[120px] max-h-[60px] object-contain border border-[var(--color-border)] rounded p-1"
                />
                <button
                  type="button"
                  onClick={removeLogo}
                  className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-dashed border-[var(--color-border)] rounded-lg cursor-pointer hover:border-[var(--color-primary-400)] hover:bg-[var(--color-bg-surface-hover)] transition-colors">
                <Upload className="w-6 h-6 text-[var(--color-text-tertiary)] mb-1" />
                <span className="text-xs text-[var(--color-text-tertiary)]">Cliquer pour ajouter</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {options.logo && (
            <>
              <div>
                <Label className="text-xs text-[var(--color-text-secondary)] mb-1.5 block">
                  Taille logo: {options.logoSize || 50}px
                </Label>
                <Slider
                  value={[options.logoSize || 50]}
                  onValueChange={([v]) => updateOption("logoSize", v)}
                  min={30}
                  max={100}
                  step={5}
                  className="w-full"
                />
              </div>

              <div>
                <Label className="text-xs text-[var(--color-text-secondary)] mb-1.5 block">Position</Label>
                <Select value={options.logoPosition || "left"} onValueChange={(v) => updateOption("logoPosition", v)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="left">A gauche du nom</SelectItem>
                    <SelectItem value="above">Au-dessus du nom</SelectItem>
                    <SelectItem value="replace">Remplacer le nom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>
      </Section>

      {/* TYPOGRAPHIE */}
      <Section title="Typographie" icon={Type}>
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-[var(--color-text-secondary)] mb-1.5 block">Police</Label>
            <Select value={options.font || "Helvetica"} onValueChange={(v) => updateOption("font", v)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FONTS.map((font) => (
                  <SelectItem key={font.value} value={font.value}>{font.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs text-[var(--color-text-secondary)] mb-1.5 block">
              Taille de base: {options.baseFontSize || 9}pt
            </Label>
            <Slider
              value={[options.baseFontSize || 9]}
              onValueChange={([v]) => updateOption("baseFontSize", v)}
              min={7}
              max={12}
              step={0.5}
              className="w-full"
            />
          </div>

          <div>
            <Label className="text-xs text-[var(--color-text-secondary)] mb-1.5 block">
              Interligne: {options.lineHeight || 1.2}
            </Label>
            <Slider
              value={[options.lineHeight || 1.2]}
              onValueChange={([v]) => updateOption("lineHeight", v)}
              min={1}
              max={1.8}
              step={0.1}
              className="w-full"
            />
          </div>
        </div>
      </Section>

      {/* EN-TETE */}
      <Section title="En-tete" icon={LayoutGrid}>
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-[var(--color-text-secondary)] mb-1.5 block">Style</Label>
            <Select value={options.headerStyle || "classic"} onValueChange={(v) => updateOption("headerStyle", v)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HEADER_STYLES.map((style) => (
                  <SelectItem key={style.value} value={style.value}>{style.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs text-[var(--color-text-secondary)] mb-1.5 block">Position client</Label>
            <Select value={options.clientPosition || "right"} onValueChange={(v) => updateOption("clientPosition", v)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CLIENT_POSITIONS.map((pos) => (
                  <SelectItem key={pos.value} value={pos.value}>{pos.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-[var(--color-text-secondary)]">Afficher</Label>
            {[
              { key: "companyName", label: "Nom entreprise", default: true },
              { key: "companyActivity", label: "Slogan / activite", default: true },
              { key: "companyAddress", label: "Adresse", default: true },
              { key: "companyPhone", label: "Telephone", default: true },
              { key: "companyEmail", label: "Email", default: true },
              { key: "companySiren", label: "SIREN", default: true },
            ].map((item) => (
              <label key={item.key} className="flex items-center gap-2 py-1 cursor-pointer hover:bg-[var(--color-bg-surface-hover)] px-1 rounded">
                <Checkbox
                  checked={!(options.hide?.[item.key])}
                  onCheckedChange={() => toggleHideOption(item.key)}
                />
                <span className="text-xs">{item.label}</span>
              </label>
            ))}
          </div>
        </div>
      </Section>

      {/* TABLEAU */}
      <Section title="Tableau des lignes" icon={Table2}>
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-[var(--color-text-secondary)] mb-1.5 block">Style</Label>
            <Select value={options.tableStyle || "striped"} onValueChange={(v) => updateOption("tableStyle", v)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TABLE_STYLES.map((style) => (
                  <SelectItem key={style.value} value={style.value}>{style.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs text-[var(--color-text-secondary)] mb-1.5 block">
              Epaisseur bordures: {options.borderWidth || 0.5}pt
            </Label>
            <Slider
              value={[options.borderWidth || 0.5]}
              onValueChange={([v]) => updateOption("borderWidth", v)}
              min={0.25}
              max={1.5}
              step={0.25}
              className="w-full"
            />
          </div>

          <div>
            <Label className="text-xs text-[var(--color-text-secondary)] mb-1.5 block">
              Arrondi bordures: {options.borderRadius || 0}pt
            </Label>
            <Slider
              value={[options.borderRadius || 0]}
              onValueChange={([v]) => updateOption("borderRadius", v)}
              min={0}
              max={8}
              step={1}
              className="w-full"
            />
          </div>

          <div>
            <Label className="text-xs text-[var(--color-text-secondary)] mb-1.5 block">
              Padding cellules: {options.cellPadding || 4}px
            </Label>
            <Slider
              value={[options.cellPadding || 4]}
              onValueChange={([v]) => updateOption("cellPadding", v)}
              min={2}
              max={8}
              step={1}
              className="w-full"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-[var(--color-text-secondary)]">Colonnes visibles</Label>
            {[
              { key: "showNumero", label: "N de ligne", default: true },
              { key: "showQuantite", label: "Quantite", default: true },
              { key: "showUnite", label: "Unite", default: true },
              { key: "showPrixUnitaire", label: "Prix unitaire", default: true },
              { key: "showTva", label: "Taux TVA", default: false },
            ].map((item) => (
              <label key={item.key} className="flex items-center gap-2 py-1 cursor-pointer hover:bg-[var(--color-bg-surface-hover)] px-1 rounded">
                <Checkbox
                  checked={options.columns?.[item.key] !== false}
                  onCheckedChange={() => toggleColumnOption(item.key)}
                />
                <span className="text-xs">{item.label}</span>
              </label>
            ))}
          </div>

          <label className="flex items-center gap-2 py-1 cursor-pointer">
            <Checkbox
              checked={options.showSectionSubtotals !== false}
              onCheckedChange={(checked) => updateOption("showSectionSubtotals", checked)}
            />
            <span className="text-xs">Sous-totaux par section</span>
          </label>
        </div>
      </Section>

      {/* PIED DE PAGE ET SIGNATURE */}
      <Section title="Bas de page" icon={FileText}>
        <div className="space-y-3">
          <label className="flex items-center gap-2 py-1 cursor-pointer">
            <Checkbox
              checked={options.showSignatureBox !== false}
              onCheckedChange={(checked) => updateOption("showSignatureBox", checked)}
            />
            <span className="text-xs">Encadre signature (devis)</span>
          </label>

          <label className="flex items-center gap-2 py-1 cursor-pointer">
            <Checkbox
              checked={options.showPaymentMethods !== false}
              onCheckedChange={(checked) => updateOption("showPaymentMethods", checked)}
            />
            <span className="text-xs">Modes de paiement</span>
          </label>

          <label className="flex items-center gap-2 py-1 cursor-pointer">
            <Checkbox
              checked={options.showConditions !== false}
              onCheckedChange={(checked) => updateOption("showConditions", checked)}
            />
            <span className="text-xs">Conditions de paiement</span>
          </label>

          <label className="flex items-center gap-2 py-1 cursor-pointer">
            <Checkbox
              checked={options.showFooter !== false}
              onCheckedChange={(checked) => updateOption("showFooter", checked)}
            />
            <span className="text-xs">Pied de page (infos legales)</span>
          </label>

          <label className="flex items-center gap-2 py-1 cursor-pointer">
            <Checkbox
              checked={options.showPageNumbers !== false}
              onCheckedChange={(checked) => updateOption("showPageNumbers", checked)}
            />
            <span className="text-xs">Numeros de page</span>
          </label>
        </div>
      </Section>

      {/* MARGES ET ESPACEMENT */}
      <Section title="Marges" icon={PenTool}>
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-[var(--color-text-secondary)] mb-1.5 block">
              Marges page: {options.pageMargin || 40}pt
            </Label>
            <Slider
              value={[options.pageMargin || 40]}
              onValueChange={([v]) => updateOption("pageMargin", v)}
              min={20}
              max={60}
              step={5}
              className="w-full"
            />
          </div>

          <div>
            <Label className="text-xs text-[var(--color-text-secondary)] mb-1.5 block">
              Espace entre sections: {options.sectionSpacing || 15}pt
            </Label>
            <Slider
              value={[options.sectionSpacing || 15]}
              onValueChange={([v]) => updateOption("sectionSpacing", v)}
              min={8}
              max={30}
              step={2}
              className="w-full"
            />
          </div>
        </div>
      </Section>

      {/* OPTIONS AVANCEES */}
      <Section title="Options avancees" icon={FileText}>
        <div className="space-y-3">
          <label className="flex items-center gap-2 py-1 cursor-pointer">
            <Checkbox
              checked={options.showDraftWatermark || false}
              onCheckedChange={(checked) => updateOption("showDraftWatermark", checked)}
            />
            <span className="text-xs">Filigrane "BROUILLON"</span>
          </label>

          <label className="flex items-center gap-2 py-1 cursor-pointer">
            <Checkbox
              checked={options.showDocumentBorder || false}
              onCheckedChange={(checked) => updateOption("showDocumentBorder", checked)}
            />
            <span className="text-xs">Bordure autour du document</span>
          </label>

          <label className="flex items-center gap-2 py-1 cursor-pointer">
            <Checkbox
              checked={options.compactMode || false}
              onCheckedChange={(checked) => updateOption("compactMode", checked)}
            />
            <span className="text-xs">Mode compact</span>
          </label>
        </div>
      </Section>
    </div>
  );
}
