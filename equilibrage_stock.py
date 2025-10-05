# -*- coding: utf-8 -*-
#!/usr/bin/env python3

"""
Script d'équilibrage de stock entre boutiques Miss2L
À exécuter une fois par semaine pour générer les recommandations de transfert

Auteur: Manus
Date: Mai 2025
Version: 1.4 (Refactorisation modulaire)
"""

import pandas as pd
import os
import numpy as np
import json
from datetime import datetime
import sys
import traceback

# --- Constantes --- 
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
COLONNES_OPTIONNELLES = [COL_MARQUE, COL_CAT_PRINC, COL_SOUS_CAT]

STOCK_MIN_SOURCE_POUR_TRANSFERT = 1 # Seuil de stock minimum pour la boutique source (pour éviter de vider une boutique)

# --- Fonctions auxiliaires ---

def _creer_identifiant_article(row):
    """Crée l'identifiant unique pour une ligne d'article en utilisant le Code-barres."""
    code_barres = str(row[COL_CODE_BARRES]).strip() if pd.notna(row[COL_CODE_BARRES]) else ''
    return code_barres if code_barres else ''

def _validate_and_clean_df(df, filename, erreurs_fichier):
    """Valide les colonnes requises et nettoie un DataFrame de stock."""
    df.columns = df.columns.str.strip() # Nettoyer noms colonnes tôt
    colonnes_presentes = df.columns.tolist()
    
    # Vérifier colonnes requises
    colonnes_manquantes_requises = [col for col in COLONNES_REQUISES if col not in colonnes_presentes]
    if colonnes_manquantes_requises:
        msg = f"Colonnes requises manquantes: {colonnes_manquantes_requises}"
        print(f"ATTENTION: {msg} dans {filename}. Fichier ignoré.")
        erreurs_fichier.append(f"{filename}: {msg}")
        return None

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
        print(f"ATTENTION: {msg} dans {filename}. Fichier ignoré.")
        erreurs_fichier.append(f"{filename}: {msg}")
        return None
    df[COL_DEPOT] = df[COL_DEPOT].astype(str).str.strip()

    # Création de l'identifiant unique (Code-barres)
    df[COL_CODE_BARRES] = df[COL_CODE_BARRES].fillna('').astype(str).str.strip()
    df[COL_IDENTIFIANT] = df.apply(_creer_identifiant_article, axis=1)
    
    ids_vides = df[COL_IDENTIFIANT] == ''
    if ids_vides.any():
        print(f"ATTENTION: {ids_vides.sum()} articles dans {filename} n'ont pas de Code-barres article valide. Leur identifiant est vide.")
    
    # Sélectionner et réorganiser les colonnes
    colonnes_a_garder = [COL_IDENTIFIANT] + COLONNES_REQUISES + [col for col in COLONNES_OPTIONNELLES if col in df.columns]
    colonnes_a_garder = list(dict.fromkeys(colonnes_a_garder)) # Éviter les doublons
    df = df[colonnes_a_garder]
    
    df['Source'] = filename
    return df

