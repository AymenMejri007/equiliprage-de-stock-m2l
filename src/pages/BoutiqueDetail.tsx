import React, { useState } from 'react';
import { MadeWithDyad } from "@/components/made-with-dyad";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { getBoutiques } from '@/api/reports';
import { Loader2 } from 'lucide-react';
import { ArticleStockTable } from '@/components/boutique-detail/ArticleStockTable';

const BoutiqueDetail = () => {
  const [selectedBoutiqueId, setSelectedBoutiqueId] = useState<string | undefined>(undefined);

  const { data: boutiques, isLoading: isLoadingBoutiques, error: errorBoutiques } = useQuery({
    queryKey: ['boutiques'],
    queryFn: getBoutiques,
  });

  if (isLoadingBoutiques) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (errorBoutiques) {
    return <div className="min-h-screen text-red-500 text-center p-4 bg-gray-50 dark:bg-gray-900">Erreur de chargement des boutiques.</div>;
  }

  const handleBoutiqueChange = (value: string) => {
    setSelectedBoutiqueId(value);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6 lg:p-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">Détail des Stocks par Boutique</h1>
      <p className="text-lg text-gray-600 dark:text-gray-300 mb-8">
        Sélectionnez une boutique pour visualiser et filtrer le stock de ses articles.
      </p>
      
      <div className="mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Sélectionner une Boutique</CardTitle>
            <CardDescription>Choisissez une boutique dans la liste déroulante pour afficher son inventaire.</CardDescription>
          </CardHeader>
          <CardContent>
            <Select onValueChange={handleBoutiqueChange} value={selectedBoutiqueId}>
              <SelectTrigger className="w-full md:w-[300px]">
                <SelectValue placeholder="Sélectionner une boutique" />
              </SelectTrigger>
              <SelectContent>
                {boutiques?.map((boutique) => (
                  <SelectItem key={boutique.id} value={boutique.id}>
                    {boutique.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>

      {selectedBoutiqueId ? (
        <ArticleStockTable boutiqueId={selectedBoutiqueId} />
      ) : (
        <Card className="p-8 text-center text-gray-500 dark:text-gray-400">
          <CardContent>
            <p>Veuillez sélectionner une boutique pour voir le détail de ses articles.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default BoutiqueDetail;