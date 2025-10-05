import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getTransferHistory } from '@/api/reports';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';

export const TransferHistory: React.FC = () => {
  const { data: transfers, isLoading, error } = useQuery({
    queryKey: ['transferHistory'],
    queryFn: getTransferHistory,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return <div className="text-red-500 text-center p-4">Erreur de chargement de l'historique des transferts.</div>;
  }

  if (!transfers || transfers.length === 0) {
    return <div className="text-gray-500 text-center p-4">Aucun transfert enregistré.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Article</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Destination</TableHead>
            <TableHead className="text-right">Quantité</TableHead>
            <TableHead>Statut</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transfers.map((transfer) => (
            <TableRow key={transfer.id}>
              <TableCell>{format(new Date(transfer.created_at), 'dd/MM/yyyy HH:mm')}</TableCell>
              <TableCell>{transfer.articles?.libelle || 'N/A'}</TableCell>
              <TableCell>{transfer.source_boutique?.nom || 'N/A'}</TableCell>
              <TableCell>{transfer.destination_boutique?.nom || 'N/A'}</TableCell>
              <TableCell className="text-right">{transfer.quantite}</TableCell>
              <TableCell>
                <Badge variant={transfer.statut === 'completed' ? 'default' : 'secondary'}>
                  {transfer.statut}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};