def _analyze_article_stock_status(article_data_row, boutiques):
    """Analyse le statut de stock d'un article pour toutes les boutiques."""
    identifiant = article_data_row[COL_IDENTIFIANT]
    libelle = article_data_row[COL_LIBELLE]
    code_barres_ref = article_data_row.get(COL_CODE_BARRES + ' (ref)', '')
    marque = article_data_row.get(COL_MARQUE, '')
    
    article_info_analyse = {
        COL_IDENTIFIANT: identifiant,
        COL_CODE_BARRES + ' (ref)': code_barres_ref,
        COL_LIBELLE: libelle,
        COL_MARQUE: marque,
        'Total Physique': article_data_row['Total Physique'],
        'Total Ventes FO': article_data_row['Total Ventes FO'],
        'Statut Global': 'OK'
    }
    
    besoins_detail = {}
    surplus_detail = {}
    has_besoin = False
    has_surplus = False
    statuts_boutique = []
    
    for boutique in boutiques:
        physique = article_data_row.get(f'{boutique} - Physique', 0)
        ventes = article_data_row.get(f'{boutique} - Ventes FO', 0)
        stock_min = article_data_row.get(f'{boutique} - Stock minimum', 0)
        stock_max = article_data_row.get(f'{boutique} - Stock maximum', 0)
        
        statut = "OK"
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
        elif stock_max > 0 and physique > stock_max:
            qte_dispo_transfert = max(0, physique - max(stock_min, STOCK_MIN_SOURCE_POUR_TRANSFERT))
            surplus = min(qte_dispo_transfert, physique - stock_max)
            
            if surplus > 0:
                statut = f"SURPLUS ({surplus})"
                has_surplus = True
                surplus_detail[boutique] = {
                    'surplus': surplus,
                    'physique': physique, 
                    'min': stock_min, 
                    'max': stock_max, 
                    'ventes': ventes,
                    'qte_dispo_transfert': qte_dispo_transfert
                }
        article_info_analyse[f'{boutique} - Statut'] = statut
        statuts_boutique.append(statut)

    if has_besoin and has_surplus:
        article_info_analyse['Statut Global'] = 'Rééquilibrage Possible'
    elif has_besoin:
        article_info_analyse['Statut Global'] = 'Besoin Global'
    elif has_surplus:
        article_info_analyse['Statut Global'] = 'Surplus Global'
    elif all(s == 'OK' for s in statuts_boutique):
        article_info_analyse['Statut Global'] = 'OK'
    else:
        article_info_analyse['Statut Global'] = 'Vérifier Statuts Boutique'
             
    return article_info_analyse, {
        COL_IDENTIFIANT: identifiant,
        COL_LIBELLE: libelle,
        COL_CODE_BARRES + ' (ref)': code_barres_ref,
        'besoins': besoins_detail,
        'surplus': surplus_detail
    } if has_besoin and has_surplus else None

