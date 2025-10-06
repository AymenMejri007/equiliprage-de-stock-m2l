import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

const TestDeDonnees = () => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6 lg:p-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">Page de Test de Données</h1>
      <p className="text-lg text-gray-600 dark:text-gray-300 mb-8">
        Cette page est un espace réservé pour les fonctionnalités de test et de gestion des données.
      </p>
      
      <Card>
        <CardHeader>
          <CardTitle>Fonctionnalités à venir</CardTitle>
          <CardDescription>
            Ici, vous pourrez ajouter des outils pour générer des données de test, nettoyer la base de données, etc.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-gray-700 dark:text-gray-300">
            Contenu pour la gestion des données de test sera implémenté ici.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default TestDeDonnees;