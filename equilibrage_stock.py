# -*- coding: utf-8 -*-
#!/usr/bin/env python3

"""
Script d'équilibrage de stock entre boutiques Miss2L
À exécuter une fois par semaine pour générer les recommandations de transfert

Auteur: Manus
Date: Mai 2025
Version: 1.3 (supprime la référence à 'Code article', utilise uniquement 'Code-barres article')
"""

import pandas as pd
import os
import numpy as np
import json
from datetime import datetime
import sys
import traceback

# --- Constantes --- 
# COL_CODE_ARTICLE = 'Code article' # Supprimé
COL_CODE_BARRES = 'Code-barres article'
COL_IDENTIFIANT = 'Identifiant article' # Utilise désormais uniquement le Code-barres
COL_LIBELLE = 'Libellé article'
COL_DEPOT = 'Dépôt'
COL_PHYSIQUE = 'Physique'
COL_VENTES = 'Ventes FO'
COL_STOCK_MAX = 'Stock maximum'
COL_STOCK_MIN = 'Stock minimum'
COL_MARQUE = 'MARQUE'
COL_CAT_PRINC = 'CATEGORIE PRINCIPALE'
COL_SOUS_CAT = 'SOUS-CATEGORIE'

COLONNES_REQUISES = [COL_LIBELLE, COL_DEPOT, COL_PHYSIQUE, COL_VENTES, COL_STOCK_MAX, COL_STOCK_MIN, COL_CODE_BARRES]
COLONNES_OPTIONNELLES = [COL_MARQUE, COL_CAT_PRINC, COL_SOUS_CAT] # COL_CODE_ARTICLE supprimé

