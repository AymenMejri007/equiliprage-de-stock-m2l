import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getStockData, getStockStatus, StockStatus } from '@/api/stock';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

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
    if (!data || data.totalItems === 0) return 'bg-gray-200 dark:bg-gray-700'; // Pas de données
    
    const overstockRatio = data.overstock / data.totalItems;
    const outOfStockRatio = data.outOfStock / data.totalItems;

    if (outOfStockRatio > 0.2) { // Plus de 20% en rupture
      return 'bg-red-500 text-white';
    } else if (overstockRatio > 0.2) { // Plus de 20% en surstock
      return 'bg-green-500 text-white';
    } else if (outOfStockRatio > 0 || overstockRatio > 0) { // Quelques ruptures ou surstocks
      return 'bg-yellow-300 dark:bg-yellow-600';
    }
    return 'bg-gray-300 dark:bg-gray-600'; // Normal
  };

  const getCellTooltip = (familleNom: string, boutiqueNom: string) => {
    const data = aggregatedData[familleNom]?.[boutiqueNom];
    if (!data || data.totalItems === 0) return "Aucune donnée";
    return `Total: ${data.totalItems}\nNormal: ${data.normal}\nSurstock: ${data.overstock}\nRupture: ${data.outOfStock}`;
  };

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 bg-background z-10">Famille / Boutique</TableHead>
            {sortedBoutiques.map(boutiqueNom => (
              <TableHead key={boutiqueNom} className="text-center">{boutiqueNom}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedFamilles.map(familleNom => (
            <TableRow key={familleNom}>
              <TableCell className="font-medium sticky left-0 bg-background z-10">{familleNom}</TableCell>
              {sortedBoutiques.map(boutiqueNom => (
                <TableCell
                  key={`${familleNom}-${boutiqueNom}`}
                  className={cn("text-center p-2", getCellColor(familleNom, boutiqueNom))}
                  title={getCellTooltip(familleNom, boutiqueNom)}
                >
                  {/* Vous pouvez afficher un résumé ou laisser vide pour un effet "heatmap" pur */}
                  {aggregatedData[familleNom]?.[boutiqueNom]?.totalItems > 0 ? (
                    <span className="text-xs">
                      R: {aggregatedData[familleNom][boutiqueNom].outOfStock} / S: {aggregatedData[familleNom][boutiqueNom].overstock}
                    </span>
                  ) : (
                    '-'
                  )}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};