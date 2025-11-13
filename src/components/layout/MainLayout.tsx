// Main Layout component
import React from 'react';
import { Navigation } from '@/components/layout/Navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { Outlet } from 'react-router-dom';

export const MainLayout: React.FC = () => {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="container mx-auto p-3 sm:p-4 md:p-6 max-w-full overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
};


