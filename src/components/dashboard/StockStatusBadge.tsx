import React from 'react';
import { Badge } from "@/components/ui/badge";
import { StockStatus } from "@/api/stock";
import { cn } from "@/lib/utils";

interface StockStatusBadgeProps {
  status: StockStatus;
}

export const StockStatusBadge: React.FC<StockStatusBadgeProps> = ({ status }) => {
  let variant: "default" | "secondary" | "destructive" | "outline" | null | undefined;
  let text: string;
  let className: string = "";

  switch (status) {
    case 'surstock':
      variant = null; // Utiliser des classes Tailwind directes pour le vert
      text = 'Surstock';
      className = "bg-green-500 text-white hover:bg-green-600";
      break;
    case 'rupture':
      variant = 'destructive';
      text = 'Rupture';
      break;
    case 'normal':
    default:
      variant = 'secondary';
      text = 'Normal';
      className = "bg-gray-400 text-white hover:bg-gray-500";
      break;
  }

  return (
    <Badge variant={variant} className={cn(className)}>
      {text}
    </Badge>
  );
};