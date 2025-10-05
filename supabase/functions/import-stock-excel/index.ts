import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import * as XLSX from 'https://esm.sh/xlsx';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const formData = await req.formData();
    const file = formData.get('excelFile') as File;

    if (!file) {
      return new Response(JSON.stringify({ error: 'No file uploaded' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const rows: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    console.log("Parsed Excel rows:", rows); // Log des données parsées

    const errors: any[] = [];

    // --- 1. Pré-chargement et mise en cache des données existantes ---
    const { data: existingBoutiques, error: errBoutiques } = await supabaseClient.from('boutiques').select('id, nom');
    if (errBoutiques) throw errBoutiques;
    const boutiqueMap = new Map(existingBoutiques.map(b => [b.nom, b.id]));

    const { data: existingFamilles, error: errFamilles } = await supabaseClient.from('familles').select('id, nom');
    if (errFamilles) throw errFamilles;
    const familleMap = new Map(existingFamilles.map(f => [f.nom, f.id]));

    const { data: existingSousFamilles, error: errSousFamilles } = await supabaseClient.from('sous_familles').select('id, nom, famille_id');
    if (errSousFamilles) throw errSousFamilles;
    // Clé composite pour sous-familles: nom + famille_id
    const sousFamilleMap = new Map(existingSousFamilles.map(sf => [`${sf.nom}-${sf.famille_id}`, sf.id]));

    // Charger les articles existants par code_barres_article, en nettoyant les valeurs
    const { data: existingArticles, error: errArticles } = await supabaseClient.from('articles').select('id, code_barres_article');
    if (errArticles) throw errArticles;
    const articleMap = new Map(existingArticles.map(a => [String(a.code_barres_article).trim(), a.id]));

    // --- Collecteurs pour les opérations groupées (utilisent des Maps pour la déduplication) ---
    const boutiquesToInsert: { id: string, nom: string }[] = [];
    const famillesToInsert: { id: string, nom: string }[] = [];
    const sousFamillesToInsert: { id: string, nom: string, famille_id: string }[] = [];
    const articlesToUpsertMap = new Map<string, any>(); // Clé: code_barres_article
    const stockToUpsertMap = new Map<string, any>();    // Clé: `${id_boutique}-${id_article}`
    const ventesToUpsertMap = new Map<string, any>();    // Clé: `${id_boutique}-${id_article}-${date_mois}`

    for (const row of rows) {
      try {
        const depotNom = row['Dépôt'];
        const marqueArticle = row['MARQUE'];
        const categoriePrincipaleNom = row['CATEGORIE PRINCIPALE'];
        const sousCategorieNom = row['SOUS-CATEGORIE'];
        const codeArticle = row['Code article']; // Peut être null/undefined
        const libelleArticle = row['Libellé article'];
        const colorisArticle = row['Coloris'];
        const codeBarresArticleRaw = row['Code-barres article']; // Valeur brute
        const stockActuel = parseInt(row['Physique']);
        const ventesFO = parseInt(row['Ventes FO']);
        const stockMax = parseInt(row['Stock maximum']);
        const stockMin = parseInt(row['Stock minimum']);

        // Validation et nettoyage de codeBarresArticle
        if (!codeBarresArticleRaw) {
          errors.push({ row, message: 'Missing Code-barres article (mandatory)' });
          continue;
        }
        const codeBarresArticle = String(codeBarresArticleRaw).trim(); // Nettoyage ici

        // Validation plus spécifique
        if (!depotNom) {
          errors.push({ row, message: 'Missing Dépôt name' });
          continue;
        }
        if (!categoriePrincipaleNom) {
          errors.push({ row, message: 'Missing CATEGORIE PRINCIPALE' });
          continue;
        }
        if (!libelleArticle) {
          errors.push({ row, message: 'Missing Libellé article' });
          continue;
        }
        if (isNaN(stockActuel)) {
          errors.push({ row, message: 'Invalid or missing Physique stock (must be a number)' });
          continue;
        }
        if (isNaN(stockMin)) {
          errors.push({ row, message: 'Invalid or missing Stock minimum (must be a number)' });
          continue;
        }
        if (isNaN(stockMax)) {
          errors.push({ row, message: 'Invalid or missing Stock maximum (must be a number)' });
          continue;
        }

        let boutiqueId: string;
        if (boutiqueMap.has(depotNom)) {
          boutiqueId = boutiqueMap.get(depotNom)!;
        } else {
          const newBoutiqueId = crypto.randomUUID();
          boutiquesToInsert.push({ id: newBoutiqueId, nom: depotNom });
          boutiqueMap.set(depotNom, newBoutiqueId);
          boutiqueId = newBoutiqueId;
        }

        let familleId: string;
        if (familleMap.has(categoriePrincipaleNom)) {
          familleId = familleMap.get(categoriePrincipaleNom)!;
        } else {
          const newFamilleId = crypto.randomUUID();
          famillesToInsert.push({ id: newFamilleId, nom: categoriePrincipaleNom });
          familleMap.set(categoriePrincipaleNom, newFamilleId);
          familleId = newFamilleId;
        }

        let sousFamilleId: string | null = null;
        if (sousCategorieNom) {
          const sousFamilleKey = `${sousCategorieNom}-${familleId}`;
          if (sousFamilleMap.has(sousFamilleKey)) {
            sousFamilleId = sousFamilleMap.get(sousFamilleKey)!;
          } else {
            const newSousFamilleId = crypto.randomUUID();
            sousFamillesToInsert.push({ id: newSousFamilleId, nom: sousCategorieNom, famille_id: familleId });
            sousFamilleMap.set(sousFamilleKey, newSousFamilleId);
            sousFamilleId = newSousFamilleId;
          }
        }

        let articleId: string;
        const existingArticleId = articleMap.get(codeBarresArticle); // Utilise la valeur nettoyée

        const articlePayload: any = {
          code_article: codeArticle || null, // Rendre nullable
          libelle: libelleArticle,
          famille_id: familleId,
          sous_famille_id: sousFamilleId,
          marque: marqueArticle,
          coloris: colorisArticle,
          code_barres_article: codeBarresArticle, // Utilise la valeur nettoyée
        };

        if (existingArticleId) {
          articleId = existingArticleId;
          articlesToUpsertMap.set(codeBarresArticle, {
            id: articleId, // Inclure l'ID existant pour la mise à jour
            ...articlePayload,
          });
        } else {
          articleId = crypto.randomUUID();
          articlesToUpsertMap.set(codeBarresArticle, {
            id: articleId,
            ...articlePayload,
          });
          articleMap.set(codeBarresArticle, articleId); // Mettre à jour la map pour les lignes suivantes dans le même lot
        }

        stockToUpsertMap.set(`${boutiqueId}-${articleId}`, {
          id_boutique: boutiqueId,
          id_article: articleId,
          stock_actuel: stockActuel,
          stock_min: stockMin,
          stock_max: stockMax,
        });

        if (!isNaN(ventesFO) && ventesFO >= 0) {
          const monthlySalesQuantity = Math.round(ventesFO / 6);
          const today = new Date();
          for (let i = 0; i < 6; i++) {
            const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
            const dateMois = date.toISOString().split('T')[0];
            ventesToUpsertMap.set(`${boutiqueId}-${articleId}-${dateMois}`, {
              id_boutique: boutiqueId,
              id_article: articleId,
              date_mois: dateMois,
              quantite_vendue: monthlySalesQuantity,
            });
          }
        }

      } catch (rowError: any) {
        console.error("Error processing row:", row, rowError);
        errors.push({ row, message: rowError.message || 'Unknown error' });
      }
    }

    // --- 2. Exécution des opérations groupées ---

    if (boutiquesToInsert.length > 0) {
      const { error: insertError } = await supabaseClient.from('boutiques').insert(boutiquesToInsert);
      if (insertError) throw insertError;
    }
    if (famillesToInsert.length > 0) {
      const { error: insertError } = await supabaseClient.from('familles').insert(famillesToInsert);
      if (insertError) throw insertError;
    }
    if (sousFamillesToInsert.length > 0) {
      const { error: insertError } = await supabaseClient.from('sous_familles').insert(sousFamillesToInsert);
      if (insertError) throw insertError;
    }

    // Convertir les Maps en tableaux pour l'upsert
    const articlesToUpsert = Array.from(articlesToUpsertMap.values());
    const stockToUpsert = Array.from(stockToUpsertMap.values());
    const ventesToUpsert = Array.from(ventesToUpsertMap.values());

    if (articlesToUpsert.length > 0) {
      const { error: upsertError } = await supabaseClient
        .from('articles')
        .upsert(articlesToUpsert, { onConflict: 'code_barres_article' });
      if (upsertError) throw upsertError;
    }

    if (stockToUpsert.length > 0) {
      const { error: upsertError } = await supabaseClient
        .from('stock')
        .upsert(stockToUpsert, { onConflict: 'id_boutique,id_article' });
      if (upsertError) throw upsertError;
    }

    if (ventesToUpsert.length > 0) {
      const { error: upsertError } = await supabaseClient
        .from('ventes')
        .upsert(ventesToUpsert, { onConflict: 'id_boutique,id_article,date_mois' });
      if (upsertError) throw upsertError;
    }

    return new Response(JSON.stringify({
      message: `Importation terminée. ${rows.length - errors.length} lignes traitées avec succès. ${errors.length} erreurs.`,
      processedRows: rows.length - errors.length,
      errors: errors,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: errors.length > 0 ? 206 : 200,
    });

  } catch (error: any) {
    console.error('Erreur dans la fonction Edge import-stock-excel:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});