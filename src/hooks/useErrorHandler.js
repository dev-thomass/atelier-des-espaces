import { useCallback } from 'react';
import { useToast } from '@/components/ui/use-toast';

const ERROR_MESSAGES = {
  // Erreurs réseau
  'Failed to fetch': 'Impossible de contacter le serveur. Vérifiez votre connexion.',
  'NetworkError': 'Erreur réseau. Vérifiez votre connexion internet.',
  'TIMEOUT': 'La requête a expiré. Réessayez.',

  // Erreurs serveur
  'db_not_configured': 'Base de données non configurée.',
  'validation_error': 'Données invalides.',
  'client_id_required': 'Un client est requis.',
  'document_error': 'Erreur lors de l\'opération sur le document.',
  'export_error': 'Erreur lors de l\'export.',

  // Erreurs d'authentification
  'invalid_token': 'Session expirée. Veuillez vous reconnecter.',
  'unauthorized': 'Accès non autorisé.',

  // Erreurs par défaut
  'default': 'Une erreur est survenue. Veuillez réessayer.',
};

export const getErrorMessage = (error) => {
  if (!error) return ERROR_MESSAGES.default;

  // Si c'est une chaîne
  if (typeof error === 'string') {
    return ERROR_MESSAGES[error] || error;
  }

  // Si c'est un objet Error
  if (error instanceof Error) {
    // Vérifier les erreurs réseau connues
    if (error.message.includes('Failed to fetch')) {
      return ERROR_MESSAGES['Failed to fetch'];
    }
    return ERROR_MESSAGES[error.message] || error.message;
  }

  // Si c'est un objet avec une propriété message ou error
  if (typeof error === 'object') {
    const msg = error.message || error.error;
    if (msg) {
      return ERROR_MESSAGES[msg] || msg;
    }
  }

  return ERROR_MESSAGES.default;
};

export const useErrorHandler = () => {
  const { toast } = useToast();

  const handleError = useCallback((error, title = 'Erreur') => {
    const message = getErrorMessage(error);

    toast({
      variant: 'destructive',
      title,
      description: message,
    });

    // Log pour le debug
    console.error(`[${title}]`, error);
  }, [toast]);

  const handleApiError = useCallback(async (response, fallbackMessage) => {
    try {
      const data = await response.json();
      const message = data.message || data.error || fallbackMessage;
      return getErrorMessage(message);
    } catch {
      return fallbackMessage || ERROR_MESSAGES.default;
    }
  }, []);

  const withErrorHandling = useCallback((fn, errorTitle = 'Erreur') => {
    return async (...args) => {
      try {
        return await fn(...args);
      } catch (error) {
        handleError(error, errorTitle);
        throw error;
      }
    };
  }, [handleError]);

  return {
    handleError,
    handleApiError,
    withErrorHandling,
    getErrorMessage,
  };
};

export default useErrorHandler;
