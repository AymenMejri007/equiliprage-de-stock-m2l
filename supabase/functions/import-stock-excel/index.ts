import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import * as XLSX from 'https://esm.sh/xlsx'; // Changement ici : Utilisation de xlsx via esm.sh

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
    const workbook = XLSX.read(arrayBuffer, { type: 'array' }); // Lecture du fichier Excel
    const sheetName = workbook.SheetNames[0];
    const rows: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]); // Conversion directe en JSON

    const processedRows: any[] = [];
    const errors: any[] = [];

    for (const row of rows) {
      try {
        const boutiqueNom = row['Nom Boutique'];
        const familleNom = row['Nom Famille'];
        const sousFamilleNom = row['Nom Sous-Famille'];
        const codeArticle = row['Code Article'];
        const libelleArticle = row['Libellé Article'];
        const stockActuel = parseInt(row['Stock Actuel']);
        const stockMin = parseInt(row['Stock Min']);
        const stockMax = parseInt(row['Stock Max']);

        if (!boutiqueNom || !familleNom || !codeArticle || !libelleArticle || isNaN(stockActuel) || isNaN(stockMin) || isNaN(stockMax)) {
          errors.push({ row, message: 'Missing required data or invalid numbers' });
          continue;
        }

        // 1. Upsert Boutique
        let { data: boutiqueData, error: boutiqueError } = await supabaseClient
          .from('boutiques')
          .select('id')
          .eq('nom', boutiqueNom)
          .single();

        if (boutiqueError && boutiqueError.code === 'PGRST116') { // No rows found
          const { data: newBoutique, error: insertBoutiqueError } = await supabaseClient
            .from('boutiques')
            .insert({ nom: boutiqueNom })
            .select('id')
            .single();
          if (insertBoutiqueError) throw insertBoutiqueError;
          boutiqueData = newBoutique;
        } else if (boutiqueError) {
          throw boutiqueError;
        }
        const boutiqueId = boutiqueData!.id;

        // 2. Upsert Famille
        let { data: familleData, error: familleError } = await supabaseClient
          .from('familles')
          .select('id')
          .eq('nom', familleNom)
          .single();

        if (familleError && familleError.code === 'PGRST116') {
          const { data: newFamille, error: insertFamilleError } = await supabaseClient
            .from('familles')
            .insert({ nom: familleNom })
            .select('id')
            .single();
          if (insertFamilleError) throw insertFamilleError;
          familleData = newFamille;
        } else if (familleError) {
          throw familleError;
        }
        const familleId = familleData!.id;

        // 3. Upsert Sous-Famille (if provided)
        let sousFamilleId = null;
        if (sousFamilleNom) {
          let { data: sousFamilleData, error: sfError } = await supabaseClient
            .from('sous_familles')
            .select('id')
            .eq('nom', sousFamilleNom)
            .eq('famille_id', familleId)
            .single();

          if (sfError && sfError.code === 'PGRST116') {
            const { data: newSousFamille, error: insertSfError } = await supabaseClient
              .from('sous_familles')
              .insert({ nom: sousFamilleNom, famille_id: familleId })
              .select('id')
              .single();
            if (insertSfError) throw insertSfError;
            sousFamilleData = newSousFamille;
          } else if (sfError) {
            throw sfError;
          }
          sousFamilleId = sousFamilleData!.id;
        }

        // 4. Upsert Article
        let { data: articleData, error: articleError } = await supabaseClient
          .from('articles')
          .select('id')
          .eq('code_article', codeArticle)
          .single();

        if (articleError && articleError.code === 'PGRST116') {
          const { data: newArticle, error: insertArticleError } = await supabaseClient
            .from('articles')
            .insert({
              code_article: codeArticle,
              libelle: libelleArticle,
              famille_id: familleId,
              sous_famille_id: sousFamilleId,
            })
            .select('id')
            .single();
          if (insertArticleError) throw insertArticleError;
          articleData = newArticle;
        } else if (articleError) {
          throw articleError;
        }
        const articleId = articleData!.id;

        // 5. Upsert Stock
        const { data: stockUpsertData, error: stockUpsertError } = await supabaseClient
          .from('stock')
          .upsert(
            {
              id_boutique: boutiqueId,
              id_article: articleId,
              stock_actuel: stockActuel,
              stock_min: stockMin,
              stock_max: stockMax,
            },
            { onConflict: 'id_boutique,id_article' } // Requires unique constraint on these columns
          )
          .select();

        if (stockUpsertError) {
          console.error("Stock upsert error:", stockUpsertError);
          throw stockUpsertError;
        }
        processedRows.push(stockUpsertData);

      } catch (rowError: any) {
        console.error("Error processing row:", row, rowError);
        errors.push({ row, message: rowError.message || 'Unknown error' });
      }
    }

    return new Response(JSON.stringify({
      message: `Importation terminée. ${processedRows.length} lignes traitées. ${errors.length} erreurs.`,
      processedRows: processedRows.length,
      errors: errors,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: errors.length > 0 ? 206 : 200, // 206 Partial Content if some errors
    });

  } catch (error: any) {
    console.error('Erreur dans la fonction Edge import-stock-excel:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});