"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  StyleMasterItem,
  StyleFormMeta,
  BOMFabricItem,
  BOMLiningItem,
  BOMAccessoriesItem,
  BOMChemicalsItem,
  BOMSpecialChargesItem,
} from "../types";
import { StyleMetaTab } from "./StyleMetaTab";
import { StyleFabricTab } from "./StyleFabricTab";
import { StyleLiningTab } from "./StyleLiningTab";
import { StyleAccessoriesTab } from "./StyleAccessoriesTab";
import { StyleChargesTab } from "./StyleChargesTab";

interface StyleMasterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingStyle: StyleMasterItem | null;
  exchangeRate: number;
  formMeta: StyleFormMeta;
  onFormMetaChange: (meta: StyleFormMeta) => void;
  formFabric: BOMFabricItem[];
  onFormFabricChange: (fabric: BOMFabricItem[]) => void;
  formLining: BOMLiningItem[];
  onFormLiningChange: (lining: BOMLiningItem[]) => void;
  formAccessories: BOMAccessoriesItem[];
  onFormAccessoriesChange: (accessories: BOMAccessoriesItem[]) => void;
  formChemicals: BOMChemicalsItem[];
  onFormChemicalsChange: (chemicals: BOMChemicalsItem[]) => void;
  formSpecialCharges: BOMSpecialChargesItem[];
  onFormSpecialChargesChange: (charges: BOMSpecialChargesItem[]) => void;
  onSave: () => void;
}

export function StyleMasterDialog({
  open,
  onOpenChange,
  editingStyle,
  exchangeRate,
  formMeta,
  onFormMetaChange,
  formFabric,
  onFormFabricChange,
  formLining,
  onFormLiningChange,
  formAccessories,
  onFormAccessoriesChange,
  formChemicals,
  onFormChemicalsChange,
  formSpecialCharges,
  onFormSpecialChargesChange,
  onSave,
}: StyleMasterDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[85vh] w-full flex flex-col p-0">
        <DialogHeader className="px-6 pt-5 pb-2 border-b">
          <DialogTitle className="text-lg font-semibold flex items-center justify-between">
            <span>{editingStyle ? "Edit Apparel Style" : "Add New Apparel Style"}</span>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="meta" className="flex-1 overflow-hidden flex flex-col">
          <div className="px-6 border-b bg-muted/20">
            <TabsList variant="line" className="h-12 w-full justify-start gap-4 p-0">
              <TabsTrigger value="meta" className="px-1 py-3 text-sm font-semibold">
                General Meta
              </TabsTrigger>
              <TabsTrigger value="fabric" className="px-1 py-3 text-sm font-semibold">
                Fabric BOM
              </TabsTrigger>
              <TabsTrigger value="lining" className="px-1 py-3 text-sm font-semibold">
                Lining BOM
              </TabsTrigger>
              <TabsTrigger value="accessories" className="px-1 py-3 text-sm font-semibold">
                Accessories
              </TabsTrigger>
              <TabsTrigger value="charges" className="px-1 py-3 text-sm font-semibold">
                Chem &amp; Others
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            <TabsContent value="meta" className="m-0">
              <StyleMetaTab
                formMeta={formMeta}
                onFormMetaChange={onFormMetaChange}
                isEditing={editingStyle !== null}
              />
            </TabsContent>

            <TabsContent value="fabric" className="m-0">
              <StyleFabricTab
                formFabric={formFabric}
                onFormFabricChange={onFormFabricChange}
                exchangeRate={exchangeRate}
              />
            </TabsContent>

            <TabsContent value="lining" className="m-0">
              <StyleLiningTab
                formLining={formLining}
                onFormLiningChange={onFormLiningChange}
                exchangeRate={exchangeRate}
              />
            </TabsContent>

            <TabsContent value="accessories" className="m-0">
              <StyleAccessoriesTab
                formAccessories={formAccessories}
                onFormAccessoriesChange={onFormAccessoriesChange}
              />
            </TabsContent>

            <TabsContent value="charges" className="m-0">
              <StyleChargesTab
                formChemicals={formChemicals}
                onFormChemicalsChange={onFormChemicalsChange}
                formSpecialCharges={formSpecialCharges}
                onFormSpecialChargesChange={onFormSpecialChargesChange}
              />
            </TabsContent>
          </div>

          <div className="px-6 py-4 border-t bg-muted/20 flex gap-2 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={onSave}>Save Style</Button>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
