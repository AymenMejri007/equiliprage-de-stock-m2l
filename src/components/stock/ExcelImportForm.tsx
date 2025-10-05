import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Upload } from 'lucide-react';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';

export const ExcelImportForm: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
    } else {
      setSelectedFile(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      showError("Veuillez sélectionner un fichier Excel à importer.");
      return;
    }

    setIsLoading(true);
    const loadingToastId = showLoading("Importation en cours...");

    const formData = new FormData();
    formData.append('excelFile', selectedFile);

    try {
      // Remplacez par l'ID de votre projet Supabase
      const SUPABASE_PROJECT_ID = "eliaikdjdpjybpxqikwp"; 
      const EDGE_FUNCTION_NAME = "import-stock-excel";
      const edgeFunctionUrl = `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/${EDGE_FUNCTION_NAME}`;

      const response = await fetch(edgeFunctionUrl, {
        method: 'POST',
        body: formData,
        // Le navigateur définit automatiquement l'en-tête 'Content-Type' pour FormData
      });

      const result = await response.json();

      if (response.ok) {
        showSuccess(result.message);
        if (result.errors && result.errors.length > 0) {
          showError(`Certaines lignes ont échoué à l'importation. Voir la console pour les détails.`);
          console.error("Erreurs d'importation:", result.errors);
        }
      } else {
        showError(result.error || "Une erreur est survenue lors de l'importation.");
        console.error("Erreur de l'API:", result);
      }
    } catch (error: any) {
      showError(`Erreur réseau ou inattendue: ${error.message}`);
      console.error("Erreur d'importation:", error);
    } finally {
      dismissToast(loadingToastId);
      setIsLoading(false);
      setSelectedFile(null); // Effacer le fichier sélectionné après la tentative d'upload
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Importer les Stocks via Excel</CardTitle>
        <CardDescription>
          Téléchargez un fichier Excel pour mettre à jour ou ajouter des données de stock.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          <p className="text-sm text-muted-foreground">
            Le fichier Excel doit contenir les colonnes suivantes (respectez la casse) :<br />
            <code>Dépôt</code>, <code>MARQUE</code>, <code>CATEGORIE PRINCIPALE</code>, <code>SOUS-CATEGORIE</code> (optionnel), <code>Libellé article</code>, <code>Coloris</code> (optionnel), <strong><code>Code-barres article</code> (obligatoire)</strong>, <code>Physique</code>, <code>Ventes FO</code>, <code>Stock maximum</code>, <code>Stock minimum</code>. La colonne <code>Ventes FO</code> est utilisée pour calculer les ventes mensuelles moyennes sur les 6 derniers mois.
          </p>
          <div className="flex items-center space-x-2">
            <Input
              id="excelFile"
              type="file"
              accept=".xlsx, .xls"
              onChange={handleFileChange}
              className="flex-1"
            />
            <Button onClick={handleUpload} disabled={!selectedFile || isLoading}>
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Importer
            </Button>
          </div>
          {selectedFile && (
            <p className="text-sm text-muted-foreground">Fichier sélectionné : {selectedFile.name}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};