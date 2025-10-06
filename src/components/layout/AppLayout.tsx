import React from 'react';
import { Outlet } from 'react-router-dom';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { Header } from './Header'; // Import du nouveau Header

export const AppLayout: React.FC = () => {
  return (
    <div className="flex min-h-screen w-full flex-col">
      <Header /> {/* Utilisation du nouveau composant Header */}
      <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
        <Outlet />
      </main>
      <footer className="p-4 border-t bg-gray-100/40 dark:bg-gray-800/40">
        <MadeWithDyad />
      </footer>
    </div>
  );
};