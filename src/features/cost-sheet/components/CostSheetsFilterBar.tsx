import { Search, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

interface CostSheetsFilterBarProps {
  search: string;
  onSearchChange: (search: string) => void;
  customerFilter: string;
  onCustomerFilterChange: (customer: string) => void;
  stageFilter: string;
  onStageFilterChange: (stage: string) => void;
  uniqueCustomers: string[];
  uniqueStages: string[];
  onExport: () => void;
}

export function CostSheetsFilterBar({
  search,
  onSearchChange,
  customerFilter,
  onCustomerFilterChange,
  stageFilter,
  onStageFilterChange,
  uniqueCustomers,
  uniqueStages,
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
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search by ID, Style Name, Scenario Reference, Customer..."
                className="pl-9 h-9"
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <select
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none"
                value={customerFilter}
                onChange={(e) => onCustomerFilterChange(e.target.value)}
              >
                <option value="all">All Customers</option>
                {uniqueCustomers.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none"
                value={stageFilter}
                onChange={(e) => onStageFilterChange(e.target.value)}
              >
                <option value="all">All Stages</option>
                {uniqueStages.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
