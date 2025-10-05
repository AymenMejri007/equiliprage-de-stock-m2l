import React from 'react';
import { MadeWithDyad } from "@/components/made-with-dyad";
import { ExcelImportForm } from '@/components/stock/ExcelImportForm';

const ImportStock = () => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6 lg:p-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-6 text-center">Importation des Stocks</h1>
      <ExcelImportForm />
      <MadeWithDyad />
    </div>
  );
};

export default ImportStock;