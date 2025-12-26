import React, { useState } from "react";
import DocumentsList from "./DocumentsList";
import DocumentForm from "./DocumentForm";

export default function DocumentsContent() {
  const [view, setView] = useState("list"); // "list" | "create" | "edit" | "view"
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [createType, setCreateType] = useState("devis");

  const handleCreateDocument = (type) => {
    setCreateType(type);
    setSelectedDocument(null);
    setView("create");
  };

  const handleEditDocument = (document) => {
    setSelectedDocument(document);
    setCreateType(document.type);
    setView("edit");
  };

  const handleViewDocument = (document) => {
    // Pour l'instant, on édite/visualise le même formulaire
    // Plus tard, on pourra créer une vue dédiée avec prévisualisation PDF
    setSelectedDocument(document);
    setCreateType(document.type);
    setView("view");
  };

  const handleClose = () => {
    setView("list");
    setSelectedDocument(null);
  };

  const handleSuccess = () => {
    setView("list");
    setSelectedDocument(null);
  };

  if (view === "create" || view === "edit") {
    return (
      <DocumentForm
        type={createType}
        document={view === "edit" ? selectedDocument : null}
        onClose={handleClose}
        onSuccess={handleSuccess}
      />
    );
  }

  if (view === "view" && selectedDocument) {
    return (
      <DocumentForm
        type={selectedDocument.type}
        document={selectedDocument}
        onClose={handleClose}
        onSuccess={handleSuccess}
      />
    );
  }

  return (
    <DocumentsList
      onCreateDocument={handleCreateDocument}
      onEditDocument={handleEditDocument}
      onViewDocument={handleViewDocument}
    />
  );
}
