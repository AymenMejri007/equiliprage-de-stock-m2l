import React from 'react';
import { MadeWithDyad } from "@/components/made-with-dyad";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { TransferHistory } from "@/components/reports/TransferHistory";
import { BoutiquePerformance } from "@/components/reports/BoutiquePerformance";

const Reports = () => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6 lg:p-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-6">Rapports & Historique</h1>
      
      <div className="grid gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Performance des Stocks par Boutique</CardTitle>
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
          </CardHeader>
          <CardContent>
            <TransferHistory />
          </CardContent>
        </Card>
      </div>

      <MadeWithDyad />
    </div>
  );
};

export default Reports;