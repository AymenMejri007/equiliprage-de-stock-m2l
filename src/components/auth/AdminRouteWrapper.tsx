"use client";

import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useSession } from '@/components/auth/SessionContextProvider';
import { Loader2 } from 'lucide-react';

const AdminRouteWrapper: React.FC = () => {
  const { userRole, isLoading } = useSession();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (userRole !== 'admin') {
    // Rediriger vers le tableau de bord ou une page d'accès refusé
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
};

export default AdminRouteWrapper;