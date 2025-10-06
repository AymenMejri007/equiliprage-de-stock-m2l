"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

interface UserProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  role: 'admin' | 'user';
}

interface SessionContextType {
  session: Session | null;
  user: (User & { profile?: UserProfile }) | null;
  isLoading: boolean;
  userRole: 'admin' | 'user' | null;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<(User & { profile?: UserProfile }) | null>(null);
  const [userRole, setUserRole] = useState<'admin' | 'user' | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    console.log("SessionContextProvider: useEffect déclenché.");

    const fetchUserProfile = async (userId: string) => {
      console.log("SessionContextProvider: Récupération du profil utilisateur pour userId:", userId);
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, avatar_url, role')
        .eq('id', userId)
        .single();

      if (error) {
        console.error("SessionContextProvider: Erreur lors de la récupération du profil utilisateur:", error);
        return null;
      }
      console.log("SessionContextProvider: Profil utilisateur récupéré:", data);
      return data as UserProfile;
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      console.log("SessionContextProvider: onAuthStateChange event:", event, "session:", currentSession);
      setSession(currentSession);
      if (currentSession?.user) {
        const profile = await fetchUserProfile(currentSession.user.id);
        setUser({ ...currentSession.user, profile });
        setUserRole(profile?.role || 'user');
      } else {
        setUser(null);
        setUserRole(null);
      }
      setIsLoading(false); // Important: set to false when auth state is determined

      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        if (location.pathname === '/login' || location.pathname === '/') {
          navigate('/dashboard');
        }
      } else if (event === 'SIGNED_OUT') {
        if (location.pathname !== '/login') {
          navigate('/login');
        }
      }
    });

    supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
      console.log("SessionContextProvider: Résultat initial de getSession:", initialSession);
      setSession(initialSession);
      if (initialSession?.user) {
        const profile = await fetchUserProfile(initialSession.user.id);
        setUser({ ...initialSession.user, profile });
        setUserRole(profile?.role || 'user');
      } else {
        setUser(null);
        setUserRole(null);
      }
      setIsLoading(false); // Important: set to false when initial session is determined

      if (!initialSession && location.pathname !== '/login') {
        navigate('/login');
      } else if (initialSession && (location.pathname === '/login' || location.pathname === '/')) {
        navigate('/dashboard');
      }
    });

    return () => {
      console.log("SessionContextProvider: Nettoyage de l'abonnement onAuthStateChange.");
      subscription.unsubscribe();
    };
  }, [navigate, location.pathname]);

  console.log("SessionContextProvider: Rendu - isLoading:", isLoading, "session:", session, "user:", user, "userRole:", userRole);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <SessionContext.Provider value={{ session, user, isLoading, userRole }}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionContextProvider');
  }
  return context;
};