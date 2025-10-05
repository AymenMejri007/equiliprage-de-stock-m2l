import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getStockData } from '@/api/stock';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2 } from 'lucide-react';
import { MadeWithDyad } from "@/components/made-with-dyad";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const GlobalStockList = () => {
  const { data: stockData, isLoading, error } = useQuery({
    queryKey: ['globalStockList'],
    queryFn: getStockData,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return <div className="min-h-screen text-red-500 text-center p-4 bg-gray-50 dark:bg-gray-900">Erreur de chargement des données de stock.</div>;
  }

  if (!stockData || stockData.length === 0) {
    return <div className="min-h-screen text-gray-500 text-center p-4 bg-gray-50 dark:bg-gray-900">Aucune donnée de stock disponible.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6 lg:p-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">Vue d'ensemble des Stocks</h1>
      <p className="text-lg text-gray-600 dark:text-gray-300 mb-8">
        Consultez la liste complète de tous les articles en stock, répartis par boutique.
      </p>
      
      <Card>
        <CardHeader>
          <CardTitle>Tous les Articles en Stock</CardTitle>
          <CardDescription>Un aperçu global de l'inventaire de toutes les boutiques.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[150px]">Boutique</TableHead>
                  <TableHead className="min-w-[120px]">Code article</TableHead>
                  <TableHead className="min-w-[200px]">Libellé</TableHead>
                  <TableHead className="min-w-[150px]">Catégorie</TableHead>
                  <TableHead className="min-w-[150px]">Sous-catégorie</TableHead>
                  <TableHead className="text-right min-w-[100px]">Stock actuel</TableHead>
                  <TableHead className="text-right min-w-[100px]">Stock min</TableHead>
                  <TableHead className="text-right min-w-[100px]">Stock max</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stockData.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.boutiques?.nom || 'N/A'}</TableCell>
                    <TableCell>{item.articles?.code_article || 'N/A'}</TableCell>
                    <TableCell className="font-medium">{item.articles?.libelle || 'N/A'}</TableCell>
                    <TableCell>{item.articles?.familles?.nom || 'N/A'}</TableCell>
                    <TableCell>{item.articles?.sous_familles?.nom || 'N/A'}</TableCell>
                    <TableCell className="text-right">{item.stock_actuel}</TableCell>
                    <TableCell className="text-right">{item.stock_min}</TableCell>
                    <TableCell className="text-right">{item.stock_max}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GlobalStockList;