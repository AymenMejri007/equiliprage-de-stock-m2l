import { supabase } from "@/integrations/supabase/client";
import { StockItem } from "./stock"; // Réutiliser le type StockItem si nécessaire

export type TransferProposal = {
  id: string;
  article_id: string;
  source_boutique_id: string;
  destination_boutique_id: string;
  quantity: number;
  status: 'pending' | 'accepted' | 'rejected';
  generated_at: string;
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

export const getPendingTransferProposals = async (): Promise<TransferProposal[] | null> => {
  const { data, error } = await supabase
    .from('transfer_proposals')
    .select(`
      *,
      articles (id, libelle, code_article),
      source_boutique:boutiques!source_boutique_id (id, nom),
      destination_boutique:boutiques!destination_boutique_id (id, nom)
    `)
    .eq('status', 'pending')
    .order('generated_at', { ascending: false });

  if (error) {
    console.error("Erreur lors de la récupération des propositions de transfert en attente:", error);
    return null;
  }
  return data as TransferProposal[];
};

export const acceptTransferProposal = async (proposalId: string, articleId: string, sourceBoutiqueId: string, destinationBoutiqueId: string, quantity: number): Promise<{ success: boolean; message?: string }> => {
  try {
    // 1. Mettre à jour le statut de la proposition à 'accepted'
    const { error: updateProposalError } = await supabase
      .from('transfer_proposals')
      .update({ status: 'accepted' })
      .eq('id', proposalId);

    if (updateProposalError) throw updateProposalError;

    // 2. Mettre à jour le stock de la boutique source
    const { data: sourceStockData, error: fetchSourceStockError } = await supabase
      .from('stock')
      .select('stock_actuel')
      .eq('id_boutique', sourceBoutiqueId)
      .eq('id_article', articleId)
      .single();

    if (fetchSourceStockError) throw fetchSourceStockError;

    const newSourceStock = sourceStockData.stock_actuel - quantity;
    const { error: updateSourceStockError } = await supabase
      .from('stock')
      .update({ stock_actuel: newSourceStock })
      .eq('id_boutique', sourceBoutiqueId)
      .eq('id_article', articleId);

    if (updateSourceStockError) throw updateSourceStockError;

    // 3. Mettre à jour le stock de la boutique destination
    const { data: destinationStockData, error: fetchDestinationStockError } = await supabase
      .from('stock')
      .select('stock_actuel')
      .eq('id_boutique', destinationBoutiqueId)
      .eq('id_article', articleId)
      .single();

    if (fetchDestinationStockError) throw fetchDestinationStockError;

    const newDestinationStock = destinationStockData.stock_actuel + quantity;
    const { error: updateDestinationStockError } = await supabase
      .from('stock')
      .update({ stock_actuel: newDestinationStock })
      .eq('id_boutique', destinationBoutiqueId)
      .eq('id_article', articleId);

    if (updateDestinationStockError) throw updateDestinationStockError;

    // 4. Enregistrer le transfert dans la table 'transferts'
    const { error: insertTransferError } = await supabase
      .from('transferts')
      .insert({
        id_source: sourceBoutiqueId,
        id_destination: destinationBoutiqueId,
        id_article: articleId,
        quantite: quantity,
        statut: 'completed', // Marquer comme complété
      });

    if (insertTransferError) throw insertTransferError;

    return { success: true, message: "Proposition de transfert acceptée et stocks mis à jour." };
  } catch (error: any) {
    console.error("Erreur lors de l'acceptation de la proposition de transfert:", error);
    return { success: false, message: error.message || "Une erreur est survenue lors de l'acceptation du transfert." };
  }
};

export const rejectTransferProposal = async (proposalId: string): Promise<{ success: boolean; message?: string }> => {
  try {
    const { error } = await supabase
      .from('transfer_proposals')
      .update({ status: 'rejected' })
      .eq('id', proposalId);

    if (error) throw error;

    return { success: true, message: "Proposition de transfert rejetée." };
  } catch (error: any) {
    console.error("Erreur lors du rejet de la proposition de transfert:", error);
    return { success: false, message: error.message || "Une erreur est survenue lors du rejet du transfert." };
  }
};