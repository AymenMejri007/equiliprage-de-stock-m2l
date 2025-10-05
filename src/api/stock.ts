import { supabase } from "@/integrations/supabase/client";

export type StockItem = {
  id: string;
  id_boutique: string;
  id_article: string;
  stock_actuel: number;
  stock_min: number;
  stock_max: number;
  created_at: string;
  articles: {
    id: string;
    libelle: string;
    code_article: string;
    famille_id: string;
    sous_famille_id: string | null; // Ajout de sous_famille_id
    familles: {
      id: string;
      nom: string;
    } | null;
    sous_familles: { // Ajout de sous_familles
      id: string;
      nom: string;
      famille_id: string;
    } | null;
  } | null;
  boutiques: {
    id: string;
    nom: string;
  } | null;
};

export type StockStatus = 'surstock' | 'rupture' | 'normal';

export type Famille = {
  id: string;
  nom: string;
};

export type SousFamille = {
  id: string;
  nom: string;
  famille_id: string;
};

export const getStockData = async (): Promise<StockItem[] | null> => {
  const { data, error } = await supabase
    .from('stock')
    .select(`
      *,
      articles (id, libelle, code_article, famille_id, sous_famille_id, familles (id, nom), sous_familles (id, nom, famille_id)),
      boutiques (id, nom)
    `);

  if (error) {
    console.error("Erreur lors de la récupération des données de stock:", error);
    return null;
  }
  return data as StockItem[];
};

export const getStockStatus = (stock_actuel: number, stock_min: number, stock_max: number): StockStatus => {
  if (stock_actuel > stock_max) {
    return 'surstock';
  } else if (stock_actuel < stock_min) {
    return 'rupture';
  } else {
    return 'normal';
  }
};

export const getFamilles = async (): Promise<Famille[] | null> => {
  const { data, error } = await supabase
    .from('familles')
    .select('id, nom')
    .order('nom', { ascending: true });

  if (error) {
    console.error("Erreur lors de la récupération des familles:", error);
    return null;
  }
  return data as Famille[];
};

export const getSousFamilles = async (): Promise<SousFamille[] | null> => {
  const { data, error } = await supabase
    .from('sous_familles')
    .select('id, nom, famille_id')
    .order('nom', { ascending: true });

  if (error) {
    console.error("Erreur lors de la récupération des sous-familles:", error);
    return null;
  }
  return data as SousFamille[];
};