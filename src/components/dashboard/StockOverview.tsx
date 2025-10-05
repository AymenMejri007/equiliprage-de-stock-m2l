import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getStockData, getStockStatus } from '@/api/stock';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

export const StockOverview: React.FC = () => {
  const { data: stockData, isLoading, error } = useQuery({
    queryKey: ['stockOverview'],
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

  let overstockCount = 0;
  let outOfStockCount = 0;
  let normalStockCount = 0;
  const totalStockItems = stockData.length;

  stockData.forEach(item => {
    const status = getStockStatus(item.stock_actuel, item.stock_min, item.stock_max);
    if (status === 'surstock') {
      overstockCount++;
    } else if (status === 'rupture') {
      outOfStockCount++;
    } else {
      normalStockCount++;
    }
  });

  const overstockPercentage = totalStockItems > 0 ? ((overstockCount / totalStockItems) * 100).toFixed(2) : '0.00';
  const outOfStockPercentage = totalStockItems > 0 ? ((outOfStockCount / totalStockItems) * 100).toFixed(2) : '0.00';
  const normalStockPercentage = totalStockItems > 0 ? ((normalStockCount / totalStockItems) * 100).toFixed(2) : '0.00';

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card className="bg-green-100 dark:bg-green-900">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-green-700 dark:text-green-200">
            % en Surstock
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-800 dark:text-green-100">{overstockPercentage}%</div>
          <p className="text-xs text-green-600 dark:text-green-300">
            {overstockCount} articles
          </p>
        </CardContent>
      </Card>
      <Card className="bg-red-100 dark:bg-red-900">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-red-700 dark:text-red-200">
            % en Rupture
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-800 dark:text-red-100">{outOfStockPercentage}%</div>
          <p className="text-xs text-red-600 dark:text-red-300">
            {outOfStockCount} articles
          </p>
        </CardContent>
      </Card>
      <Card className="bg-gray-100 dark:bg-gray-800">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-gray-700 dark:text-gray-200">
            % Normal
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-gray-800 dark:text-gray-100">{normalStockPercentage}%</div>
          <p className="text-xs text-gray-600 dark:text-gray-300">
            {normalStockCount} articles
          </p>
        </CardContent>
      </Card>
    </div>
  );
};