import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '@/components/navigation/Sidebar';
import { MadeWithDyad } from '@/components/made-with-dyad';

export const AppLayout: React.FC = () => {
  return (
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      <Sidebar />
      <div className="flex flex-col">
        <header className="flex h-14 items-center gap-4 border-b bg-gray-100/40 px-4 lg:h-[60px] lg:px-6 dark:bg-gray-800/40 md:hidden">
          {/* Mobile sidebar trigger will be rendered by Sidebar component itself */}
          <Sidebar /> 
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Stock App</h1>
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
          <Outlet />
        </main>
        {/* MadeWithDyad moved to the footer of the main content area for better placement */}
        <footer className="p-4 border-t bg-gray-100/40 dark:bg-gray-800/40">
          <MadeWithDyad />
        </footer>
      </div>
    </div>
  );
};