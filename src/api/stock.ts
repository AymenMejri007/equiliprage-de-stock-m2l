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
    familles: {
      id: string;
      nom: string;
    } | null;
  } | null;
  boutiques: {
    id: string;
    nom: string;
  } | null;
};

export type StockStatus = 'surstock' | 'rupture' | 'normal';

export const getStockData = async (): Promise<StockItem[] | null> => {
  const { data, error } = await supabase
    .from('stock')
    .select(`
      *,
      articles (id, libelle, code_article, famille_id, familles (id, nom)),
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