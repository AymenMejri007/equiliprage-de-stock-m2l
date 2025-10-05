import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, RefreshCw, Download } from 'lucide-react';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';

interface TransferRecommendation {
  article_id: string;
  source_boutique_id: string;
  destination_boutique_id: string;
  quantity: number;
  status: string;
  generated_at: string;
  article_libelle: string;
  source_boutique_nom: string;
  destination_boutique_nom: string;
}

interface BoutiqueSummary {
  nom: string;
  totalTransferOut: number;
  totalTransferIn: number;
  overstockedArticles: number;
  understockedArticles: number;
}

interface ArticleToRebalance {
  libelle: string;
  code_article: string;
  familleNom: string;
  sousFamilleNom: string;
  overstockedBoutiques: { boutiqueId: string; nom: string; quantity: number }[];
  understockedBoutiques: { boutiqueId: string; nom: string; quantity: number }[];
  totalOverstock: number;
  totalUnderstock: number;
}

interface StockBalancingReport {
  message: string;
  recommandations: TransferRecommendation[];
  resumeParBoutique: BoutiqueSummary[];
  articlesAReequilibrer: ArticleToRebalance[];
}

const StockBalancing = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [report, setReport] = useState<StockBalancingReport | null>(null);

  const handleGenerateReport = async () => {
    setIsLoading(true);
    const loadingToastId = showLoading("Génération des rapports d'équilibrage de stock...");

    try {
      const SUPABASE_PROJECT_ID = "eliaikdjdpjybpxqikwp";
      const EDGE_FUNCTION_NAME = "equilibrage-stock";
      const edgeFunctionUrl = `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/${EDGE_FUNCTION_NAME}`;

      const response = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}), // Pas de corps spécifique nécessaire pour cette fonction
      });

      const result: StockBalancingReport = await response.json();

      if (response.ok) {
        showSuccess(result.message);
        setReport(result);
      } else {
        showError(result.message || "Une erreur est survenue lors de la génération des rapports.");
        console.error("Erreur de l'API:", result);
      }
    } catch (error: any) {
      showError(`Erreur réseau ou inattendue: ${error.message}`);
      console.error("Erreur de génération de rapport:", error);
    } finally {
      dismissToast(loadingToastId);
      setIsLoading(false);
    }
  };

  // Fonction pour télécharger les données en JSON (pour l'instant)
  const downloadReport = (data: any, filename: string) => {
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6 lg:p-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">Équilibrage des Stocks & Rapports</h1>
      <p className="text-lg text-gray-600 dark:text-gray-300 mb-8">
        Générez des recommandations de transferts de stock basées sur les ventes et les seuils MIN/MAX, et consultez des rapports détaillés.
      </p>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Générer les Rapports d'Équilibrage</CardTitle>
          <CardDescription>
            Cliquez sur le bouton ci-dessous pour lancer l'analyse et obtenir les recommandations de transferts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleGenerateReport} disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Générer les Rapports
          </Button>
        </CardContent>
      </Card>

      {report && (
        <div className="space-y-8">
          {/* Recommandations de Transfert */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Recommandations de Transfert</CardTitle>
                <CardDescription>Liste détaillée des transferts de stock proposés.</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => downloadReport(report.recommandations, 'recommandations_transfert.json')}>
                <Download className="mr-2 h-4 w-4" /> Télécharger JSON
              </Button>
            </CardHeader>
            <CardContent>
              {report.recommandations.length === 0 ? (
                <p className="text-gray-500 text-center">Aucune recommandation de transfert pour le moment.</p>
              ) : (
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date Génération</TableHead>
                        <TableHead>Article</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Destination</TableHead>
                        <TableHead className="text-right">Quantité</TableHead>
                        <TableHead>Statut</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.recommandations.map((rec, index) => (
                        <TableRow key={index}>
                          <TableCell>{format(new Date(rec.generated_at), 'dd/MM/yyyy HH:mm')}</TableCell>
                          <TableCell>{rec.article_libelle}</TableCell>
                          <TableCell>{rec.source_boutique_nom}</TableCell>
                          <TableCell>{rec.destination_boutique_nom}</TableCell>
                          <TableCell className="text-right">{rec.quantity}</TableCell>
                          <TableCell>{rec.status}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Separator />

          {/* Résumé par Boutique */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Résumé par Boutique</CardTitle>
                <CardDescription>Vue synthétique des transferts et des statuts de stock par boutique.</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => downloadReport(report.resumeParBoutique, 'resume_transferts.json')}>
                <Download className="mr-2 h-4 w-4" /> Télécharger JSON
              </Button>
            </CardHeader>
            <CardContent>
              {report.resumeParBoutique.length === 0 ? (
                <p className="text-gray-500 text-center">Aucun résumé de boutique disponible.</p>
              ) : (
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Boutique</TableHead>
                        <TableHead className="text-right">Transferts Sortants</TableHead>
                        <TableHead className="text-right">Transferts Entrants</TableHead>
                        <TableHead className="text-right">Articles en Surstock</TableHead>
                        <TableHead className="text-right">Articles en Rupture</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.resumeParBoutique.map((summary, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{summary.nom}</TableCell>
                          <TableCell className="text-right">{summary.totalTransferOut}</TableCell>
                          <TableCell className="text-right">{summary.totalTransferIn}</TableCell>
                          <TableCell className="text-right">{summary.overstockedArticles}</TableCell>
                          <TableCell className="text-right">{summary.understockedArticles}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Separator />

          {/* Articles à Rééquilibrer */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Articles à Rééquilibrer</CardTitle>
                <CardDescription>Liste des articles nécessitant un rééquilibrage avec les boutiques concernées.</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => downloadReport(report.articlesAReequilibrer, 'articles_a_reequilibrer.json')}>
                <Download className="mr-2 h-4 w-4" /> Télécharger JSON
              </Button>
            </CardHeader>
            <CardContent>
              {report.articlesAReequilibrer.length === 0 ? (
                <p className="text-gray-500 text-center">Aucun article à rééquilibrer pour le moment.</p>
              ) : (
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Article</TableHead>
                        <TableHead>Code</TableHead>
                        <TableHead>Famille</TableHead>
                        <TableHead>Sous-famille</TableHead>
                        <TableHead className="text-right">Total Surstock</TableHead>
                        <TableHead className="text-right">Total Rupture</TableHead>
                        <TableHead>Boutiques en Surstock</TableHead>
                        <TableHead>Boutiques en Rupture</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.articlesAReequilibrer.map((article, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{article.libelle}</TableCell>
                          <TableCell>{article.code_article}</TableCell>
                          <TableCell>{article.familleNom}</TableCell>
                          <TableCell>{article.sousFamilleNom}</TableCell>
                          <TableCell className="text-right">{article.totalOverstock}</TableCell>
                          <TableCell className="text-right">{article.totalUnderstock}</TableCell>
                          <TableCell>
                            {article.overstockedBoutiques.map(b => `${b.nom} (${b.quantity})`).join(', ')}
                          </TableCell>
                          <TableCell>
                            {article.understockedBoutiques.map(b => `${b.nom} (${b.quantity})`).join(', ')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default StockBalancing;