import { supabase } from "@/integrations/supabase/client";
import { StockItem } from "./stock"; // Réutiliser le type StockItem

export type TransfertItem = {
  id: string;
  id_source: string;
  id_destination: string;
  id_article: string;
  quantite: number;
  statut: string;
  created_at: string;
  articles: {
    id: string;
    libelle: string;
    code_article: string;
  } | null;
  source_boutique: {
    id: string;
    nom: string;
  } | null;
  destination_boutique: {
    id: string;
    nom: string;
  } | null;
};

export type Boutique = {
  id: string;
  nom: string;
};

export const getTransferHistory = async (): Promise<TransfertItem[] | null> => {
  const { data, error } = await supabase
    .from('transferts')
    .select(`
      *,
      articles (id, libelle, code_article),
      source_boutique:boutiques!id_source (id, nom),
      destination_boutique:boutiques!id_destination (id, nom)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error("Erreur lors de la récupération de l'historique des transferts:", error);
    return null;
  }
  return data as TransfertItem[];
};

export const getBoutiques = async (): Promise<Boutique[] | null> => {
  const { data, error } = await supabase
    .from('boutiques')
    .select('id, nom')
    .order('nom', { ascending: true });

  if (error) {
    console.error("Erreur lors de la récupération des boutiques:", error);
    return null;
  }
  return data as Boutique[];
};