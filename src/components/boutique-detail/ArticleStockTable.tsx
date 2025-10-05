import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getStockDataByBoutique, getFamilles, getSousFamilles, StockItem, getStockStatus, StockStatus } from '@/api/stock';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { StockStatusBadge } from '@/components/dashboard/StockStatusBadge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface ArticleStockTableProps {
  boutiqueId: string;
}

export const ArticleStockTable: React.FC<ArticleStockTableProps> = ({ boutiqueId }) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedFamille, setSelectedFamille] = useState<string>('all');
  const [selectedSousFamille, setSelectedSousFamille] = useState<string>('all');
  const [selectedStockStatus, setSelectedStockStatus] = useState<string>('all');

  const { data: stockData, isLoading: isLoadingStock, error: errorStock } = useQuery<StockItem[] | null>({
    queryKey: ['stockDataByBoutique', boutiqueId],
    queryFn: () => getStockDataByBoutique(boutiqueId),
    enabled: !!boutiqueId,
  });

  const { data: familles, isLoading: isLoadingFamilles, error: errorFamilles } = useQuery({
    queryKey: ['familles'],
    queryFn: getFamilles,
  });

  const { data: sousFamilles, isLoading: isLoadingSousFamilles, error: errorSousFamilles } = useQuery({
    queryKey: ['sousFamilles'],
    queryFn: getSousFamilles,
  });

  const filteredStockData = useMemo(() => {
    if (!stockData) return [];

    return stockData.filter(item => {
      const articleLibelle = item.articles?.libelle?.toLowerCase() || '';
      // const articleCode = item.articles?.code_article?.toLowerCase() || ''; // Removed
      const matchesSearch = articleLibelle.includes(searchTerm.toLowerCase()); // Only search by libelle

      const itemFamilleId = item.articles?.famille_id;
      const matchesFamille = selectedFamille === 'all' || itemFamilleId === selectedFamille;

      const itemSousFamilleId = item.articles?.sous_famille_id;
      const matchesSousFamille = selectedSousFamille === 'all' || itemSousFamilleId === selectedSousFamille;

      const status = getStockStatus(item.stock_actuel, item.stock_min, item.stock_max);
      const matchesStockStatus = selectedStockStatus === 'all' || status === selectedStockStatus;

      return matchesSearch && matchesFamille && matchesSousFamille && matchesStockStatus;
    });
  }, [stockData, searchTerm, selectedFamille, selectedSousFamille, selectedStockStatus]);

  if (isLoadingStock || isLoadingFamilles || isLoadingSousFamilles) {
    return (
      <Card className="p-4">
        <div className="flex justify-center items-center p-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Card>
    );
  }

  if (errorStock || errorFamilles || errorSousFamilles) {
    return <Card className="p-4"><div className="text-red-500 text-center p-4">Erreur de chargement des données.</div></Card>;
  }

  const availableSousFamilles = selectedFamille === 'all'
    ? sousFamilles || []
    : (sousFamilles || []).filter(sf => sf.famille_id === selectedFamille);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Articles en Stock</CardTitle>
        <CardDescription>Liste détaillée des articles et de leur statut de stock pour la boutique sélectionnée.</CardDescription>
      </CardHeader>
      <CardContent className="p-4">
        <div className="flex flex-wrap gap-4 mb-4 items-center">
          <Input
            placeholder="Rechercher article..." // Updated placeholder
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-xs md:max-w-sm"
          />
          <Select onValueChange={setSelectedFamille} value={selectedFamille}>
            <SelectTrigger className="w-full md:w-[180px]">
              <SelectValue placeholder="Filtrer par famille" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les familles</SelectItem>
              {familles?.map(famille => (
                <SelectItem key={famille.id} value={famille.id}>{famille.nom}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select onValueChange={setSelectedSousFamille} value={selectedSousFamille} disabled={!selectedFamille || selectedFamille === 'all'}>
            <SelectTrigger className="w-full md:w-[180px]">
              <SelectValue placeholder="Filtrer par sous-famille" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les sous-familles</SelectItem>
              {availableSousFamilles.map(sf => (
                <SelectItem key={sf.id} value={sf.id}>{sf.nom}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select onValueChange={setSelectedStockStatus} value={selectedStockStatus}>
            <SelectTrigger className="w-full md:w-[180px]">
              <SelectValue placeholder="Filtrer par statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="surstock">Surstock</SelectItem>
              <SelectItem value="rupture">Rupture</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {filteredStockData.length === 0 ? (
          <div className="text-gray-500 text-center p-4">Aucun article trouvé avec les filtres appliqués.</div>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">Article</TableHead>
                  {/* <TableHead className="min-w-[120px]">Code</TableHead> Removed */}
                  <TableHead className="min-w-[150px]">Famille</TableHead>
                  <TableHead className="min-w-[150px]">Sous-famille</TableHead>
                  <TableHead className="text-right min-w-[100px]">Stock Actuel</TableHead>
                  <TableHead className="text-right min-w-[100px]">Stock Min</TableHead>
                  <TableHead className="text-right min-w-[100px]">Stock Max</TableHead>
                  <TableHead className="min-w-[120px]">Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStockData.map(item => {
                  const status = getStockStatus(item.stock_actuel, item.stock_min, item.stock_max);
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.articles?.libelle || 'N/A'}</TableCell>
                      {/* <TableCell>{item.articles?.code_article || 'N/A'}</TableCell> Removed */}
                      <TableCell>{item.articles?.familles?.nom || 'N/A'}</TableCell>
                      <TableCell>{item.articles?.sous_familles?.nom || 'N/A'}</TableCell>
                      <TableCell className="text-right">{item.stock_actuel}</TableCell>
                      <TableCell className="text-right">{item.stock_min}</TableCell>
                      <TableCell className="text-right">{item.stock_max}</TableCell>
                      <TableCell>
                        <StockStatusBadge status={status} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};