import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, LayoutDashboard, FileText, Store, List, Upload, GitCompareArrows, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useSession } from '@/components/auth/SessionContextProvider';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';

interface NavLinkItem {
  to: string;
  icon: React.ElementType;
  label: string;
  adminOnly?: boolean;
}

const navLinks: NavLinkItem[] = [
  { to: "/", icon: Home, label: "Accueil" },
  { to: "/dashboard", icon: LayoutDashboard, label: "Tableau de Bord" },
  { to: "/reports", icon: FileText, label: "Rapports" },
  { to: "/boutique-detail", icon: Store, label: "Détail Boutique" },
  { to: "/global-stock", icon: List, label: "Stock Global" },
  { to: "/import-stock", icon: Upload, label: "Importer Stock", adminOnly: true },
  { to: "/stock-balancing", icon: GitCompareArrows, label: "Équilibrage Stock", adminOnly: true },
];

export const SidebarContent: React.FC = () => {
  const { session, userRole } = useSession();
  const isAdmin = userRole === 'admin';

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      showError("Erreur lors de la déconnexion: " + error.message);
    } else {
      showSuccess("Vous avez été déconnecté.");
    }
  };

  return (
    <nav className="flex flex-col gap-2 p-4">
      {navLinks.map((link) => (
        (!link.adminOnly || isAdmin) && (
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
        )
      ))}
      {session && (
        <Button
          variant="ghost"
          onClick={handleLogout}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-red-600 transition-all hover:text-red-800 dark:text-red-400 dark:hover:text-red-200 justify-start"
        >
          <LogOut className="h-4 w-4" />
          Déconnexion
        </Button>
      )}
    </nav>
  );
};

// Le composant Sidebar lui-même est maintenant vide car son contenu est exporté et son déclencheur est dans Header.
export const Sidebar: React.FC = () => {
  return null; // Ne rend rien pour le bureau, la logique mobile est gérée dans Header
};