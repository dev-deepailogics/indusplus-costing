"use client";

import { useRouter } from "next/navigation";
import { Plus, Search, FileDown, Edit, Trash2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { StyleMasterItem } from "../types";

interface StyleMasterListProps {
  styles: StyleMasterItem[];
  loading: boolean;
  search: string;
  onSearchChange: (search: string) => void;
  onAddStyle: () => void;
  onEditStyle: (style: StyleMasterItem) => void;
  onDeleteStyle: (id: string) => void;
  onExport: () => void;
}

export function StyleMasterList({
  styles,
  loading,
  search,
  onSearchChange,
  onAddStyle,
  onEditStyle,
  onDeleteStyle,
  onExport,
}: StyleMasterListProps) {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Style Master</h1>
          <p className="text-sm text-muted-foreground">
            Central repository for apparel style metadata, BOM, SAM/SMV, and target pricing.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={onExport} className="h-9">
            <FileDown className="mr-1.5 size-4" /> Export
          </Button>
          <Button size="sm" onClick={onAddStyle} className="h-9">
            <Plus className="mr-1.5 size-4" /> Add Style
          </Button>
        </div>
      </div>

      <Card className="bg-card/50 backdrop-blur-sm border-muted/60">
        <CardContent className="p-4">
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by Style ID or Name..."
              className="pl-9 h-9 w-full"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-md border-muted/60">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Loading styles…
            </div>
          ) : styles.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No styles found.
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="font-semibold text-foreground">Style ID</TableHead>
                  <TableHead className="font-semibold text-foreground">Style Name</TableHead>
                  <TableHead className="font-semibold text-foreground">Customer</TableHead>
                  <TableHead className="font-semibold text-foreground">Category</TableHead>
                  <TableHead className="font-semibold text-foreground">SMV Sewing</TableHead>
                  <TableHead className="font-semibold text-foreground">Target FOB ($)</TableHead>
                  <TableHead className="text-right font-semibold text-foreground">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {styles.map((style) => (
                  <TableRow key={style.id} className="hover:bg-muted/20">
                    <TableCell className="font-medium text-primary">{style.id}</TableCell>
                    <TableCell className="font-medium">{style.styleName}</TableCell>
                    <TableCell>{style.customerName || "—"}</TableCell>
                    <TableCell>{style.styleCategory || "—"}</TableCell>
                    <TableCell>{style.smvSewing}</TableCell>
                    <TableCell>${style.baseSellingPrice.toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="icon"
                          className="size-8 text-blue-600 border-blue-200 bg-blue-50/50 hover:bg-blue-50"
                          onClick={() => router.push(`/cost-sheet?styleId=${style.id}`)}
                          title="Pull to Cost Sheet"
                        >
                          <ArrowRight className="size-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="size-8"
                          onClick={() => onEditStyle(style)}
                          title="Edit Style"
                        >
                          <Edit className="size-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="size-8 text-destructive border-destructive/20 hover:bg-destructive/5"
                          onClick={() => onDeleteStyle(style.id)}
                          title="Delete Style"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
