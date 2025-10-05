import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getStockData, getStockStatus, StockStatus } from '@/api/stock';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'; // Import des Tooltip

export const StockStatusTable: React.FC = () => {
  const { data: stockData, isLoading, error } = useQuery({
    queryKey: ['stockStatusTable'],
    queryFn: getStockData,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return <div className="text-red-500 text-center p-4">Erreur de chargement des données de stock.</div>;
  }

  if (!stockData || stockData.length === 0) {
    return <div className="text-gray-500 text-center p-4">Aucune donnée de stock disponible.</div>;
  }

  // Agrégation des données pour le tableau
  const aggregatedData: {
    [familleNom: string]: {
      [boutiqueNom: string]: {
        totalItems: number;
        overstock: number;
        outOfStock: number;
        normal: number;
      };
    };
  } = {};

  const boutiquesSet = new Set<string>();
  const famillesSet = new Set<string>();

  stockData.forEach(item => {
    const familleNom = item.articles?.familles?.nom || 'Non classé';
    const boutiqueNom = item.boutiques?.nom || 'Boutique inconnue';

    famillesSet.add(familleNom);
    boutiquesSet.add(boutiqueNom);

    if (!aggregatedData[familleNom]) {
      aggregatedData[familleNom] = {};
    }
    if (!aggregatedData[familleNom][boutiqueNom]) {
      aggregatedData[familleNom][boutiqueNom] = {
        totalItems: 0,
        overstock: 0,
        outOfStock: 0,
        normal: 0,
      };
    }

    const status = getStockStatus(item.stock_actuel, item.stock_min, item.stock_max);
    aggregatedData[familleNom][boutiqueNom].totalItems++;
    if (status === 'surstock') {
      aggregatedData[familleNom][boutiqueNom].overstock++;
    } else if (status === 'rupture') {
      aggregatedData[familleNom][boutiqueNom].outOfStock++;
    } else {
      aggregatedData[familleNom][boutiqueNom].normal++;
    }
  });

  const sortedFamilles = Array.from(famillesSet).sort();
  const sortedBoutiques = Array.from(boutiquesSet).sort();

  const getCellColor = (familleNom: string, boutiqueNom: string) => {
    const data = aggregatedData[familleNom]?.[boutiqueNom];
    if (!data || data.totalItems === 0) return 'bg-gray-100 dark:bg-gray-800 text-gray-500'; // Pas de données
    
    const overstockRatio = data.overstock / data.totalItems;
    const outOfStockRatio = data.outOfStock / data.totalItems;

    if (outOfStockRatio > 0.3) { // Plus de 30% en rupture (rouge foncé)
      return 'bg-red-600 text-white';
    } else if (outOfStockRatio > 0.1) { // Plus de 10% en rupture (rouge clair)
      return 'bg-red-400 text-white';
    } else if (overstockRatio > 0.3) { // Plus de 30% en surstock (vert foncé)
      return 'bg-green-600 text-white';
    } else if (overstockRatio > 0.1) { // Plus de 10% en surstock (vert clair)
      return 'bg-green-400 text-white';
    } else if (data.outOfStock > 0 || data.overstock > 0) { // Quelques ruptures ou surstocks (jaune)
      return 'bg-yellow-300 dark:bg-yellow-600 text-gray-900 dark:text-white';
    }
    return 'bg-blue-100 dark:bg-blue-800 text-blue-900 dark:text-blue-100'; // Normal (bleu clair)
  };

  const getCellTooltipContent = (familleNom: string, boutiqueNom: string) => {
    const data = aggregatedData[familleNom]?.[boutiqueNom];
    if (!data || data.totalItems === 0) return "Aucune donnée de stock pour cette combinaison.";
    return (
      <div>
        <p>Total articles: {data.totalItems}</p>
        <p>Stock normal: {data.normal}</p>
        <p>Surstock: {data.overstock}</p>
        <p>Rupture: {data.outOfStock}</p>
      </div>
    );
  };

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 bg-background z-20 min-w-[150px]">Famille / Boutique</TableHead>
            {sortedBoutiques.map(boutiqueNom => (
              <TableHead key={boutiqueNom} className="text-center min-w-[120px]">{boutiqueNom}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedFamilles.map(familleNom => (
            <TableRow key={familleNom}>
              <TableCell className="font-medium sticky left-0 bg-background z-20">{familleNom}</TableCell>
              {sortedBoutiques.map(boutiqueNom => (
                <TooltipProvider key={`${familleNom}-${boutiqueNom}`}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <TableCell
                        className={cn("text-center p-2 cursor-help", getCellColor(familleNom, boutiqueNom))}
                      >
                        {aggregatedData[familleNom]?.[boutiqueNom]?.totalItems > 0 ? (
                          <span className="text-xs font-semibold">
                            R: {aggregatedData[familleNom][boutiqueNom].outOfStock} / S: {aggregatedData[familleNom][boutiqueNom].overstock}
                          </span>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                    </TooltipTrigger>
                    <TooltipContent>
                      {getCellTooltipContent(familleNom, boutiqueNom)}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};