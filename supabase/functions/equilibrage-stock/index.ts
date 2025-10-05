import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to determine stock status
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

    const today = new Date();
    const sixMonthsAgo = new Date(today.setMonth(today.getMonth() - 6));

    // 1. Récupérer toutes les données nécessaires (stock, articles, familles, sous-familles, boutiques)
    const { data: stockData, error: stockError } = await supabaseClient
      .from('stock')
      .select(`
        id, id_boutique, id_article, stock_actuel, stock_min, stock_max,
        articles (id, libelle, famille_id, sous_famille_id, familles (id, nom), sous_familles (id, nom, famille_id)),
        boutiques (id, nom)
      `);

    if (stockError) throw stockError;

    // 2. Calculer la rotation moyenne par article (consommation moyenne mensuelle)
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
        averageMonthlyConsumption[articleId][boutiqueId] = totalSales / 6; // Assuming 6 months of data
      }
    }

    // Structures pour l'analyse hiérarchique
    const familyAnalysis: { [familleId: string]: { nom: string, totalItems: number, overstock: number, rupture: number, normal: number, boutiques: { [boutiqueId: string]: { nom: string, totalItems: number, overstock: number, rupture: number, normal: number } } } } = {};
    const subFamilyAnalysis: { [sousFamilleId: string]: { nom: string, familleNom: string, totalItems: number, overstock: number, rupture: number, normal: number, boutiques: { [boutiqueId: string]: { nom: string, totalItems: number, overstock: number, rupture: number, normal: number } } } } = {};
    const articleAnalysis: { [articleId: string]: { libelle: string, familleNom: string, sousFamilleNom: string, totalItems: number, overstock: number, rupture: number, normal: number, boutiques: { [boutiqueId: string]: { nom: string, stock_actuel: number, stock_min: number, stock_max: number, status: string } } } } = {};

    const overstockedItems: any[] = [];
    const understockedItems: any[] = [];

    stockData.forEach(item => {
      const currentStock = item.stock_actuel;
      const minStock = item.stock_min;
      const maxStock = item.stock_max;
      const status = getStockStatus(currentStock, minStock, maxStock);

      const boutiqueId = item.id_boutique;
      const boutiqueNom = item.boutiques?.nom || 'Inconnue';
      const articleId = item.id_article;
      const articleLibelle = item.articles?.libelle || 'Inconnu';
      // const articleCode = item.articles?.code_article || 'N/A'; // Removed
      const familleId = item.articles?.famille_id;
      const familleNom = item.articles?.familles?.nom || 'Non classé';
      const sousFamilleId = item.articles?.sous_famille_id;
      const sousFamilleNom = item.articles?.sous_familles?.nom || 'Non classée';

      // Agrégation par Famille
      if (familleId) {
        if (!familyAnalysis[familleId]) {
          familyAnalysis[familleId] = { nom: familleNom, totalItems: 0, overstock: 0, rupture: 0, normal: 0, boutiques: {} };
        }
        familyAnalysis[familleId].totalItems++;
        if (status === 'surstock') familyAnalysis[familleId].overstock++;
        else if (status === 'rupture') familyAnalysis[familleId].rupture++;
        else familyAnalysis[familleId].normal++;

        if (!familyAnalysis[familleId].boutiques[boutiqueId]) {
          familyAnalysis[familleId].boutiques[boutiqueId] = { nom: boutiqueNom, totalItems: 0, overstock: 0, rupture: 0, normal: 0 };
        }
        familyAnalysis[familleId].boutiques[boutiqueId].totalItems++;
        if (status === 'surstock') familyAnalysis[familleId].boutiques[boutiqueId].overstock++;
        else if (status === 'rupture') familyAnalysis[familleId].boutiques[boutiqueId].rupture++;
        else familyAnalysis[familleId].boutiques[boutiqueId].normal++;
      }

      // Agrégation par Sous-Famille
      if (sousFamilleId) {
        if (!subFamilyAnalysis[sousFamilleId]) {
          subFamilyAnalysis[sousFamilleId] = { nom: sousFamilleNom, familleNom: familleNom, totalItems: 0, overstock: 0, rupture: 0, normal: 0, boutiques: {} };
        }
        subFamilyAnalysis[sousFamilleId].totalItems++;
        if (status === 'surstock') subFamilyAnalysis[sousFamilleId].overstock++;
        else if (status === 'rupture') subFamilyAnalysis[sousFamilleId].rupture++;
        else subFamilyAnalysis[sousFamilleId].normal++;

        if (!subFamilyAnalysis[sousFamilleId].boutiques[boutiqueId]) {
          subFamilyAnalysis[sousFamilleId].boutiques[boutiqueId] = { nom: boutiqueNom, totalItems: 0, overstock: 0, rupture: 0, normal: 0 };
        }
        subFamilyAnalysis[sousFamilleId].boutiques[boutiqueId].totalItems++;
        if (status === 'surstock') subFamilyAnalysis[sousFamilleId].boutiques[boutiqueId].overstock++;
        else if (status === 'rupture') subFamilyAnalysis[sousFamilleId].boutiques[boutiqueId].rupture++;
        else familyAnalysis[familleId].boutiques[boutiqueId].normal++;
      }

      // Agrégation par Article
      if (articleId) {
        if (!articleAnalysis[articleId]) {
          articleAnalysis[articleId] = { libelle: articleLibelle, familleNom: familleNom, sousFamilleNom: sousFamilleNom, totalItems: 0, overstock: 0, rupture: 0, normal: 0, boutiques: {} };
        }
        articleAnalysis[articleId].totalItems++;
        if (status === 'surstock') articleAnalysis[articleId].overstock++;
        else if (status === 'rupture') articleAnalysis[articleId].rupture++;
        else articleAnalysis[articleId].normal++;

        articleAnalysis[articleId].boutiques[boutiqueId] = { nom: boutiqueNom, stock_actuel: currentStock, stock_min: minStock, stock_max: maxStock, status: status };
      }

      // Identification des articles en surstock/rupture pour les propositions de transfert
      if (currentStock > maxStock) {
        overstockedItems.push(item);
      } else if (currentStock < minStock) {
        understockedItems.push(item);
      }
    });

    // 3. Proposer un plan d'équilibrage (logique existante, mais peut être affinée avec l'analyse hiérarchique)
    const transferProposals: any[] = [];

    overstockedItems.forEach(overstockItem => {
      const articleId = overstockItem.id_article;
      const sourceBoutiqueId = overstockItem.id_boutique;
      const sourceStock = overstockItem.stock_actuel;
      const sourceMaxStock = overstockItem.stock_max;

      const potentialDestinations = understockedItems.filter(
        understockItem => understockItem.id_article === articleId && understockItem.id_boutique !== sourceBoutiqueId
      );

      potentialDestinations.forEach(destItem => {
        const destBoutiqueId = destItem.id_boutique;
        const destStock = destItem.stock_actuel;
        const destMinStock = destItem.stock_min;
        const destMaxStock = destItem.stock_max;

        const quantityNeededAtDest = destMaxStock - destStock;
        const quantityAvailableFromSource = sourceStock - sourceMaxStock;

        let quantityToTransfer = Math.min(quantityAvailableFromSource, quantityNeededAtDest);

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
      analysis: {
        family: familyAnalysis,
        subFamily: subFamilyAnalysis,
        article: articleAnalysis,
      }
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