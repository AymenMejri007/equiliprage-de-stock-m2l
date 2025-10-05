import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, FileText, Store, Upload } from 'lucide-react';

const Index = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-4 md:p-8">
      <div className="max-w-3xl mx-auto mb-12">
        <h1 className="text-5xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100 sm:text-6xl mb-4">
          Bienvenue dans votre Gestionnaire de Stock Intelligent
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-300 leading-relaxed mb-8">
          Optimisez la gestion de vos stocks, suivez les performances de vos boutiques et anticipez les besoins avec des analyses précises.
        </p>
        <div className="flex justify-center gap-4">
          <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground">
            <Link to="/dashboard">
              <LayoutDashboard className="mr-2 h-5 w-5" /> Voir le Tableau de Bord
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link to="/import-stock">
              <Upload className="mr-2 h-5 w-5" /> Importer des Stocks
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full max-w-5xl">
        <Card className="hover:shadow-lg transition-shadow duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg font-semibold">Tableau de Bord</CardTitle>
            <LayoutDashboard className="h-6 w-6 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <CardDescription>Visualisez l'état global de vos stocks en un coup d'œil.</CardDescription>
            <Button asChild variant="link" className="mt-2 p-0 h-auto">
              <Link to="/dashboard">Accéder</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg font-semibold">Rapports</CardTitle>
            <FileText className="h-6 w-6 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <CardDescription>Consultez l'historique des transferts et la performance des boutiques.</CardDescription>
            <Button asChild variant="link" className="mt-2 p-0 h-auto">
              <Link to="/reports">Accéder</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg font-semibold">Détail Boutique</CardTitle>
            <Store className="h-6 w-6 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <CardDescription>Explorez les stocks article par article pour chaque boutique.</CardDescription>
            <Button asChild variant="link" className="mt-2 p-0 h-auto">
              <Link to="/boutique-detail">Accéder</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg font-semibold">Importer Stock</CardTitle>
            <Upload className="h-6 w-6 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <CardDescription>Mettez à jour vos données de stock facilement via un fichier Excel.</CardDescription>
            <Button asChild variant="link" className="mt-2 p-0 h-auto">
              <Link to="/import-stock">Accéder</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Index;