def equilibrer_stock(dossier_fichiers_stock, dossier_sortie):
    """
    Fonction principale pour équilibrer le stock entre les boutiques.
    Utilise le Code-barres article comme identifiant unique.
    
    Args:
        dossier_fichiers_stock: Chemin vers le dossier contenant les fichiers Excel de stock des boutiques
        dossier_sortie: Chemin vers le dossier où sauvegarder les résultats
    """
    print(f"Début de l'équilibrage de stock: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Créer le dossier de sortie s'il n'existe pas
    os.makedirs(dossier_sortie, exist_ok=True)
    
    # 1. Collecter et fusionner les données de stock
    print("1. Collecte et fusion des données de stock...")
    try:
        df_complet = collecter_donnees_stock(dossier_fichiers_stock)
        if df_complet is None or df_complet.empty:
             print("ERREUR: Le DataFrame complet est vide ou n'a pas pu être créé après la collecte. Vérifiez les fichiers source et les logs.")
             return None, None
        df_complet.to_excel(os.path.join(dossier_sortie, "stock_complet_avec_id.xlsx"), index=False)
    except ValueError as e:
        print(f"ERREUR lors de la collecte des données: {e}")
        return None, None
    except Exception as e:
        print(f"ERREUR inattendue lors de la collecte des données: {e}")
        traceback.print_exc()
        return None, None

    # 2. Centraliser les données par article (basé sur l'identifiant hybride)
    print("2. Centralisation des données par article...")
    try:
        df_centralise = centraliser_donnees(df_complet)
        if df_centralise is None or df_centralise.empty:
             print("AVERTISSEMENT: Le DataFrame centralisé est vide.")
             # Créer un DataFrame vide avec les colonnes attendues pour éviter les erreurs suivantes
             df_centralise = pd.DataFrame(columns=[COL_IDENTIFIANT, COL_LIBELLE, 'Total Physique', 'Total Ventes FO'])
        df_centralise.to_excel(os.path.join(dossier_sortie, "stock_centralise_complet.xlsx"), index=False)
    except Exception as e:
        print(f"ERREUR inattendue lors de la centralisation des données: {e}")
        traceback.print_exc()
        return None, None

    # 3. Analyser les niveaux de stock
    print("3. Analyse des niveaux de stock...")
    try:
        df_analyse, articles_a_reequilibrer = analyser_stock(df_centralise, df_complet)
        df_analyse.to_excel(os.path.join(dossier_sortie, "analyse_stocks.xlsx"), index=False)
        
        # Sauvegarder les articles à rééquilibrer (pour info/debug)
        output_json_path = os.path.join(dossier_sortie, "articles_a_reequilibrer_details.json")
        try:
            with open(output_json_path, 'w', encoding='utf-8') as f:
                class NpEncoder(json.JSONEncoder):
                    def default(self, obj):
                        if isinstance(obj, np.integer): return int(obj)
                        if isinstance(obj, np.floating): return float(obj)
                        if isinstance(obj, np.ndarray): return obj.tolist()
                        if pd.isna(obj): return None # Gérer les NaN pandas
                        return super(NpEncoder, self).default(obj)
                json.dump(articles_a_reequilibrer, f, indent=4, cls=NpEncoder, ensure_ascii=False)
        except Exception as json_err:
             print(f"ERREUR lors de la sauvegarde JSON des articles à rééquilibrer: {json_err}")
             # Continuer même si le JSON échoue
            
    except Exception as e:
        print(f"ERREUR inattendue lors de l'analyse des stocks: {e}")
        traceback.print_exc()
        return None, None

    # 4. Générer les recommandations de transfert
    print("4. Génération des recommandations de transfert...")
    try:
        if not articles_a_reequilibrer:
            print("Aucun article ne nécessite de rééquilibrage.")
            # Définir les colonnes attendues même si vide
            colonnes_reco = [COL_IDENTIFIANT, COL_LIBELLE, 
                             'Boutique source', 'Boutique destination', 'Quantité à transférer', 
                             'Ventes destination', 'Ventes source', 
                             'Stock Min Dest', 'Stock Max Dest', 'Stock Phys Dest Avant', 
                             'Stock Min Src', 'Stock Max Src', 'Stock Phys Src Avant']
            df_recommandations = pd.DataFrame(columns=colonnes_reco)
        else:
            df_recommandations = generer_recommandations(articles_a_reequilibrer)
        df_recommandations.to_excel(os.path.join(dossier_sortie, "recommandations_transfert.xlsx"), index=False)
    except Exception as e:
        print(f"ERREUR inattendue lors de la génération des recommandations: {e}")
        traceback.print_exc()
        return None, None

    # 5. Créer un résumé des transferts par boutique
    print("5. Création du résumé des transferts...")
    try:
        df_resume = creer_resume_transferts(df_recommandations, df_complet)
        df_resume.to_excel(os.path.join(dossier_sortie, "resume_transferts.xlsx"), index=False)
    except Exception as e:
        print(f"ERREUR inattendue lors de la création du résumé: {e}")
        traceback.print_exc()
        return None, None

    # 6. Créer le fichier Excel complet
    print("6. Création du fichier Excel complet...")
    try:
        creer_fichier_complet(df_recommandations, df_resume, df_analyse, articles_a_reequilibrer, dossier_sortie)
    except Exception as e:
        print(f"ERREUR inattendue lors de la création du fichier Excel final: {e}")
        traceback.print_exc()
        # Ne pas retourner None ici pour que les fichiers précédents soient quand même disponibles

    print(f"Équilibrage de stock terminé: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Résultats sauvegardés dans: {dossier_sortie}")
    
    return df_recommandations, df_resume

def _creer_identifiant_article(row):
    """Crée l'identifiant unique pour une ligne d'article en utilisant le Code-barres."""
    code_barres = str(row[COL_CODE_BARRES]).strip() if pd.notna(row[COL_CODE_BARRES]) else ''
    
    if not code_barres:
        return '' # Ou None, ou un marqueur comme 'ID_MANQUANT'
    return code_barres

def collecter_donnees_stock(dossier_fichiers):
    """Collecte, fusionne les données de stock et crée l'identifiant unique."""
    if not os.path.isdir(dossier_fichiers):
        raise ValueError(f"Le dossier spécifié n'existe pas: {dossier_fichiers}")
        
    fichiers_stock = [os.path.join(dossier_fichiers, f) for f in os.listdir(dossier_fichiers) 
                     if f.lower().endswith('.xlsx') and not f.startswith('~') and ('stock' in f.lower() or 'Stock' in f)]
    
    if not fichiers_stock:
        raise ValueError(f"Aucun fichier Excel de stock trouvé dans {dossier_fichiers}. Assurez-vous que les noms contiennent 'stock' ou 'Stock' et finissent par .xlsx.")

    print(f"Fichiers de stock trouvés: {len(fichiers_stock)}")
    for f in fichiers_stock:
        print(f"  - {os.path.basename(f)}")
    
    dfs = []
    boutiques_trouvees = set()
    erreurs_fichier = []

    for fichier in fichiers_stock:
        try:
            df = pd.read_excel(fichier, engine='openpyxl')
            print(f"Chargement de {os.path.basename(fichier)} - {len(df)} lignes")
            
            df.columns = df.columns.str.strip() # Nettoyer noms colonnes tôt
            colonnes_presentes = df.columns.tolist()
            
            # Vérifier colonnes requises
            colonnes_manquantes_requises = [col for col in COLONNES_REQUISES if col not in colonnes_presentes]
            if colonnes_manquantes_requises:
                msg = f"Colonnes requises manquantes: {colonnes_manquantes_requises}"
                print(f"ATTENTION: {msg} dans {os.path.basename(fichier)}. Fichier ignoré.")
                erreurs_fichier.append(f"{os.path.basename(fichier)}: {msg}")
                continue

            # Ajouter colonnes optionnelles si manquantes
            for col_opt in COLONNES_OPTIONNELLES:
                if col_opt not in df.columns:
                    df[col_opt] = '' # ou np.nan
            
            # Assurer types numériques et gérer erreurs/NaN
            for col in [COL_PHYSIQUE, COL_VENTES, COL_STOCK_MAX, COL_STOCK_MIN]:
                df[col] = pd.to_numeric(df[col], errors='coerce')
                df[col] = df[col].fillna(0).astype(int)
            
            # Vérifier colonne Dépôt
            if COL_DEPOT not in df.columns or df[COL_DEPOT].isnull().all() or df[COL_DEPOT].astype(str).str.strip().eq('').all():
                msg = f"Colonne '{COL_DEPOT}' manquante ou vide"
                print(f"ATTENTION: {msg} dans {os.path.basename(fichier)}. Fichier ignoré.")
                erreurs_fichier.append(f"{os.path.basename(fichier)}: {msg}")
                continue
            df[COL_DEPOT] = df[COL_DEPOT].astype(str).str.strip()
            boutiques_trouvees.update(df[COL_DEPOT].unique())

            # --- Création de l'identifiant unique (Code-barres) --- 
            df[COL_CODE_BARRES] = df[COL_CODE_BARRES].fillna('').astype(str).str.strip()
            
            df[COL_IDENTIFIANT] = df.apply(_creer_identifiant_article, axis=1)
            
            # Vérifier si des identifiants sont vides
            ids_vides = df[COL_IDENTIFIANT] == ''
            if ids_vides.any():
                print(f"ATTENTION: {ids_vides.sum()} articles dans {os.path.basename(fichier)} n'ont pas de Code-barres article valide. Leur identifiant est vide.")
            
            # Sélectionner et réorganiser les colonnes
            colonnes_a_garder = [COL_IDENTIFIANT] + COLONNES_REQUISES + [col for col in COLONNES_OPTIONNELLES if col in df.columns]
            # Éviter les doublons dans la liste
            colonnes_a_garder = list(dict.fromkeys(colonnes_a_garder))
            df = df[colonnes_a_garder]
            
            df['Source'] = os.path.basename(fichier)
            dfs.append(df)

        except FileNotFoundError:
            msg = "Fichier non trouvé"
            print(f"ERREUR: {msg} {fichier}")
            erreurs_fichier.append(f"{os.path.basename(fichier)}: {msg}")
        except Exception as e:
            msg = f"Erreur de chargement/traitement: {str(e)}"
            print(f"ERREUR: {msg} dans {os.path.basename(fichier)}")
            erreurs_fichier.append(f"{os.path.basename(fichier)}: {msg}")
            traceback.print_exc() # Pour plus de détails en debug
    
    if not dfs:
        print("ERREUR CRITIQUE: Aucune donnée valide n'a pu être chargée.")
        if erreurs_fichier:
            print("Erreurs rencontrées par fichier:")
            for err in erreurs_fichier:
                print(f"  - {err}")
        raise ValueError("Traitement arrêté car aucune donnée n'a été chargée.")
    
    df_complet = pd.concat(dfs, ignore_index=True)
    print(f"Données fusionnées - Total: {len(df_complet)} lignes")
    
    boutiques_finales = df_complet[COL_DEPOT].unique()
    print(f"Nombre de boutiques détectées: {len(boutiques_finales)}")
    print(f"Boutiques: {', '.join(sorted(boutiques_finales))}")
    print(f"Nombre d'identifiants articles uniques: {df_complet[COL_IDENTIFIANT].nunique()}")
    
    # Vérifier les doublons (même identifiant article dans la même boutique)
    doublons = df_complet.duplicated(subset=[COL_IDENTIFIANT, COL_DEPOT], keep=False)
    if doublons.any():
        lignes_doublons = df_complet[doublons].sort_values(by=[COL_IDENTIFIANT, COL_DEPOT])
        print(f"ATTENTION: {doublons.sum()} lignes dupliquées (même identifiant article, même dépôt) détectées. Exemple:\n{lignes_doublons.head()}")
        # Décommenter pour supprimer les doublons (garder le premier)
        # df_complet = df_complet.drop_duplicates(subset=[COL_IDENTIFIANT, COL_DEPOT], keep='first')
        # print("Doublons supprimés (première occurrence conservée).")

    return df_complet

def centraliser_donnees(df_complet):
    """Centralise les données par identifiant article unique (Code-barres)."""
    if df_complet is None or df_complet.empty:
        return pd.DataFrame() # Retourner vide si l'entrée est vide
        
    identifiants_uniques = df_complet[COL_IDENTIFIANT].unique()
    boutiques = sorted(df_complet[COL_DEPOT].unique())
    print(f"Centralisation des données pour {len(identifiants_uniques)} identifiants uniques à travers {len(boutiques)} boutiques...")
    
    donnees_centralisees = []
    # Inclure les codes originaux dans les infos à récupérer
    colonnes_info = [COL_LIBELLE, COL_MARQUE, COL_CAT_PRINC, COL_SOUS_CAT, COL_CODE_BARRES]
    
    # Grouper par l'identifiant unique
    grouped = df_complet.groupby(COL_IDENTIFIANT)
    
    for i, (identifiant, article_data) in enumerate(grouped):
        if i % 1000 == 0 and i > 0:
            print(f"  Traitement de l'identifiant {i}/{len(identifiants_uniques)}")
        
        if not identifiant: # Ignorer les identifiants vides si présents
            print(f"ATTENTION: Identifiant vide détecté lors de la centralisation, ignoré.")
            continue
            
        # Récupérer les informations communes (prendre la première non nulle/vide)
        article_info = {COL_IDENTIFIANT: identifiant}
        for col in colonnes_info:
            valeurs = article_data[col].dropna().astype(str).unique()
            valeurs = [v for v in valeurs if v and v.strip()] 
            article_info[col] = valeurs[0] if len(valeurs) > 0 else ''
        
        # Renommer pour clarté
        article_info[COL_CODE_BARRES + ' (ref)'] = article_info.pop(COL_CODE_BARRES)
        
        # Calculer les totaux
        article_info['Total Physique'] = article_data[COL_PHYSIQUE].sum()
        article_info['Total Ventes FO'] = article_data[COL_VENTES].sum()
        
        # Ajouter les données spécifiques à chaque boutique
        for boutique in boutiques:
            boutique_data = article_data[article_data[COL_DEPOT] == boutique]
            
            if not boutique_data.empty:
                # Gérer les doublons potentiels (signalés avant) en prenant la première ligne
                row = boutique_data.iloc[0]
                article_info[f'{boutique} - Physique'] = row[COL_PHYSIQUE]
                article_info[f'{boutique} - Ventes FO'] = row[COL_VENTES]
                article_info[f'{boutique} - Stock maximum'] = row[COL_STOCK_MAX]
                article_info[f'{boutique} - Stock minimum'] = row[COL_STOCK_MIN]
            else:
                article_info[f'{boutique} - Physique'] = 0
                article_info[f'{boutique} - Ventes FO'] = 0
                article_info[f'{boutique} - Stock maximum'] = 0 
                article_info[f'{boutique} - Stock minimum'] = 0
        
        donnees_centralisees.append(article_info)
    
    if not donnees_centralisees:
        print("AVERTISSEMENT: Aucune donnée n'a été centralisée.")
        return pd.DataFrame() # Retourner vide
        
    df_centralise = pd.DataFrame(donnees_centralisees)
    
    # Réorganiser les colonnes
    colonnes_debut = [COL_IDENTIFIANT, COL_CODE_BARRES + ' (ref)', COL_LIBELLE, 
                      COL_MARQUE, COL_CAT_PRINC, COL_SOUS_CAT, 
                      'Total Physique', 'Total Ventes FO']
    colonnes_boutiques = []
    for boutique in boutiques:
        colonnes_boutiques.extend([f'{boutique} - Physique', f'{boutique} - Ventes FO', 
                                   f'{boutique} - Stock minimum', f'{boutique} - Stock maximum'])
        
    # Filtrer pour garder seulement les colonnes existantes et dans l'ordre souhaité
    colonnes_finales = colonnes_debut + colonnes_boutiques
    colonnes_existantes = [col for col in colonnes_finales if col in df_centralise.columns]
    df_centralise = df_centralise[colonnes_existantes]
    
    print(f"Centralisation terminée. {len(df_centralise)} identifiants traités.")
    return df_centralise

def analyser_stock(df_centralise, df_complet):
    """Analyse les niveaux de stock par rapport aux seuils MIN/MAX, basé sur l'identifiant unique."""
    if df_centralise is None or df_centralise.empty or df_complet is None or df_complet.empty:
        print("Analyse impossible: données centralisées ou complètes manquantes.")
        # Retourner des structures vides avec les colonnes attendues
        cols_analyse = [COL_IDENTIFIANT, COL_LIBELLE, 'Total Physique', 'Total Ventes FO', 'Statut Global']
        return pd.DataFrame(columns=cols_analyse), []
        
    boutiques = sorted(df_complet[COL_DEPOT].unique())
    print(f"Analyse des stocks pour {len(df_centralise)} identifiants dans {len(boutiques)} boutiques...")
    
    analyse_stocks_list = []
    articles_a_reequilibrer = [] 
    
    # Seuil de stock minimum pour la boutique source (pour éviter de vider une boutique)
    STOCK_MIN_SOURCE_POUR_TRANSFERT = 1 # ou 2, ou une autre valeur métier
    
    for i, (_, article_data) in enumerate(df_centralise.iterrows()):
        if i % 1000 == 0 and i > 0:
            print(f"  Analyse de l'identifiant {i}/{len(df_centralise)}")
            
        identifiant = article_data[COL_IDENTIFIANT]
        libelle = article_data[COL_LIBELLE]
        # code_article_ref = article_data.get(COL_CODE_ARTICLE + ' (ref)', '') # Supprimé
        code_barres_ref = article_data.get(COL_CODE_BARRES + ' (ref)', '')
        marque = article_data.get(COL_MARQUE, '')
        
        article_info_analyse = {
            COL_IDENTIFIANT: identifiant,
            # COL_CODE_ARTICLE + ' (ref)': code_article_ref, # Supprimé
            COL_CODE_BARRES + ' (ref)': code_barres_ref,
            COL_LIBELLE: libelle,
            COL_MARQUE: marque,
            'Total Physique': article_data['Total Physique'],
            'Total Ventes FO': article_data['Total Ventes FO'],
            'Statut Global': 'OK' # Statut par défaut
        }
        
        besoins_detail = {}
        surplus_detail = {}
        has_besoin = False
        has_surplus = False
        statuts_boutique = []
        
        for boutique in boutiques:
            physique = article_data.get(f'{boutique} - Physique', 0)
            ventes = article_data.get(f'{boutique} - Ventes FO', 0)
            stock_min = article_data.get(f'{boutique} - Stock minimum', 0)
            stock_max = article_data.get(f'{boutique} - Stock maximum', 0)
            
            statut = "OK"
            # Calcul du besoin ou surplus
            besoin = 0
            surplus = 0
            
            if physique < stock_min:
                besoin = stock_min - physique
                statut = f"BESOIN ({besoin})"
                has_besoin = True
                besoins_detail[boutique] = {
                    'besoin': besoin, 
                    'physique': physique, 
                    'min': stock_min, 
                    'max': stock_max, 
                    'ventes': ventes
                }
            elif stock_max > 0 and physique > stock_max: # Ne considérer le surplus que si un max est défini
                # Le surplus est la quantité au-dessus du max, MAIS limité par le stock min source
                # On ne peut proposer au transfert que ce qui est au-dessus du stock min de la boutique source + seuil
                qte_dispo_transfert = max(0, physique - max(stock_min, STOCK_MIN_SOURCE_POUR_TRANSFERT))
                surplus = min(qte_dispo_transfert, physique - stock_max) # Surplus réel au dessus du max
                
                if surplus > 0:
                    statut = f"SURPLUS ({surplus})"
                    has_surplus = True
                    surplus_detail[boutique] = {
                        'surplus': surplus, # Quantité potentiellement transférable au dessus du max
                        'physique': physique, 
                        'min': stock_min, 
                        'max': stock_max, 
                        'ventes': ventes,
                        'qte_dispo_transfert': qte_dispo_transfert # Quantité réellement dispo en comptant stock min source
                    }
            elif stock_max == 0 and physique > stock_min + 5: # Cas sans max défini, surplus si > min + marge ? (A définir)
                 # Logique de surplus à adapter si pas de stock max
                 # Pour l'instant, on ne marque pas de surplus si max=0
                 pass
                 
            article_info_analyse[f'{boutique} - Statut'] = statut
            statuts_boutique.append(statut)

        # Déterminer le statut global de l'article
        if has_besoin and has_surplus:
            article_info_analyse['Statut Global'] = 'Rééquilibrage Possible'
            # Ajouter aux articles à traiter pour les recommandations
            article_details_reco = {
                COL_IDENTIFIANT: identifiant,
                COL_LIBELLE: libelle,
                # COL_CODE_ARTICLE + ' (ref)': code_article_ref, # Supprimé
                COL_CODE_BARRES + ' (ref)': code_barres_ref,
                'besoins': besoins_detail,
                'surplus': surplus_detail
            }
            articles_a_reequilibrer.append(article_details_reco)
        elif has_besoin:
            article_info_analyse['Statut Global'] = 'Besoin Global'
        elif has_surplus:
            article_info_analyse['Statut Global'] = 'Surplus Global'
        else:
            # Vérifier si tous les statuts sont OK
            if all(s == 'OK' for s in statuts_boutique):
                 article_info_analyse['Statut Global'] = 'OK'
            else: # Peut-être un statut bizarre ?
                 article_info_analyse['Statut Global'] = 'Vérifier Statuts Boutique'
                 
        analyse_stocks_list.append(article_info_analyse)
    
    df_analyse = pd.DataFrame(analyse_stocks_list)
    # Réorganiser colonnes df_analyse si besoin
    cols_analyse_debut = [COL_IDENTIFIANT, COL_CODE_BARRES + ' (ref)', COL_LIBELLE, COL_MARQUE, 
                          'Total Physique', 'Total Ventes FO', 'Statut Global']
    cols_analyse_statuts = [f'{b} - Statut' for b in boutiques]
    cols_analyse_final = cols_analyse_debut + cols_analyse_statuts
    cols_analyse_existantes = [c for c in cols_analyse_final if c in df_analyse.columns]
    df_analyse = df_analyse[cols_analyse_existantes]
    
    print(f"Analyse terminée. {len(articles_a_reequilibrer)} articles identifiés pour rééquilibrage potentiel.")
    return df_analyse, articles_a_reequilibrer

def generer_recommandations(articles_a_reequilibrer):
    """Génère les recommandations de transfert article par article."""
    recommandations = []
    print(f"Génération des recommandations pour {len(articles_a_reequilibrer)} articles...")
    
    # Seuil de stock minimum pour la boutique source (répété ici pour clarté)
    STOCK_MIN_SOURCE_POUR_TRANSFERT = 1 

    for i, article_details in enumerate(articles_a_reequilibrer):
        if i % 500 == 0 and i > 0:
             print(f"  Traitement recommandation article {i}/{len(articles_a_reequilibrer)}")
             
        identifiant = article_details[COL_IDENTIFIANT]
        libelle = article_details[COL_LIBELLE]
        # code_article_ref = article_details.get(COL_CODE_ARTICLE + ' (ref)', '') # Supprimé
        code_barres_ref = article_details.get(COL_CODE_BARRES + ' (ref)', '')
        besoins = article_details['besoins']
        surplus = article_details['surplus']
        
        # Trier les besoins par ordre décroissant (les plus urgents d'abord)
        # Trier les surplus par ordre décroissant de quantité dispo (les plus gros stocks d'abord)
        boutiques_besoin = sorted(besoins.keys(), key=lambda b: besoins[b]['besoin'], reverse=True)
        boutiques_surplus = sorted(surplus.keys(), key=lambda b: surplus[b]['physique'], reverse=True)
        
        # Copier les surplus pour pouvoir les modifier pendant l'allocation
        surplus_dispo = {b: s['qte_dispo_transfert'] for b, s in surplus.items()}
        
        for dest in boutiques_besoin:
            besoin_dest = besoins[dest]['besoin']
            
            # Essayer de combler le besoin depuis les boutiques en surplus
            for src in boutiques_surplus:
                if besoin_dest <= 0: break # Besoin comblé pour cette destination
                if src == dest: continue # Ne pas transférer vers soi-même
                if surplus_dispo.get(src, 0) <= 0: continue # Pas de stock dispo dans cette source
                
                # Quantité à transférer = minimum du besoin restant et du surplus dispo
                qte_a_transferer = min(besoin_dest, surplus_dispo[src])
                
                if qte_a_transferer > 0:
                    # Enregistrer la recommandation
                    reco = {
                        COL_IDENTIFIANT: identifiant,
                        # COL_CODE_ARTICLE + ' (ref)': code_article_ref, # Supprimé
                        COL_CODE_BARRES + ' (ref)': code_barres_ref,
                        COL_LIBELLE: libelle,
                        'Boutique source': src,
                        'Boutique destination': dest,
                        'Quantité à transférer': qte_a_transferer,
                        'Ventes destination': besoins[dest]['ventes'],
                        'Ventes source': surplus[src]['ventes'],
                        'Stock Min Dest': besoins[dest]['min'],
                        'Stock Max Dest': besoins[dest]['max'],
                        'Stock Phys Dest Avant': besoins[dest]['physique'],
                        'Stock Min Src': surplus[src]['min'],
                        'Stock Max Src': surplus[src]['max'],
                        'Stock Phys Src Avant': surplus[src]['physique']
                    }
                    recommandations.append(reco)
                    
                    # Mettre à jour le besoin et le surplus disponible
                    besoin_dest -= qte_a_transferer
                    surplus_dispo[src] -= qte_a_transferer
                    
    df_recommandations = pd.DataFrame(recommandations)
    print(f"Génération terminée. {len(df_recommandations)} recommandations créées.")
    return df_recommandations

def creer_resume_transferts(df_recommandations, df_complet):
    """Crée un résumé des quantités à envoyer/recevoir par boutique."""
    if df_recommandations is None or df_recommandations.empty or df_complet is None or df_complet.empty:
        print("Résumé impossible: recommandations ou données complètes manquantes.")
        return pd.DataFrame(columns=['Boutique', 'Articles à envoyer', 'Unités à envoyer', 'Articles à recevoir', 'Unités à recevoir'])
        
    boutiques = sorted(df_complet[COL_DEPOT].unique())
    resume_list = []

    # Calculer les envois
    envois = df_recommandations.groupby('Boutique source').agg(
        articles_a_envoyer=('Identifiant article', 'nunique'),
        unites_a_envoyer=('Quantité à transférer', 'sum')
    ).reset_index().rename(columns={'Boutique source': 'Boutique'})

    # Calculer les réceptions
    receptions = df_recommandations.groupby('Boutique destination').agg(
        articles_a_recevoir=('Identifiant article', 'nunique'),
        unites_a_recevoir=('Quantité à transférer', 'sum')
    ).reset_index().rename(columns={'Boutique destination': 'Boutique'})

    # Créer un DataFrame avec toutes les boutiques
    df_resume = pd.DataFrame({'Boutique': boutiques})

    # Fusionner avec les envois et réceptions
    df_resume = pd.merge(df_resume, envois, on='Boutique', how='left')
    df_resume = pd.merge(df_resume, receptions, on='Boutique', how='left')

    # Remplacer NaN par 0 et convertir en entier
    cols_to_fill = ['articles_a_envoyer', 'unites_a_envoyer', 'articles_a_recevoir', 'unites_a_recevoir']
    for col in cols_to_fill:
        if col in df_resume.columns:
            df_resume[col] = df_resume[col].fillna(0).astype(int)
        else:
             df_resume[col] = 0 # Ajouter la colonne si elle manque après le merge
             
    # Renommer les colonnes pour la sortie finale
    df_resume = df_resume.rename(columns={
        'articles_a_envoyer': 'Articles à envoyer',
        'unites_a_envoyer': 'Unités à envoyer',
        'articles_a_recevoir': 'Articles à recevoir',
        'unites_a_recevoir': 'Unités à recevoir'
    })
    
    # Assurer l'ordre des colonnes
    df_resume = df_resume[['Boutique', 'Articles à envoyer', 'Unités à envoyer', 'Articles à recevoir', 'Unités à recevoir']]

    print("Résumé des transferts créé.")
    return df_resume

def creer_fichier_complet(df_recommandations, df_resume, df_analyse, articles_a_reequilibrer_details, dossier_sortie):
    """Crée un fichier Excel unique avec plusieurs feuilles."""
    nom_fichier_final = os.path.join(dossier_sortie, "Resultats_Equilibrage_Complet.xlsx")
    print(f"Création du fichier Excel final: {nom_fichier_final}")
    
    try:
        with pd.ExcelWriter(nom_fichier_final, engine='openpyxl') as writer:
            if df_recommandations is not None and not df_recommandations.empty:
                df_recommandations.to_excel(writer, sheet_name='Recommandations Transfert', index=False)
            else:
                pd.DataFrame([{'Message': "Aucune recommandation générée"}]).to_excel(writer, sheet_name='Recommandations Transfert', index=False)
                
            if df_resume is not None and not df_resume.empty:
                df_resume.to_excel(writer, sheet_name='Résumé par Boutique', index=False)
            else:
                 pd.DataFrame([{'Message': "Aucun résumé généré"}]).to_excel(writer, sheet_name='Résumé par Boutique', index=False)

            if df_analyse is not None and not df_analyse.empty:
                df_analyse.to_excel(writer, sheet_name='Analyse Stocks', index=False)
            else:
                 pd.DataFrame([{'Message': "Aucune analyse générée"}]).to_excel(writer, sheet_name='Analyse Stocks', index=False)
                 
            # Optionnel: Ajouter les détails bruts des articles à rééquilibrer (peut être volumineux)
            # try:
            #     if articles_a_reequilibrer_details:
            #         # Convertir la liste de dicts en DataFrame peut être complexe si les dicts sont imbriqués
            #         # Une approche simple est de sauvegarder le JSON, mais on peut essayer de l'aplatir
            #         # df_details = pd.json_normalize(articles_a_reequilibrer_details, sep='_') # Aplatit la structure
            #         # df_details.to_excel(writer, sheet_name='Détails Rééquilibrage (Brut)', index=False)
            #         # Pour l'instant, on ne l'ajoute pas pour éviter la complexité
            #         pass 
            # except Exception as e_details:
            #     print(f"Avertissement: N'a pas pu ajouter la feuille 'Détails Rééquilibrage': {e_details}")

        print(f"Fichier Excel complet '{os.path.basename(nom_fichier_final)}' créé avec succès.")

    except Exception as e:
        print(f"ERREUR lors de l'écriture du fichier Excel final: {e}")
        traceback.print_exc()

# --- Point d'entrée principal --- 
if __name__ == "__main__":
    print(f"Lancement du script d'équilibrage - Version 1.3")
    
    # Déterminer les chemins d'entrée/sortie
    if len(sys.argv) == 3:
        dossier_fichiers_stock = sys.argv[1]
        dossier_sortie = sys.argv[2]
        print(f"Utilisation des dossiers fournis en argument:")
        print(f"  - Dossier d'entrée: {dossier_fichiers_stock}")
        print(f"  - Dossier de sortie: {dossier_sortie}")
    else:
        try:
            chemin_script = os.path.dirname(os.path.abspath(__file__))
        except NameError: 
            chemin_script = os.getcwd()
        dossier_fichiers_stock = os.path.join(chemin_script, 'fichiers_stock') # Nom de dossier plus standard
        dossier_sortie = os.path.join(chemin_script, 'resultats_equilibrage')
        print(f"Utilisation des dossiers par défaut (relatifs au script/courant):")
        print(f"  - Dossier d'entrée: {dossier_fichiers_stock}")
        print(f"  - Dossier de sortie: {dossier_sortie}")
        print("Vous pouvez spécifier les dossiers en arguments: python script.py \"chemin/input\" \"chemin/output\"")
        
        # Créer les dossiers par défaut s'ils n'existent pas (utile si lancé sans args)
        os.makedirs(dossier_fichiers_stock, exist_ok=True)
        os.makedirs(dossier_sortie, exist_ok=True)
        if not os.listdir(dossier_fichiers_stock):
             print(f"ATTENTION: Le dossier d'entrée par défaut '{os.path.basename(dossier_fichiers_stock)}' est vide.")

    # Lancer l'équilibrage
    exit_code = 0
    try:
        equilibrer_stock(dossier_fichiers_stock, dossier_sortie)
    except ValueError as ve:
        print(f"ERREUR DE CONFIGURATION OU DONNÉES: {ve}")
        exit_code = 1
    except Exception as e:
        print(f"Une erreur critique est survenue lors de l'exécution principale: {e}")
        traceback.print_exc()
        exit_code = 1

    if exit_code == 0:
        print("Script terminé avec succès.")
    else:
        print("Script terminé avec des erreurs.")
        
    sys.exit(exit_code)