def _generate_transfers_for_single_article(article_details):
    """Génère les recommandations de transfert pour un seul article."""
    recommandations_article = []
    identifiant = article_details[COL_IDENTIFIANT]
    libelle = article_details[COL_LIBELLE]
    code_barres_ref = article_details.get(COL_CODE_BARRES + ' (ref)', '')
    besoins = article_details['besoins']
    surplus = article_details['surplus']
    
    boutiques_besoin = sorted(besoins.keys(), key=lambda b: besoins[b]['besoin'], reverse=True)
    boutiques_surplus = sorted(surplus.keys(), key=lambda b: surplus[b]['physique'], reverse=True)
    
    surplus_dispo = {b: s['qte_dispo_transfert'] for b, s in surplus.items()}
    
    for dest in boutiques_besoin:
        besoin_dest = besoins[dest]['besoin']
        
        for src in boutiques_surplus:
            if besoin_dest <= 0: break
            if src == dest: continue
            if surplus_dispo.get(src, 0) <= 0: continue
            
            qte_a_transferer = min(besoin_dest, surplus_dispo[src])
            
            if qte_a_transferer > 0:
                reco = {
                    COL_IDENTIFIANT: identifiant,
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
                recommandations_article.append(reco)
                
                besoin_dest -= qte_a_transferer
                surplus_dispo[src] -= qte_a_transferer
                
    return recommandations_article

# --- Fonctions principales ---

def collecter_donnees_stock(dossier_fichiers):
    """Collecte et fusionne les données de stock de tous les fichiers Excel."""
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
    erreurs_fichier = []

    for fichier in fichiers_stock:
        try:
            df = pd.read_excel(fichier, engine='openpyxl')
            print(f"Chargement de {os.path.basename(fichier)} - {len(df)} lignes")
            processed_df = _validate_and_clean_df(df, os.path.basename(fichier), erreurs_fichier)
            if processed_df is not None:
                dfs.append(processed_df)
        except Exception as e:
            msg = f"Erreur de chargement/traitement: {str(e)}"
            print(f"ERREUR: {msg} dans {os.path.basename(fichier)}")
            erreurs_fichier.append(f"{os.path.basename(fichier)}: {msg}")
            traceback.print_exc()
    
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
    
    doublons = df_complet.duplicated(subset=[COL_IDENTIFIANT, COL_DEPOT], keep=False)
    if doublons.any():
        lignes_doublons = df_complet[doublons].sort_values(by=[COL_IDENTIFIANT, COL_DEPOT])
        print(f"ATTENTION: {doublons.sum()} lignes dupliquées (même identifiant article, même dépôt) détectées. Exemple:\n{lignes_doublons.head()}")

    return df_complet

def centraliser_donnees(df_complet):
    """Centralise les données par identifiant article unique (Code-barres)."""
    if df_complet is None or df_complet.empty:
        return pd.DataFrame()
        
    identifiants_uniques = df_complet[COL_IDENTIFIANT].unique()
    boutiques = sorted(df_complet[COL_DEPOT].unique())
    print(f"Centralisation des données pour {len(identifiants_uniques)} identifiants uniques à travers {len(boutiques)} boutiques...")
    
    donnees_centralisees = []
    colonnes_info = [COL_LIBELLE, COL_MARQUE, COL_CAT_PRINC, COL_SOUS_CAT, COL_CODE_BARRES]
    
    grouped = df_complet.groupby(COL_IDENTIFIANT)
    
    for i, (identifiant, article_data) in enumerate(grouped):
        if i % 1000 == 0 and i > 0:
            print(f"  Traitement de l'identifiant {i}/{len(identifiants_uniques)}")
        
        if not identifiant:
            print(f"ATTENTION: Identifiant vide détecté lors de la centralisation, ignoré.")
            continue
            
        article_info = {COL_IDENTIFIANT: identifiant}
        for col in colonnes_info:
            valeurs = article_data[col].dropna().astype(str).unique()
            valeurs = [v for v in valeurs if v and v.strip()] 
            article_info[col] = valeurs[0] if len(valeurs) > 0 else ''
        
        article_info[COL_CODE_BARRES + ' (ref)'] = article_info.pop(COL_CODE_BARRES)
        
        article_info['Total Physique'] = article_data[COL_PHYSIQUE].sum()
        article_info['Total Ventes FO'] = article_data[COL_VENTES].sum()
        
        for boutique in boutiques:
            boutique_data = article_data[article_data[COL_DEPOT] == boutique]
            
            if not boutique_data.empty:
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
        return pd.DataFrame()
        
    df_centralise = pd.DataFrame(donnees_centralisees)
    
    colonnes_debut = [COL_IDENTIFIANT, COL_CODE_BARRES + ' (ref)', COL_LIBELLE, 
                      COL_MARQUE, COL_CAT_PRINC, COL_SOUS_CAT, 
                      'Total Physique', 'Total Ventes FO']
    colonnes_boutiques = []
    for boutique in boutiques:
        colonnes_boutiques.extend([f'{boutique} - Physique', f'{boutique} - Ventes FO', 
                                   f'{boutique} - Stock minimum', f'{boutique} - Stock maximum'])
        
    colonnes_finales = colonnes_debut + colonnes_boutiques
    colonnes_existantes = [col for col in colonnes_finales if col in df_centralise.columns]
    df_centralise = df_centralise[colonnes_existantes]
    
    print(f"Centralisation terminée. {len(df_centralise)} identifiants traités.")
    return df_centralise

def analyser_stock(df_centralise, df_complet):
    """Analyse les niveaux de stock par rapport aux seuils MIN/MAX, basé sur l'identifiant unique."""
    if df_centralise is None or df_centralise.empty or df_complet is None or df_complet.empty:
        print("Analyse impossible: données centralisées ou complètes manquantes.")
        cols_analyse = [COL_IDENTIFIANT, COL_LIBELLE, 'Total Physique', 'Total Ventes FO', 'Statut Global']
        return pd.DataFrame(columns=cols_analyse), []
        
    boutiques = sorted(df_complet[COL_DEPOT].unique())
    print(f"Analyse des stocks pour {len(df_centralise)} identifiants dans {len(boutiques)} boutiques...")
    
    analyse_stocks_list = []
    articles_a_reequilibrer = [] 
    
    for i, (_, article_data_row) in enumerate(df_centralise.iterrows()):
        if i % 1000 == 0 and i > 0:
            print(f"  Analyse de l'identifiant {i}/{len(df_centralise)}")
            
        article_info_analyse, article_details_reco = _analyze_article_stock_status(article_data_row, boutiques)
        
        analyse_stocks_list.append(article_info_analyse)
        if article_details_reco:
            articles_a_reequilibrer.append(article_details_reco)
    
    df_analyse = pd.DataFrame(analyse_stocks_list)
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
    
    for i, article_details in enumerate(articles_a_reequilibrer):
        if i % 500 == 0 and i > 0:
             print(f"  Traitement recommandation article {i}/{len(articles_a_reequilibrer)}")
             
        recommandations.extend(_generate_transfers_for_single_article(article_details))
                    
    df_recommandations = pd.DataFrame(recommandations)
    print(f"Génération terminée. {len(df_recommandations)} recommandations créées.")
    return df_recommandations

def creer_resume_transferts(df_recommandations, df_complet):
    """Crée un résumé des quantités à envoyer/recevoir par boutique."""
    if df_recommandations is None or df_recommandations.empty or df_complet is None or df_complet.empty:
        print("Résumé impossible: recommandations ou données complètes manquantes.")
        return pd.DataFrame(columns=['Boutique', 'Articles à envoyer', 'Unités à envoyer', 'Articles à recevoir', 'Unités à recevoir'])
        
    boutiques = sorted(df_complet[COL_DEPOT].unique())

    envois = df_recommandations.groupby('Boutique source').agg(
        articles_a_envoyer=('Identifiant article', 'nunique'),
        unites_a_envoyer=('Quantité à transférer', 'sum')
    ).reset_index().rename(columns={'Boutique source': 'Boutique'})

    receptions = df_recommandations.groupby('Boutique destination').agg(
        articles_a_recevoir=('Identifiant article', 'nunique'),
        unites_a_recevoir=('Quantité à transférer', 'sum')
    ).reset_index().rename(columns={'Boutique destination': 'Boutique'})

    df_resume = pd.DataFrame({'Boutique': boutiques})

    df_resume = pd.merge(df_resume, envois, on='Boutique', how='left')
    df_resume = pd.merge(df_resume, receptions, on='Boutique', how='left')

    cols_to_fill = ['articles_a_envoyer', 'unites_a_envoyer', 'articles_a_recevoir', 'unites_a_recevoir']
    for col in cols_to_fill:
        if col in df_resume.columns:
            df_resume[col] = df_resume[col].fillna(0).astype(int)
        else:
             df_resume[col] = 0
             
    df_resume = df_resume.rename(columns={
        'articles_a_envoyer': 'Articles à envoyer',
        'unites_a_envoyer': 'Unités à envoyer',
        'articles_a_recevoir': 'Articles à recevoir',
        'unites_a_recevoir': 'Unités à recevoir'
    })
    
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
                 
        print(f"Fichier Excel complet '{os.path.basename(nom_fichier_final)}' créé avec succès.")

    except Exception as e:
        print(f"ERREUR lors de l'écriture du fichier Excel final: {e}")
        traceback.print_exc()

# --- Point d'entrée principal --- 
if __name__ == "__main__":
    print(f"Lancement du script d'équilibrage - Version 1.4 (Refactorisé)")
    
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
        dossier_fichiers_stock = os.path.join(chemin_script, 'fichiers_stock')
        dossier_sortie = os.path.join(chemin_script, 'resultats_equilibrage')
        print(f"Utilisation des dossiers par défaut (relatifs au script/courant):")
        print(f"  - Dossier d'entrée: {dossier_fichiers_stock}")
        print(f"  - Dossier de sortie: {dossier_sortie}")
        print("Vous pouvez spécifier les dossiers en arguments: python script.py \"chemin/input\" \"chemin/output\"")
        
        os.makedirs(dossier_fichiers_stock, exist_ok=True)
        os.makedirs(dossier_sortie, exist_ok=True)
        if not os.listdir(dossier_fichiers_stock):
             print(f"ATTENTION: Le dossier d'entrée par défaut '{os.path.basename(dossier_fichiers_stock)}' est vide.")

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