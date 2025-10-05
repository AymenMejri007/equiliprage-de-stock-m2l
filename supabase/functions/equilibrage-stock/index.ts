import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to determine stock status
const getStockStatus = (stock_actuel: number, stock_min: number, stock_max: number): 'surstock' | 'rupture' | 'normal' => {
  if (stock_actuel > stock_max) {
    return 'surstock';
  } else if (stock_actuel < stock_min) {
    return 'rupture';
  } else {
    return 'normal';
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Fetch all necessary data
    const { data: stockItems, error: stockError } = await supabaseClient
      .from('stock')
      .select(`
        id, id_boutique, id_article, stock_actuel, stock_min, stock_max,
        articles (id, libelle, code_article, famille_id, sous_famille_id, familles (id, nom), sous_familles (id, nom, famille_id)),
        boutiques (id, nom)
      `);
    if (stockError) throw stockError;

    const { data: salesData, error: salesError } = await supabaseClient
      .from('ventes')
      .select('id_article, id_boutique, quantite_vendue, date_mois');
    if (salesError) throw salesError;

    const { data: boutiquesData, error: boutiquesError } = await supabaseClient
      .from('boutiques')
      .select('id, nom');
    if (boutiquesError) throw boutiquesError;
    const boutiquesMap = new Map(boutiquesData.map(b => [b.id, b.nom]));

    // 2. Calculate average monthly sales per article per boutique
    const articleBoutiqueSales: { [articleId: string]: { [boutiqueId: string]: number[] } } = {};
    salesData.forEach(sale => {
      if (!articleBoutiqueSales[sale.id_article]) articleBoutiqueSales[sale.id_article] = {};
      if (!articleBoutiqueSales[sale.id_article][sale.id_boutique]) articleBoutiqueSales[sale.id_article][sale.id_boutique] = [];
      articleBoutiqueSales[sale.id_article][sale.id_boutique].push(sale.quantite_vendue);
    });

    const averageMonthlySales: { [articleId: string]: { [boutiqueId: string]: number } } = {};
    for (const articleId in articleBoutiqueSales) {
      averageMonthlySales[articleId] = {};
      for (const boutiqueId in articleBoutiqueSales[articleId]) {
        const totalSales = articleBoutiqueSales[articleId][boutiqueId].reduce((sum, qty) => sum + qty, 0);
        // Assuming sales data is for 6 months, adjust if your sales data period varies
        averageMonthlySales[articleId][boutiqueId] = totalSales / 6;
      }
    }

    // 3. Identify overstocked and understocked items
    const overstockedItems: any[] = [];
    const understockedItems: any[] = [];
    const articlesToRebalance: { [articleId: string]: { libelle: string, code_article: string, familleNom: string, sousFamilleNom: string, overstockedBoutiques: any[], understockedBoutiques: any[], totalOverstock: number, totalUnderstock: number } } = {};
    const boutiqueSummary: { [boutiqueId: string]: { nom: string, totalTransferOut: number, totalTransferIn: number, overstockedArticles: number, understockedArticles: number } } = {};

    stockItems.forEach(item => {
      const status = getStockStatus(item.stock_actuel, item.stock_min, item.stock_max);
      const boutiqueId = item.id_boutique;
      const articleId = item.id_article;
      const articleLibelle = item.articles?.libelle || 'N/A';
      const articleCode = item.articles?.code_article || 'N/A';
      const familleNom = item.articles?.familles?.nom || 'N/A';
      const sousFamilleNom = item.articles?.sous_familles?.nom || 'N/A';

      if (!boutiqueSummary[boutiqueId]) {
        boutiqueSummary[boutiqueId] = { nom: boutiquesMap.get(boutiqueId) || 'Inconnue', totalTransferOut: 0, totalTransferIn: 0, overstockedArticles: 0, understockedArticles: 0 };
      }

      if (!articlesToRebalance[articleId]) {
        articlesToRebalance[articleId] = {
          libelle: articleLibelle,
          code_article: articleCode,
          familleNom: familleNom,
          sousFamilleNom: sousFamilleNom,
          overstockedBoutiques: [],
          understockedBoutiques: [],
          totalOverstock: 0,
          totalUnderstock: 0,
        };
      }

      if (status === 'surstock') {
        overstockedItems.push(item);
        const overstockQty = item.stock_actuel - item.stock_max;
        articlesToRebalance[articleId].overstockedBoutiques.push({ boutiqueId, nom: boutiquesMap.get(boutiqueId), quantity: overstockQty });
        articlesToRebalance[articleId].totalOverstock += overstockQty;
        boutiqueSummary[boutiqueId].overstockedArticles++;
      } else if (status === 'rupture') {
        understockedItems.push(item);
        const understockQty = item.stock_min - item.stock_actuel; // Quantity needed to reach min
        articlesToRebalance[articleId].understockedBoutiques.push({ boutiqueId, nom: boutiquesMap.get(boutiqueId), quantity: understockQty });
        articlesToRebalance[articleId].totalUnderstock += understockQty;
        boutiqueSummary[boutiqueId].understockedArticles++;
      }
    });

    // 4. Generate transfer proposals with prioritization logic
    const transferProposals: any[] = [];
    const processedOverstockItemsKey = new Set<string>(); // To avoid duplicate processing of an overstock item

    for (const overstockItem of overstockedItems) {
      const articleId = overstockItem.id_article;
      const sourceBoutiqueId = overstockItem.id_boutique;
      let quantityAvailableFromSource = overstockItem.stock_actuel - overstockItem.stock_max;

      if (quantityAvailableFromSource <= 0 || processedOverstockItemsKey.has(`${articleId}-${sourceBoutiqueId}`)) continue;

      // Find potential destinations for this article that are understocked
      const potentialDestinations = understockedItems.filter(
        destItem => destItem.id_article === articleId && destItem.id_boutique !== sourceBoutiqueId
      );

      // Sort destinations by average sales (higher sales = higher priority to receive stock)
      potentialDestinations.sort((a, b) => {
        const salesA = averageMonthlySales[articleId]?.[a.id_boutique] || 0;
        const salesB = averageMonthlySales[articleId]?.[b.id_boutique] || 0;
        return salesB - salesA; // Descending order
      });

      for (const destItem of potentialDestinations) {
        if (quantityAvailableFromSource <= 0) break; // No more stock to transfer from source

        const destBoutiqueId = destItem.id_boutique;
        let quantityNeededAtDest = destItem.stock_min - destItem.stock_actuel; // Quantity to reach min stock

        if (quantityNeededAtDest <= 0) continue; // Destination doesn't need stock

        const quantityToTransfer = Math.min(quantityAvailableFromSource, quantityNeededAtDest);

        if (quantityToTransfer > 0) {
          transferProposals.push({
            article_id: articleId,
            source_boutique_id: sourceBoutiqueId,
            destination_boutique_id: destBoutiqueId,
            quantity: quantityToTransfer,
            status: 'pending',
            generated_at: new Date().toISOString(),
            article_libelle: overstockItem.articles?.libelle,
            source_boutique_nom: boutiquesMap.get(sourceBoutiqueId),
            destination_boutique_nom: boutiquesMap.get(destBoutiqueId),
          });

          quantityAvailableFromSource -= quantityToTransfer;
          // Update destination's needed quantity (conceptually, not in DB yet)
          // This is important if one source can fulfill part of multiple destinations' needs
          destItem.stock_actuel += quantityToTransfer; // Simulate stock increase for next iteration
          
          // Update boutique summary
          boutiqueSummary[sourceBoutiqueId].totalTransferOut += quantityToTransfer;
          boutiqueSummary[destBoutiqueId].totalTransferIn += quantityToTransfer;
        }
      }
      processedOverstockItemsKey.add(`${articleId}-${sourceBoutiqueId}`);
    }

    // 5. Insert/Update transfer proposals in the database
    // For simplicity, let's clear existing pending proposals and insert new ones.
    // In a real app, you might want to track proposal history or update existing ones.
    const { error: deleteError } = await supabaseClient
      .from('transfer_proposals')
      .delete()
      .eq('status', 'pending'); // Only delete pending ones
    if (deleteError) console.error("Error deleting old proposals:", deleteError);

    if (transferProposals.length > 0) {
      const { error: insertError } = await supabaseClient
        .from('transfer_proposals')
        .insert(transferProposals.map(p => ({
          article_id: p.article_id,
          source_boutique_id: p.source_boutique_id,
          destination_boutique_id: p.destination_boutique_id,
          quantity: p.quantity,
          status: p.status,
          generated_at: p.generated_at,
        })));
      if (insertError) throw insertError;
    }

    // Format articles to rebalance for output
    const formattedArticlesToRebalance = Object.values(articlesToRebalance).filter(
      a => a.overstockedBoutiques.length > 0 || a.understockedBoutiques.length > 0
    );

    return new Response(JSON.stringify({
      message: 'Analyse d\'équilibrage de stock terminée et rapports générés.',
      recommandations: transferProposals,
      resumeParBoutique: Object.values(boutiqueSummary),
      articlesAReequilibrer: formattedArticlesToRebalance,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Erreur dans la fonction Edge equilibrage-stock:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});