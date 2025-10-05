import React from 'react';
import { MadeWithDyad } from "@/components/made-with-dyad";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"; // Import de CardDescription
import { Separator } from "@/components/ui/separator";
import { StockOverview } from "@/components/dashboard/StockOverview";
import { StockStatusTable } from "@/components/dashboard/StockStatusTable";

const Dashboard = () => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6 lg:p-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">Tableau de Bord des Stocks</h1>
      <p className="text-lg text-gray-600 dark:text-gray-300 mb-8">
        Visualisez l'état actuel de vos stocks et identifiez rapidement les déséquilibres.
      </p>
      
      <div className="grid gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Vue d'ensemble des stocks</CardTitle>
            <CardDescription>Répartition des articles en surstock, rupture et stock normal.</CardDescription>
          </CardHeader>
          <CardContent>
            <StockOverview />
          </CardContent>
        </Card>
      </div>

      <Separator className="my-8" />

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Statut des stocks par Famille et Boutique</CardTitle>
            <CardDescription>Une vue "heatmap" des statuts de stock agrégés par famille et par boutique.</CardDescription>
          </CardHeader>
          <CardContent>
            <StockStatusTable />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;