import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, RefreshCw, Download, Check, X } from 'lucide-react';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPendingTransferProposals, acceptTransferProposal, rejectTransferProposal, TransferProposal } from '@/api/transfers';
import { StockBalancingSummary } from '@/components/stock-balancing/StockBalancingSummary';

interface BoutiqueSummary {
  nom: string;
  totalTransferOut: number;
  totalTransferIn: number;
  overstockedArticles: number;
  understockedArticles: number;
}

interface ArticleToRebalance {
  libelle: string;
  familleNom: string;
  sousFamilleNom: string;
  overstockedBoutiques: { boutiqueId: string; nom: string; quantity: number }[];
  understockedBoutiques: { boutiqueId: string; nom: string; quantity: number }[];
  totalOverstock: number;
  totalUnderstock: number;
}

interface ArticleAnalysisItem {
  libelle: string;
  familleNom: string;
  sousFamilleNom: string;
  totalItems: number;
  overstock: number;
  rupture: number;
  normal: number;
  boutiques: {
    [boutiqueId: string]: {
      nom: string;
      stock_actuel: number;
      stock_min: number;
      stock_max: number;
      status: string;
    };
  };
}

interface StockBalancingReport {
  message: string;
  proposalsCount: number;
  proposals: TransferProposal[];
  resumeParBoutique: BoutiqueSummary[];
  articlesAReequilibrer: ArticleToRebalance[];
  analysis: {
    family: any;
    subFamily: any;
    article: {
      [articleId: string]: ArticleAnalysisItem;
    };
  };
}

