import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GitCompareArrows, TrendingUp, TrendingDown } from 'lucide-react';

interface ArticleAnalysisItem {
  libelle: string;
  overstock: number;
  rupture: number;
  totalItems: number;
}

interface StockBalancingSummaryProps {
  report: {
    proposalsCount: number;
    analysis: {
      article: {
        [articleId: string]: ArticleAnalysisItem;
      };
    };
  } | null;
}

export const StockBalancingSummary: React.FC<StockBalancingSummaryProps> = ({ report }) => {
  if (!report) {
    return null;
  }

  let totalOverstockedArticles = 0;
  let totalUnderstockedArticles = 0;

  if (report.analysis && report.analysis.article) {
    for (const articleId in report.analysis.article) {
      const article = report.analysis.article[articleId];
      if (article.overstock > 0) {
        totalOverstockedArticles++;
      }
      if (article.rupture > 0) {
        totalUnderstockedArticles++;
      }
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
      <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-200">
            Propositions de Transfert
          </CardTitle>
          <GitCompareArrows className="h-5 w-5 text-blue-600 dark:text-blue-300" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-800 dark:text-blue-100">{report.proposalsCount}</div>
          <p className="text-xs text-blue-600 dark:text-blue-300">
            propositions générées
          </p>
        </CardContent>
      </Card>

      <Card className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-green-700 dark:text-green-200">
            Articles en Surstock
          </CardTitle>
          <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-300" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-800 dark:text-green-100">{totalOverstockedArticles}</div>
          <p className="text-xs text-green-600 dark:text-green-300">
            articles identifiés
          </p>
        </CardContent>
      </Card>

      <Card className="bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-red-700 dark:text-red-200">
            Articles en Rupture
          </CardTitle>
          <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-300" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-800 dark:text-red-100">{totalUnderstockedArticles}</div>
          <p className="text-xs text-red-600 dark:text-red-300">
            articles identifiés
          </p>
        </CardContent>
      </Card>
    </div>
  );
};