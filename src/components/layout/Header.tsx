"use client";

import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { FileUp, Database, GitCompareArrows, Menu } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { SidebarContent } from '@/components/navigation/Sidebar'; // Réutiliser le contenu de la sidebar pour le mobile

const navTabs = [
  { to: "/dashboard", label: "Tableau de bord" },
  { to: "/global-stock", label: "Stocks détaillés" },
  { to: "/boutique-detail", label: "Boutiques" },
  { to: "/stock-balancing", label: "Équilibrage" },
];

export const Header: React.FC = () => {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background px-4 sm:px-6 lg:px-8">
      {/* Mobile Menu Trigger */}
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" className="shrink-0 md:hidden">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle navigation menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="flex flex-col">
          <h2 className="text-lg font-semibold p-4 text-gray-900 dark:text-gray-100">Navigation</h2>
          <SidebarContent /> {/* Utilise le contenu existant de la sidebar pour le mobile */}
        </SheetContent>
      </Sheet>

      {/* Desktop Header Content */}
      <div className="flex-1 flex items-center justify-between">
        <div className="flex flex-col">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Gestion des stocks</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">Équilibrage automatique entre boutiques</p>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <Button asChild variant="outline" size="sm">
            <Link to="/import-stock">
              <FileUp className="mr-2 h-4 w-4" /> Importateur Excel
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/test-de-donnees">
              <Database className="mr-2 h-4 w-4" /> Test de données
            </Link>
          </Button>
          <Button asChild variant="default" size="sm" className="bg-green-600 hover:bg-green-700 text-white">
            <Link to="/stock-balancing">
              <GitCompareArrows className="mr-2 h-4 w-4" /> Équilibrage de l'analyseur
            </Link>
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <nav className="hidden md:flex items-center gap-4 border-t pt-4 absolute bottom-0 left-0 right-0 bg-background px-4 sm:px-6 lg:px-8">
        {navTabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              cn(
                "px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-50",
                isActive ? "border-b-2 border-primary text-primary dark:text-primary" : ""
              )
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
};