const StockBalancing = () => {
  const queryClient = useQueryClient();
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [report, setReport] = useState<StockBalancingReport | null>(null);

  const { data: pendingProposals, isLoading: isLoadingPendingProposals, error: errorPendingProposals } = useQuery<TransferProposal[] | null>({
    queryKey: ['pendingTransferProposals'],
    queryFn: getPendingTransferProposals,
  });

  const acceptMutation = useMutation({
    mutationFn: ({ proposalId, articleId, sourceBoutiqueId, destinationBoutiqueId, quantity }: { proposalId: string; articleId: string; sourceBoutiqueId: string; destinationBoutiqueId: string; quantity: number }) =>
      acceptTransferProposal(proposalId, articleId, sourceBoutiqueId, destinationBoutiqueId, quantity),
    onSuccess: (data) => {
      if (data.success) {
        showSuccess(data.message || "Proposition acceptée avec succès.");
        queryClient.invalidateQueries({ queryKey: ['pendingTransferProposals'] });
        queryClient.invalidateQueries({ queryKey: ['stockOverview'] });
        queryClient.invalidateQueries({ queryKey: ['stockStatusTable'] });
        queryClient.invalidateQueries({ queryKey: ['transferHistory'] });
        queryClient.invalidateQueries({ queryKey: ['globalStockList'] });
        queryClient.invalidateQueries({ queryKey: ['stockDataByBoutique'] });
      } else {
        showError(data.message || "Échec de l'acceptation de la proposition.");
      }
    },
    onError: (error: any) => {
      showError(`Erreur lors de l'acceptation: ${error.message}`);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (proposalId: string) => rejectTransferProposal(proposalId),
    onSuccess: (data) => {
      if (data.success) {
        showSuccess(data.message || "Proposition rejetée avec succès.");
        queryClient.invalidateQueries({ queryKey: ['pendingTransferProposals'] });
      } else {
        showError(data.message || "Échec du rejet de la proposition.");
      }
    },
    onError: (error: any) => {
      showError(`Erreur lors du rejet: ${error.message}`);
    },
  });

  const handleGenerateReport = async () => {
    setIsLoadingReport(true);
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
        body: JSON.stringify({}),
      });

      const result: StockBalancingReport = await response.json();

      if (response.ok) {
        showSuccess(result.message);
        setReport(result);
        queryClient.invalidateQueries({ queryKey: ['pendingTransferProposals'] });
      } else {
        showError(result.message || "Une erreur est survenue lors de la génération des rapports.");
        console.error("Erreur de l'API:", result);
      }
    } catch (error: any) {
      showError(`Erreur réseau ou inattendue: ${error.message}`);
      console.error("Erreur de génération de rapport:", error);
    } finally {
      dismissToast(loadingToastId);
      setIsLoadingReport(false);
    }
  };

  const handleAccept = (proposal: TransferProposal) => {
    acceptMutation.mutate({
      proposalId: proposal.id,
      articleId: proposal.article_id,
      sourceBoutiqueId: proposal.source_boutique_id,
      destinationBoutiqueId: proposal.destination_boutique_id,
      quantity: proposal.quantity,
    });
  };

  const handleReject = (proposalId: string) => {
    rejectMutation.mutate(proposalId);
  };

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

  const hasPendingProposals = pendingProposals && pendingProposals.length > 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6 lg:p-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">Recommandations de transfert</h1>
      <p className="text-lg text-gray-600 dark:text-gray-300 mb-8">
        Optimisation automatique des stocks
      </p>

      <div className="flex justify-end mb-8">
        <Button onClick={handleGenerateReport} disabled={isLoadingReport} className="bg-green-600 hover:bg-green-700 text-white">
          {isLoadingReport ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Nouvelle analyse
        </Button>
      </div>

      {report && <StockBalancingSummary report={report} />}

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Propositions de Transfert en Attente</CardTitle>
          <CardDescription>Examinez et validez les transferts de stock proposés.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingPendingProposals ? (
            <div className="flex justify-center items-center p-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : errorPendingProposals ? (
            <p className="text-red-500 text-center">Erreur de chargement des propositions de transfert.</p>
          ) : !hasPendingProposals ? (
            <div className="text-center p-4">
              <p className="text-gray-500 dark:text-gray-400 mb-4">Aucune recommandation disponible</p>
              <p className="text-gray-600 dark:text-gray-300 mb-6">Générez une analyse pour obtenir des recommandations d'équilibrage</p>
              <Button onClick={handleGenerateReport} disabled={isLoadingReport} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                {isLoadingReport ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Analyser maintenant
              </Button>
            </div>
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
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingProposals.map((proposal) => (
                    <TableRow key={proposal.id}>
                      <TableCell>{format(new Date(proposal.generated_at), 'dd/MM/yyyy HH:mm')}</TableCell>
                      <TableCell>{proposal.articles?.libelle || 'N/A'}</TableCell>
                      <TableCell>{proposal.source_boutique?.nom || 'N/A'}</TableCell>
                      <TableCell>{proposal.destination_boutique?.nom || 'N/A'}</TableCell>
                      <TableCell className="text-right">{proposal.quantity}</TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleAccept(proposal)}
                          disabled={acceptMutation.isPending || rejectMutation.isPending}
                          className="text-green-600 hover:text-green-800"
                        >
                          <Check className="h-4 w-4" />
                          <span className="sr-only">Accepter</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleReject(proposal.id)}
                          disabled={acceptMutation.isPending || rejectMutation.isPending}
                          className="text-red-600 hover:text-red-800"
                        >
                          <X className="h-4 w-4" />
                          <span className="sr-only">Rejeter</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Separator className="my-8" />

      {report && (
        <div className="space-y-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Dernières Recommandations Générées</CardTitle>
                <CardDescription>Liste détaillée des transferts de stock proposés lors de la dernière génération.</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => downloadReport(report.proposals, 'recommandations_transfert.json')}>
                <Download className="mr-2 h-4 w-4" /> Télécharger JSON
              </Button>
            </CardHeader>
            <CardContent>
              {report.proposals.length === 0 ? (
                <p className="text-gray-500 text-center">Aucune recommandation de transfert générée lors de la dernière analyse.</p>
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
                      {report.proposals.map((rec, index) => (
                        <TableRow key={index}>
                          <TableCell>{format(new Date(rec.generated_at), 'dd/MM/yyyy HH:mm')}</TableCell>
                          <TableCell>{rec.articles?.libelle || 'N/A'}</TableCell>
                          <TableCell>{rec.source_boutique?.nom || 'N/A'}</TableCell>
                          <TableCell>{rec.destination_boutique?.nom || 'N/A'}</TableCell>
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