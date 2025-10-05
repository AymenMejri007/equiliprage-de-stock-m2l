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
  role: 'admin' | 'user'; // Ajout du rôle
}

interface SessionContextType {
  session: Session | null;
  user: (User & { profile?: UserProfile }) | null; // Enrichir l'objet User avec le profil
  isLoading: boolean;
  userRole: 'admin' | 'user' | null; // Rôle de l'utilisateur
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
    const fetchUserProfile = async (userId: string) => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, avatar_url, role')
        .eq('id', userId)
        .single();

      if (error) {
        console.error("Error fetching user profile:", error);
        return null;
      }
      return data as UserProfile;
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      setSession(currentSession);
      if (currentSession?.user) {
        const profile = await fetchUserProfile(currentSession.user.id);
        setUser({ ...currentSession.user, profile });
        setUserRole(profile?.role || 'user'); // Définir le rôle par défaut si non trouvé
      } else {
        setUser(null);
        setUserRole(null);
      }
      setIsLoading(false);

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
      setSession(initialSession);
      if (initialSession?.user) {
        const profile = await fetchUserProfile(initialSession.user.id);
        setUser({ ...initialSession.user, profile });
        setUserRole(profile?.role || 'user');
      } else {
        setUser(null);
        setUserRole(null);
      }
      setIsLoading(false);

      if (!initialSession && location.pathname !== '/login') {
        navigate('/login');
      } else if (initialSession && (location.pathname === '/login' || location.pathname === '/')) {
        navigate('/dashboard');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, location.pathname]);

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