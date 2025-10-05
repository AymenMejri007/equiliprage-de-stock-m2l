import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// Les imports Supabase et XLSX sont commentés pour le débogage, ils seront réactivés plus tard.
// import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
// import * as XLSX from 'https://esm.sh/xlsx';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Log de tous les en-têtes reçus pour un diagnostic complet
    console.log('Received request headers:', req.headers);

    const contentType = req.headers.get('Content-Type');
    console.log('Received Content-Type:', contentType);

    if (!contentType || !contentType.startsWith('multipart/form-data')) {
      console.error('Content-Type check failed. Actual:', contentType);
      return new Response(JSON.stringify({ error: `Invalid Content-Type. Expected multipart/form-data, but received ${contentType}.` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Tente de parser le FormData
    const formData = await req.formData();
    const file = formData.get('excelFile') as File;

    if (!file) {
      return new Response(JSON.stringify({ error: 'No file uploaded' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Si le fichier est reçu, renvoie un message de succès simplifié
    return new Response(JSON.stringify({
      message: `Fichier reçu avec succès : ${file.name}, taille : ${file.size} octets`,
      contentType: contentType,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Erreur dans la fonction Edge import-stock-excel:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});