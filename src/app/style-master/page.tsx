"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, FileDown, Edit, Trash2, ArrowRight, X } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { subscribeToStyles, saveStyle, deleteStyle } from "@/lib/style-master/firestore";
import type {
  StyleMasterItem,
  BOMFabricItem,
  BOMLiningItem,
  BOMAccessoriesItem,
  BOMChemicalsItem,
  BOMSpecialChargesItem,
} from "@/lib/style-master/types";
import { subscribeToTable } from "@/lib/parameters/firestore";
import type { DropdownListsData } from "@/lib/parameters/types";

// Default options if database list is empty
const DEFAULT_CUSTOMERS = ["Duer", "Zara", "Mustang", "Miniconf", "Mohito", "Retrojeans"];
const DEFAULT_CATEGORIES = ["Top Ware", "Men's Pant", "Ladies Pant", "Shorts", "Shirt"];
const DEFAULT_WASHES = ["Rinse", "Dyeing", "Softner", "Stone Wash", "EW/Biopolish", "Silicon Ball"];

const DEFAULT_ACCESSORIES_TEMPLATES = [
  { category: "Zipper", itemName: "Zippers" },
  { category: "Thread", itemName: "Thread" },
  { category: "Label", itemName: "Labels" },
  { category: "Trims", itemName: "Trims Mix Materials" },
  { category: "Poly Bag", itemName: "Poly Bags" },
  { category: "Tag", itemName: "Tag" },
  { category: "Carton", itemName: "Cartons" },
  { category: "Button & Rivets", itemName: "Button & Rivets" },
  { category: "Packing Mix Materials", itemName: "Packing Mix Materials" },
  { category: "Sticker", itemName: "Sticker" },
];

const DEFAULT_CHEMICALS_TEMPLATES = [
  { washItem: "Rinse" },
];

const DEFAULT_SPECIAL_TEMPLATES = [
  { itemName: "Embroidery" },
  { itemName: "Printing Charges" },
  { itemName: "Testing Charges" },
  { itemName: "Inspection Charges" },
];

function mergeAccessories(existing: BOMAccessoriesItem[] | undefined): BOMAccessoriesItem[] {
  const list = [...(existing || [])];
  DEFAULT_ACCESSORIES_TEMPLATES.forEach(tmpl => {
    const hasCategory = list.some(item => item.category?.toLowerCase() === tmpl.category.toLowerCase());
    if (!hasCategory) {
      list.push({
        category: tmpl.category,
        itemName: tmpl.itemName,
        consPerPc: 0,
        ratePKR: 0,
        totalCostPKR: 0
      });
    }
  });
  return list;
}

function mergeChemicals(existing: BOMChemicalsItem[] | undefined): BOMChemicalsItem[] {
  const list = [...(existing || [])];
  DEFAULT_CHEMICALS_TEMPLATES.forEach(tmpl => {
    const hasItem = list.some(item => item.washItem?.toLowerCase() === tmpl.washItem.toLowerCase());
    if (!hasItem) {
      list.push({
        washItem: tmpl.washItem,
        consPerPc: 0,
        ratePKR: 0,
        totalCostPKR: 0
      });
    }
  });
  return list;
}

function mergeSpecialCharges(existing: BOMSpecialChargesItem[] | undefined): BOMSpecialChargesItem[] {
  const list = [...(existing || [])];
  DEFAULT_SPECIAL_TEMPLATES.forEach(tmpl => {
    const hasItem = list.some(item => item.itemName?.toLowerCase().replace(/\s+/g, "") === tmpl.itemName.toLowerCase().replace(/\s+/g, ""));
    if (!hasItem) {
      list.push({
        itemName: tmpl.itemName,
        consPerPc: 0,
        ratePKR: 0,
        totalCostPKR: 0
      });
    }
  });
  return list;
}

