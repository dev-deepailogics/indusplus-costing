import { Search, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

interface CostSheetsFilterBarProps {
  search: string;
  onSearchChange: (search: string) => void;
  onExport: () => void;
}

export function CostSheetsFilterBar({
  search,
  onSearchChange,
  onExport,
}: CostSheetsFilterBarProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Saved Cost Sheets</h1>
          <p className="text-sm text-muted-foreground">
            Browse, review, and pull historical costing calculations and pricing scenarios.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onExport} className="h-9 self-start md:self-auto">
          <FileDown className="mr-1.5 size-4" /> Export to Excel
        </Button>
      </div>

      <Card className="bg-card/50 backdrop-blur-sm border-muted/60">
        <CardContent className="p-4">
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by ID, Style Name, Scenario Reference, Customer..."
              className="pl-9 h-9 w-full"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
