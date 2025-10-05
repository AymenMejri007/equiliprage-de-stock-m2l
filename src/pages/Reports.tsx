import React from 'react';
import { MadeWithDyad } from "@/components/made-with-dyad";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"; // Import de CardDescription
import { Separator } from "@/components/ui/separator";
import { TransferHistory } from "@/components/reports/TransferHistory";
import { BoutiquePerformance } from "@/components/reports/BoutiquePerformance";

const Reports = () => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6 lg:p-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">Rapports & Historique</h1>
      <p className="text-lg text-gray-600 dark:text-gray-300 mb-8">
        Consultez les performances détaillées de vos boutiques et l'historique complet des transferts.
      </p>
      
      <div className="grid gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Performance des Stocks par Boutique</CardTitle>
            <CardDescription>Analyse des déséquilibres de stock pour une boutique sélectionnée.</CardDescription>
          </CardHeader>
          <CardContent>
            <BoutiquePerformance />
          </CardContent>
        </Card>
      </div>

      <Separator className="my-8" />

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Historique des Transferts Effectués</CardTitle>
            <CardDescription>Liste chronologique de tous les transferts d'articles entre boutiques.</CardDescription>
          </CardHeader>
          <CardContent>
            <TransferHistory />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Reports;