export default function StyleMasterPage() {
  const router = useRouter();
  const [styles, setStyles] = useState<StyleMasterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  // Dialog State
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStyle, setEditingStyle] = useState<StyleMasterItem | null>(null);

  // Exchange rate helper
  const DEFAULT_PARITY = 278;

  useEffect(() => {
    // Subscribe to Styles
    const unsubStyles = subscribeToStyles((data) => {
      setStyles(data);
      setLoading(false);
    });

    return () => {
      unsubStyles();
    };
  }, []);

  // Form Fields State for the Modal
  const [formMeta, setFormMeta] = useState({
    id: "",
    styleName: "",
    smvSewing: 0,
    targetEfficiency: 0.47,
    rejectionPct: 0.0415,
    baseSellingPrice: 0,
  });

  const [formFabric, setFormFabric] = useState<BOMFabricItem[]>([]);
  const [formLining, setFormLining] = useState<BOMLiningItem[]>([]);
  const [formAccessories, setFormAccessories] = useState<BOMAccessoriesItem[]>([]);
  const [formChemicals, setFormChemicals] = useState<BOMChemicalsItem[]>([]);
  const [formSpecialCharges, setFormSpecialCharges] = useState<BOMSpecialChargesItem[]>([]);

  // Setup Form when Editing
  function openEditDialog(style: StyleMasterItem | null) {
    if (style) {
      setEditingStyle(style);
      setFormMeta({
        id: style.id,
        styleName: style.styleName,
        smvSewing: style.smvSewing || 0,
        targetEfficiency: style.targetEfficiency || 0.47,
        rejectionPct: style.rejectionPct || 0.0415,
        baseSellingPrice: style.baseSellingPrice || 0,
      });
      // Ensure Fabric has at least 5 template rows
      const initialFabric = [...(style.bomFabric || [])];
      while (initialFabric.length < 5) {
        initialFabric.push({
          itemName: `Fabric ${initialFabric.length + 1}`,
          consumptionPerPc: 0,
          rateUSD: 0,
          ratePKR: 0,
          fabricCostPKR: 0,
        });
      }
      setFormFabric(initialFabric);

      // Ensure Lining has at least 5 template rows
      const initialLining = [...(style.bomLining || [])];
      while (initialLining.length < 5) {
        initialLining.push({
          itemName: `Lining ${initialLining.length + 1}`,
          consumptionPerPc: 0,
          rateUSD: 0,
          ratePKR: 0,
          liningCostPKR: 0,
        });
      }
      setFormLining(initialLining);

      // Ensure Accessories defaults are loaded
      setFormAccessories(mergeAccessories(style.bomAccessories));

      // Ensure Chemicals are initialized
      setFormChemicals(mergeChemicals(style.bomChemicals));

      // Ensure Special Charges are initialized
      setFormSpecialCharges(mergeSpecialCharges(style.bomSpecialCharges));
    } else {
      setEditingStyle(null);
      // New style defaults
      setFormMeta({
        id: `STY-${String(styles.length + 1).padStart(3, "0")}`,
        styleName: "",
        smvSewing: 15,
        targetEfficiency: 0.47,
        rejectionPct: 0.0415,
        baseSellingPrice: 10,
      });
      // Initial items
      setFormFabric(Array.from({ length: 5 }, (_, i) => ({ itemName: `Fabric ${i+1}`, consumptionPerPc: 0, rateUSD: 0, ratePKR: 0, fabricCostPKR: 0 })));
      setFormLining(Array.from({ length: 5 }, (_, i) => ({ itemName: `Lining ${i+1}`, consumptionPerPc: 0, rateUSD: 0, ratePKR: 0, liningCostPKR: 0 })));
      setFormAccessories(mergeAccessories([]));
      setFormChemicals(mergeChemicals([]));
      setFormSpecialCharges(mergeSpecialCharges([]));
    }
    setDialogOpen(true);
  }

  // Size Bracket Helper
  function calculateSizeBracket(qty: number): string {
    if (qty >= 125000) return "Capacity Qty";
    if (qty <= 500) return "<=500";
    if (qty <= 1000) return "501-1000";
    if (qty <= 2000) return "1001-2000";
    if (qty <= 3000) return "2001-3000";
    if (qty <= 4000) return "3001-4000";
    if (qty <= 5000) return "4001-5000";
    if (qty <= 10000) return "5001-10000";
    if (qty <= 25000) return "10001-25000";
    return ">25000";
  }

  // Save changes
  async function handleSave() {
    if (!formMeta.id || !formMeta.styleName) {
      toast.error("Style ID and Style Name are required");
      return;
    }

    const qty = 1000;
    const calculatedBracket = calculateSizeBracket(qty);

    const styleItem: StyleMasterItem = {
      ...formMeta,
      customerName: editingStyle?.customerName || "Duer",
      styleCategory: editingStyle?.styleCategory || "Top Ware",
      orderType: editingStyle?.orderType || "Denim",
      washType: editingStyle?.washType || "Rinse",
      orderQuantity: editingStyle?.orderQuantity || qty,
      sizeBracket: calculatedBracket,
      bomFabric: formFabric.filter((f) => f.consumptionPerPc > 0 || f.rateUSD > 0),
      bomLining: formLining.filter((l) => l.consumptionPerPc > 0 || l.rateUSD > 0),
      bomAccessories: formAccessories,
      bomChemicals: formChemicals,
      bomSpecialCharges: formSpecialCharges,
    };

    try {
      await saveStyle(styleItem);
      toast.success(editingStyle ? "Style updated successfully" : "New Style added successfully");
      setDialogOpen(false);
    } catch (e) {
      console.error(e);
      toast.error("Failed to save style to database");
    }
  }

  async function handleDelete(id: string) {
    if (confirm("Are you sure you want to delete this style?")) {
      try {
        await deleteStyle(id);
        toast.success("Style deleted");
      } catch (e) {
        console.error(e);
        toast.error("Delete failed");
      }
    }
  }

  // XLSX Export
  function handleExport() {
    const dataToExport = styles.map((s) => ({
      Style_ID: s.id,
      Style_Name: s.styleName,
      Customer_Name: s.customerName,
      Category: s.styleCategory,
      Order_Type: s.orderType,
      Wash_Type: s.washType,
      Order_Quantity: s.orderQuantity,
      Size_Bracket: s.sizeBracket,
      SMV_Sewing: s.smvSewing,
      Efficiency: s.targetEfficiency,
      Rejection_Pct: s.rejectionPct,
      Base_Price_USD: s.baseSellingPrice,
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Styles");
    XLSX.writeFile(workbook, "Style_Master_Export.xlsx");
    toast.success("Exported to Excel");
  }

  interface ImportedStyleRow {
    Style_ID?: string;
    Style_Name?: string;
    SMV_Sewing?: string | number;
    Efficiency?: string | number;
    Rejection_Pct?: string | number;
    Base_Price_USD?: string | number;
  }

  // XLSX Import
  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const workbook = XLSX.read(bstr, { type: "binary" });
        const wsname = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[wsname];
        const importedData = XLSX.utils.sheet_to_json<ImportedStyleRow>(worksheet);

        for (const row of importedData) {
          const qty = 1000;
          const item: StyleMasterItem = {
            id: row.Style_ID || `STY-${Date.now().toString().slice(-4)}`,
            styleName: row.Style_Name || "Unnamed Import",
            customerName: "Duer",
            styleCategory: "Top Ware",
            orderType: "Denim",
            washType: "Rinse",
            orderQuantity: qty,
            sizeBracket: calculateSizeBracket(qty),
            smvSewing: Number(row.SMV_Sewing || 15),
            targetEfficiency: Number(row.Efficiency || 0.47),
            rejectionPct: Number(row.Rejection_Pct || 0.0415),
            baseSellingPrice: Number(row.Base_Price_USD || 0),
            bomFabric: [],
            bomLining: [],
            bomAccessories: [],
            bomChemicals: [],
            bomSpecialCharges: [],
          };
          await saveStyle(item);
        }
        toast.success("Successfully imported styles");
      } catch (err) {
        console.error(err);
        toast.error("Failed to parse Excel sheet");
      }
    };
    reader.readAsBinaryString(file);
  }

  // Filter and Search logic
  const filteredStyles = styles.filter((s) => {
    return s.id.toLowerCase().includes(search.toLowerCase()) ||
      s.styleName.toLowerCase().includes(search.toLowerCase());
  });

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
          <Button variant="outline" size="sm" onClick={handleExport} className="h-9">
            <FileDown className="mr-1.5 size-4" /> Export
          </Button>
          <Button size="sm" onClick={() => openEditDialog(null)} className="h-9">
            <Plus className="mr-1.5 size-4" /> Add Style
          </Button>
        </div>
      </div>

      {/* Search & Filter bar */}
      <Card className="bg-card/50 backdrop-blur-sm border-muted/60">
        <CardContent className="p-4">
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by Style ID or Name..."
              className="pl-9 h-9 w-full"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Main Styles Table */}
      <Card className="shadow-md border-muted/60">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading styles…</div>
          ) : filteredStyles.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No styles found.</div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="font-semibold text-foreground">Style ID</TableHead>
                  <TableHead className="font-semibold text-foreground">Style Name</TableHead>
                  <TableHead className="font-semibold text-foreground">SMV Sewing</TableHead>
                  <TableHead className="font-semibold text-foreground">Target FOB ($)</TableHead>
                  <TableHead className="text-right font-semibold text-foreground">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStyles.map((style) => (
                  <TableRow key={style.id} className="hover:bg-muted/20">
                    <TableCell className="font-medium text-primary">{style.id}</TableCell>
                    <TableCell className="font-medium">{style.styleName}</TableCell>
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
                          onClick={() => openEditDialog(style)}
                          title="Edit Style"
                        >
                          <Edit className="size-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="size-8 text-destructive border-destructive/20 hover:bg-destructive/5"
                          onClick={() => handleDelete(style.id)}
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

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[85vh] w-full flex flex-col p-0">
          <DialogHeader className="px-6 pt-5 pb-2 border-b">
            <DialogTitle className="text-lg font-semibold flex items-center justify-between">
              <span>{editingStyle ? "Edit Apparel Style" : "Add New Apparel Style"}</span>
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="meta" className="flex-1 overflow-hidden flex flex-col">
            <div className="px-6 border-b bg-muted/20">
              <TabsList variant="line" className="h-12 w-full justify-start gap-4 p-0">
                <TabsTrigger value="meta" className="px-1 py-3 text-sm font-semibold">General Meta</TabsTrigger>
                <TabsTrigger value="fabric" className="px-1 py-3 text-sm font-semibold">Fabric BOM</TabsTrigger>
                <TabsTrigger value="lining" className="px-1 py-3 text-sm font-semibold">Lining BOM</TabsTrigger>
                <TabsTrigger value="accessories" className="px-1 py-3 text-sm font-semibold">Accessories</TabsTrigger>
                <TabsTrigger value="charges" className="px-1 py-3 text-sm font-semibold">Chem & Others</TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {/* META TAB */}
              <TabsContent value="meta" className="m-0 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Style ID *</label>
                    <Input
                      disabled={editingStyle !== null}
                      value={formMeta.id}
                      onChange={(e) => setFormMeta({ ...formMeta, id: e.target.value })}
                      placeholder="e.g. STY-001"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Style Name *</label>
                    <Input
                      value={formMeta.styleName}
                      onChange={(e) => setFormMeta({ ...formMeta, styleName: e.target.value })}
                      placeholder="e.g. TR 298 VITA"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">SMV Sewing (SAM)</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formMeta.smvSewing || ""}
                      onChange={(e) => setFormMeta({ ...formMeta, smvSewing: Number(e.target.value) })}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Base Selling Price ($)</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formMeta.baseSellingPrice || ""}
                      onChange={(e) => setFormMeta({ ...formMeta, baseSellingPrice: Number(e.target.value) })}
                    />
                  </div>
                </div>
              </TabsContent>

              {/* FABRIC TAB */}
              <TabsContent value="fabric" className="m-0 space-y-3">
                <p className="text-xs text-muted-foreground mb-2">Configure Fabric requirements (rates in USD. Conversion default is {DEFAULT_PARITY} PKR/$).</p>
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow>
                        <TableHead>Fabric Item Name</TableHead>
                        <TableHead className="w-24">Consumption (Mtr)</TableHead>
                        <TableHead className="w-28">Rate (USD)</TableHead>
                        <TableHead className="w-32">Rate (PKR)</TableHead>
                        <TableHead className="w-32">Fabric Cost (PKR)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {formFabric.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="p-2">
                            <Input
                              value={item.itemName}
                              onChange={(e) => {
                                const newFab = [...formFabric];
                                newFab[idx].itemName = e.target.value;
                                setFormFabric(newFab);
                              }}
                            />
                          </TableCell>
                          <TableCell className="p-2">
                            <Input
                              type="number"
                              step="0.01"
                              value={item.consumptionPerPc || ""}
                              onChange={(e) => {
                                const cons = Number(e.target.value);
                                const newFab = [...formFabric];
                                newFab[idx].consumptionPerPc = cons;
                                newFab[idx].fabricCostPKR = cons * newFab[idx].ratePKR;
                                setFormFabric(newFab);
                              }}
                            />
                          </TableCell>
                          <TableCell className="p-2">
                            <Input
                              type="number"
                              step="0.01"
                              value={item.rateUSD || ""}
                              onChange={(e) => {
                                const rateUSD = Number(e.target.value);
                                const ratePKR = rateUSD * DEFAULT_PARITY;
                                const newFab = [...formFabric];
                                newFab[idx].rateUSD = rateUSD;
                                newFab[idx].ratePKR = ratePKR;
                                newFab[idx].fabricCostPKR = newFab[idx].consumptionPerPc * ratePKR;
                                setFormFabric(newFab);
                              }}
                            />
                          </TableCell>
                          <TableCell className="p-2">
                            <Input
                              type="number"
                              value={item.ratePKR || ""}
                              onChange={(e) => {
                                const ratePKR = Number(e.target.value);
                                const newFab = [...formFabric];
                                newFab[idx].ratePKR = ratePKR;
                                newFab[idx].rateUSD = ratePKR / DEFAULT_PARITY;
                                newFab[idx].fabricCostPKR = newFab[idx].consumptionPerPc * ratePKR;
                                setFormFabric(newFab);
                              }}
                            />
                          </TableCell>
                          <TableCell className="p-2 align-middle font-medium text-right pr-4">
                            Rs. {item.fabricCostPKR.toFixed(1)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              {/* LINING TAB */}
              <TabsContent value="lining" className="m-0 space-y-3">
                <p className="text-xs text-muted-foreground mb-2">Configure Pocket Lining requirements (rates in USD. Conversion default is {DEFAULT_PARITY} PKR/$).</p>
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow>
                        <TableHead>Lining Item Name</TableHead>
                        <TableHead className="w-24">Consumption (Mtr)</TableHead>
                        <TableHead className="w-28">Rate (USD)</TableHead>
                        <TableHead className="w-32">Rate (PKR)</TableHead>
                        <TableHead className="w-32">Cost (PKR)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {formLining.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="p-2">
                            <Input
                              value={item.itemName}
                              onChange={(e) => {
                                const newLin = [...formLining];
                                newLin[idx].itemName = e.target.value;
                                setFormLining(newLin);
                              }}
                            />
                          </TableCell>
                          <TableCell className="p-2">
                            <Input
                              type="number"
                              step="0.01"
                              value={item.consumptionPerPc || ""}
                              onChange={(e) => {
                                const cons = Number(e.target.value);
                                const newLin = [...formLining];
                                newLin[idx].consumptionPerPc = cons;
                                newLin[idx].liningCostPKR = cons * newLin[idx].ratePKR;
                                setFormLining(newLin);
                              }}
                            />
                          </TableCell>
                          <TableCell className="p-2">
                            <Input
                              type="number"
                              step="0.01"
                              value={item.rateUSD || ""}
                              onChange={(e) => {
                                const rateUSD = Number(e.target.value);
                                const ratePKR = rateUSD * DEFAULT_PARITY;
                                const newLin = [...formLining];
                                newLin[idx].rateUSD = rateUSD;
                                newLin[idx].ratePKR = ratePKR;
                                newLin[idx].liningCostPKR = newLin[idx].consumptionPerPc * ratePKR;
                                setFormLining(newLin);
                              }}
                            />
                          </TableCell>
                          <TableCell className="p-2">
                            <Input
                              type="number"
                              value={item.ratePKR || ""}
                              onChange={(e) => {
                                const ratePKR = Number(e.target.value);
                                const newLin = [...formLining];
                                newLin[idx].ratePKR = ratePKR;
                                newLin[idx].rateUSD = ratePKR / DEFAULT_PARITY;
                                newLin[idx].liningCostPKR = newLin[idx].consumptionPerPc * ratePKR;
                                setFormLining(newLin);
                              }}
                            />
                          </TableCell>
                          <TableCell className="p-2 align-middle font-medium text-right pr-4">
                            Rs. {item.liningCostPKR.toFixed(1)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              {/* ACCESSORIES TAB */}
              <TabsContent value="accessories" className="m-0 space-y-3">
                <p className="text-xs text-muted-foreground mb-2">Configure Accessories (rates in PKR directly).</p>
                <div className="rounded-lg border max-h-[300px] overflow-auto">
                  <Table>
                    <TableHeader className="bg-muted/40 sticky top-0 z-10">
                      <TableRow>
                        <TableHead className="w-40">Category</TableHead>
                        <TableHead>Item Details</TableHead>
                        <TableHead className="w-24">Cons. / Pc</TableHead>
                        <TableHead className="w-28">Rate (PKR)</TableHead>
                        <TableHead className="w-32">Total Cost (PKR)</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {formAccessories.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="p-2">
                            <select
                              className="w-full h-8 rounded-md border border-input bg-transparent px-2 py-0.5 text-xs focus-visible:outline-none"
                              value={item.category}
                              onChange={(e) => {
                                const nextAcc = [...formAccessories];
                                nextAcc[idx].category = e.target.value as BOMAccessoriesItem["category"];
                                setFormAccessories(nextAcc);
                              }}
                            >
                              <option value="Zipper">Zipper</option>
                              <option value="Thread">Thread</option>
                              <option value="Label">Label</option>
                              <option value="Trims">Trims</option>
                              <option value="Poly Bag">Poly Bag</option>
                              <option value="Carton">Carton</option>
                              <option value="Button">Button</option>
                              <option value="Packing Mix">Packing Mix</option>
                              <option value="Sticker">Sticker</option>
                            </select>
                          </TableCell>
                          <TableCell className="p-2">
                            <Input
                              className="h-8 text-xs"
                              value={item.itemName}
                              onChange={(e) => {
                                const nextAcc = [...formAccessories];
                                nextAcc[idx].itemName = e.target.value;
                                setFormAccessories(nextAcc);
                              }}
                            />
                          </TableCell>
                          <TableCell className="p-2">
                            <Input
                              type="number"
                              step="0.01"
                              className="h-8 text-xs"
                              value={item.consPerPc || ""}
                              onChange={(e) => {
                                const cons = Number(e.target.value);
                                const nextAcc = [...formAccessories];
                                nextAcc[idx].consPerPc = cons;
                                nextAcc[idx].totalCostPKR = cons * nextAcc[idx].ratePKR;
                                setFormAccessories(nextAcc);
                              }}
                            />
                          </TableCell>
                          <TableCell className="p-2">
                            <Input
                              type="number"
                              className="h-8 text-xs"
                              value={item.ratePKR || ""}
                              onChange={(e) => {
                                const rate = Number(e.target.value);
                                const nextAcc = [...formAccessories];
                                nextAcc[idx].ratePKR = rate;
                                nextAcc[idx].totalCostPKR = nextAcc[idx].consPerPc * rate;
                                setFormAccessories(nextAcc);
                              }}
                            />
                          </TableCell>
                          <TableCell className="p-2 align-middle font-medium text-right pr-4 text-xs">
                            Rs. {item.totalCostPKR.toFixed(1)}
                          </TableCell>
                          <TableCell className="p-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-6 text-destructive"
                              onClick={() => setFormAccessories(formAccessories.filter((_, i) => i !== idx))}
                            >
                              <X className="size-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setFormAccessories([
                      ...formAccessories,
                      { category: "Trims", itemName: "New Trim", consPerPc: 1, ratePKR: 0, totalCostPKR: 0 },
                    ])
                  }
                >
                  <Plus className="mr-1.5 size-3.5" /> Add Accessory Row
                </Button>
              </TabsContent>

              {/* CHEMICAL & SPECIAL CHARGES TAB */}
              <TabsContent value="charges" className="m-0 space-y-6">
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Chemical / Wash Costs</h3>
                  <div className="rounded-lg border">
                    <Table>
                      <TableHeader className="bg-muted/40">
                        <TableRow>
                          <TableHead>Wash Item Name</TableHead>
                          <TableHead className="w-24">Cons. / Pc</TableHead>
                          <TableHead className="w-28">Rate (PKR)</TableHead>
                          <TableHead className="w-32">Total (PKR)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {formChemicals.map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="p-2">
                              <Input
                                value={item.washItem}
                                onChange={(e) => {
                                  const nextChem = [...formChemicals];
                                  nextChem[idx].washItem = e.target.value;
                                  setFormChemicals(nextChem);
                                }}
                              />
                            </TableCell>
                            <TableCell className="p-2">
                              <Input
                                type="number"
                                step="0.01"
                                value={item.consPerPc || ""}
                                onChange={(e) => {
                                  const cons = Number(e.target.value);
                                  const nextChem = [...formChemicals];
                                  nextChem[idx].consPerPc = cons;
                                  nextChem[idx].totalCostPKR = cons * nextChem[idx].ratePKR;
                                  setFormChemicals(nextChem);
                                }}
                              />
                            </TableCell>
                            <TableCell className="p-2">
                              <Input
                                type="number"
                                value={item.ratePKR || ""}
                                onChange={(e) => {
                                  const rate = Number(e.target.value);
                                  const nextChem = [...formChemicals];
                                  nextChem[idx].ratePKR = rate;
                                  nextChem[idx].totalCostPKR = nextChem[idx].consPerPc * rate;
                                  setFormChemicals(nextChem);
                                }}
                              />
                            </TableCell>
                            <TableCell className="p-2 align-middle font-medium text-right pr-4">
                              Rs. {item.totalCostPKR.toFixed(1)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Special Charges (Embroidery, Print, Testing, etc.)</h3>
                  <div className="rounded-lg border">
                    <Table>
                      <TableHeader className="bg-muted/40">
                        <TableRow>
                          <TableHead>Charge Category</TableHead>
                          <TableHead className="w-24">Cons. / Pc</TableHead>
                          <TableHead className="w-28">Rate (PKR)</TableHead>
                          <TableHead className="w-32">Total (PKR)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {formSpecialCharges.map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="p-2 font-medium text-sm text-foreground">
                              {item.itemName}
                            </TableCell>
                            <TableCell className="p-2">
                              <Input
                                type="number"
                                step="0.01"
                                value={item.consPerPc || ""}
                                onChange={(e) => {
                                  const cons = Number(e.target.value);
                                  const nextChg = [...formSpecialCharges];
                                  nextChg[idx].consPerPc = cons;
                                  nextChg[idx].totalCostPKR = cons * nextChg[idx].ratePKR;
                                  setFormSpecialCharges(nextChg);
                                }}
                              />
                            </TableCell>
                            <TableCell className="p-2">
                              <Input
                                type="number"
                                value={item.ratePKR || ""}
                                onChange={(e) => {
                                  const rate = Number(e.target.value);
                                  const nextChg = [...formSpecialCharges];
                                  nextChg[idx].ratePKR = rate;
                                  nextChg[idx].totalCostPKR = nextChg[idx].consPerPc * rate;
                                  setFormSpecialCharges(nextChg);
                                }}
                              />
                            </TableCell>
                            <TableCell className="p-2 align-middle font-medium text-right pr-4">
                              Rs. {item.totalCostPKR.toFixed(1)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </TabsContent>
            </div>

            <div className="px-6 py-4 border-t bg-muted/20 flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave}>Save Style</Button>
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
