import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialiser le client Supabase avec la clé de rôle de service pour un accès complet
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const today = new Date();
    const sixMonthsAgo = new Date(today.setMonth(today.getMonth() - 6));

    // 1. Calculer la rotation moyenne par article (consommation moyenne mensuelle)
    const { data: salesData, error: salesError } = await supabaseClient
      .from('ventes')
      .select('id_article, id_boutique, quantite_vendue, date_mois')
      .gte('date_mois', sixMonthsAgo.toISOString().split('T')[0]);

    if (salesError) throw salesError;

    const articleMonthlyConsumption: { [articleId: string]: { [boutiqueId: string]: number[] } } = {};

    salesData.forEach(sale => {
      if (!articleMonthlyConsumption[sale.id_article]) {
        articleMonthlyConsumption[sale.id_article] = {};
      }
      if (!articleMonthlyConsumption[sale.id_article][sale.id_boutique]) {
        articleMonthlyConsumption[sale.id_article][sale.id_boutique] = [];
      }
      articleMonthlyConsumption[sale.id_article][sale.id_boutique].push(sale.quantite_vendue);
    });

    const averageMonthlyConsumption: { [articleId: string]: { [boutiqueId: string]: number } } = {};
    for (const articleId in articleMonthlyConsumption) {
      averageMonthlyConsumption[articleId] = {};
      for (const boutiqueId in articleMonthlyConsumption[articleId]) {
        const totalSales = articleMonthlyConsumption[articleId][boutiqueId].reduce((sum, qty) => sum + qty, 0);
        // Assuming 6 months of data, calculate average monthly
        averageMonthlyConsumption[articleId][boutiqueId] = totalSales / 6; 
      }
    }

    // 2. Récupérer le stock actuel
    const { data: stockData, error: stockError } = await supabaseClient
      .from('stock')
      .select('*, articles(libelle), boutiques(nom)');

    if (stockError) throw stockError;

    const overstockedItems: any[] = [];
    const understockedItems: any[] = []; // Inclut rupture et bas niveau

    stockData.forEach(item => {
      const currentStock = item.stock_actuel;
      const minStock = item.stock_min;
      const maxStock = item.stock_max;

      if (currentStock > maxStock) {
        overstockedItems.push(item);
      } else if (currentStock < minStock) {
        understockedItems.push(item);
      }
      // On pourrait ajouter une condition pour "bas niveau" si stock_actuel est entre min et un seuil
    });

    // 3. Proposer un plan d'équilibrage
    const transferProposals: any[] = [];

    overstockedItems.forEach(overstockItem => {
      const articleId = overstockItem.id_article;
      const sourceBoutiqueId = overstockItem.id_boutique;
      const sourceStock = overstockItem.stock_actuel;
      const sourceMaxStock = overstockItem.stock_max;

      // Trouver les boutiques en rupture/bas niveau pour le même article
      const potentialDestinations = understockedItems.filter(
        understockItem => understockItem.id_article === articleId && understockItem.id_boutique !== sourceBoutiqueId
      );

      potentialDestinations.forEach(destItem => {
        const destBoutiqueId = destItem.id_boutique;
        const destStock = destItem.stock_actuel;
        const destMinStock = destItem.stock_min;
        const destMaxStock = destItem.stock_max;

        // Calcul de la quantité transférable
        // Option 1: Basé sur le surstock de la source et le besoin de la destination (jusqu'au max)
        const quantityNeededAtDest = destMaxStock - destStock;
        const quantityAvailableFromSource = sourceStock - sourceMaxStock;

        let quantityToTransfer = Math.min(quantityAvailableFromSource, quantityNeededAtDest);

        // Option 2: Basé sur la rotation moyenne (si plus pertinent)
        // const avgConsumptionDest = averageMonthlyConsumption[articleId]?.[destBoutiqueId] || 0;
        // const quantityBasedOnRotation = Math.max(0, avgConsumptionDest * 2 - destStock); // Ex: 2 mois de stock
        // quantityToTransfer = Math.min(quantityToTransfer, quantityBasedOnRotation);

        if (quantityToTransfer > 0) {
          transferProposals.push({
            article_id: articleId,
            source_boutique_id: sourceBoutiqueId,
            destination_boutique_id: destBoutiqueId,
            quantity: quantityToTransfer,
            status: 'pending',
            generated_at: new Date().toISOString(),
          });
        }
      });
    });

    // 4. Insérer les propositions dans la base de données
    if (transferProposals.length > 0) {
      const { error: insertError } = await supabaseClient
        .from('transfer_proposals')
        .insert(transferProposals);

      if (insertError) throw insertError;
    }

    return new Response(JSON.stringify({
      message: 'Analyse hebdomadaire terminée et propositions de transferts générées.',
      proposalsCount: transferProposals.length,
      proposals: transferProposals,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Erreur dans la fonction Edge weekly-stock-analysis:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});