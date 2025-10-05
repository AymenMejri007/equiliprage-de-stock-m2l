import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, LayoutDashboard, FileText, Store, List, Upload, Menu } from 'lucide-react'; // Ajout de l'icône Menu
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';

interface NavLinkItem {
  to: string;
  icon: React.ElementType;
  label: string;
}

const navLinks: NavLinkItem[] = [
  { to: "/", icon: Home, label: "Accueil" },
  { to: "/dashboard", icon: LayoutDashboard, label: "Tableau de Bord" },
  { to: "/reports", icon: FileText, label: "Rapports" },
  { to: "/boutique-detail", icon: Store, label: "Détail Boutique" },
  { to: "/global-stock", icon: List, label: "Stock Global" },
  { to: "/import-stock", icon: Upload, label: "Importer Stock" },
];

const SidebarContent: React.FC = () => (
  <nav className="flex flex-col gap-2 p-4">
    {navLinks.map((link) => (
      <NavLink
        key={link.to}
        to={link.to}
        className={({ isActive }) =>
          cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-gray-700 transition-all hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-50",
            isActive ? "bg-primary text-primary-foreground hover:text-primary-foreground dark:bg-primary dark:text-primary-foreground dark:hover:text-primary-foreground" : ""
          )
        }
      >
        <link.icon className="h-4 w-4" />
        {link.label}
      </NavLink>
    ))}
  </nav>
);

export const Sidebar: React.FC = () => {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" className="shrink-0 md:hidden">
            <Menu className="h-5 w-5" /> {/* Utilisation de l'icône Menu pour le toggle */}
            <span className="sr-only">Toggle navigation menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="flex flex-col">
          <h2 className="text-lg font-semibold p-4 text-gray-900 dark:text-gray-100">Navigation</h2>
          <SidebarContent />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <div className="hidden border-r bg-gray-100/40 md:block dark:bg-gray-800/40">
      <div className="flex h-full max-h-screen flex-col gap-2">
        <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
          <NavLink to="/" className="flex items-center gap-2 font-semibold text-gray-900 dark:text-gray-100">
            <Home className="h-6 w-6" />
            <span className="">Stock App</span>
          </NavLink>
        </div>
        <div className="flex-1">
          <SidebarContent />
        </div>
      </div>
    </div>
  );
};