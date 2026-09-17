import { Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { WorkOrderItem } from "../types";

interface WorkOrdersTableProps {
  workOrders: WorkOrderItem[];
  loading: boolean;
  styleLabel: (styleId: string) => string;
  onEdit: (wo: WorkOrderItem) => void;
  onDelete: (id: string) => void;
}

export function WorkOrdersTable({
  workOrders,
  loading,
  styleLabel,
  onEdit,
  onDelete,
}: WorkOrdersTableProps) {
  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="font-semibold">Work Order #</TableHead>
            <TableHead className="font-semibold">Linked Style</TableHead>
            <TableHead className="w-24 text-right font-semibold">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                Loading work orders...
              </TableCell>
            </TableRow>
          ) : workOrders.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                No work orders found.
              </TableCell>
            </TableRow>
          ) : (
            workOrders.map((wo) => (
              <TableRow key={wo.id} className="hover:bg-muted/20">
                <TableCell className="font-mono font-medium">{wo.id}</TableCell>
                <TableCell>{styleLabel(wo.styleId)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() => onEdit(wo)}
                    >
                      <Edit className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-destructive hover:bg-destructive/10"
                      onClick={() => onDelete(wo.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
