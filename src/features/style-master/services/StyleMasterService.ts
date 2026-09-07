import { collection, doc, getDocs, onSnapshot, setDoc, deleteDoc } from "firebase/firestore";
import * as XLSX from "xlsx";
import { db } from "@/lib/firebase";
import type {
  StyleMasterItem,
  BOMAccessoriesItem,
  BOMChemicalsItem,
  BOMSpecialChargesItem,
} from "../types";

const COLLECTION = "styles_master";

export const DEFAULT_ACCESSORIES_TEMPLATES = [
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

export const DEFAULT_CHEMICALS_TEMPLATES = [{ washItem: "Rinse" }];

export const DEFAULT_SPECIAL_TEMPLATES = [
  { itemName: "Embroidery" },
  { itemName: "Printing Charges" },
  { itemName: "Testing Charges" },
  { itemName: "Inspection Charges" },
];

export class StyleMasterService {
  public static calculateSizeBracket(qty: number): string {
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

  public static mergeAccessories(existing: BOMAccessoriesItem[] | undefined): BOMAccessoriesItem[] {
    const list = [...(existing || [])];
    DEFAULT_ACCESSORIES_TEMPLATES.forEach((tmpl) => {
      const hasCategory = list.some(
        (item) => item.category?.toLowerCase() === tmpl.category.toLowerCase()
      );
      if (!hasCategory) {
        list.push({
          category: tmpl.category,
          itemName: tmpl.itemName,
          consPerPc: 0,
          ratePKR: 0,
          totalCostPKR: 0,
        });
      }
    });
    return list;
  }

  public static mergeChemicals(existing: BOMChemicalsItem[] | undefined): BOMChemicalsItem[] {
    const list = [...(existing || [])];
    DEFAULT_CHEMICALS_TEMPLATES.forEach((tmpl) => {
      const hasItem = list.some(
        (item) => item.washItem?.toLowerCase() === tmpl.washItem.toLowerCase()
      );
      if (!hasItem) {
        list.push({
          washItem: tmpl.washItem,
          consPerPc: 0,
          ratePKR: 0,
          totalCostPKR: 0,
        });
      }
    });
    return list;
  }

  public static mergeSpecialCharges(
    existing: BOMSpecialChargesItem[] | undefined
  ): BOMSpecialChargesItem[] {
    const list = [...(existing || [])];
    DEFAULT_SPECIAL_TEMPLATES.forEach((tmpl) => {
      const hasItem = list.some(
        (item) =>
          item.itemName?.toLowerCase().replace(/\s+/g, "") ===
          tmpl.itemName.toLowerCase().replace(/\s+/g, "")
      );
      if (!hasItem) {
        list.push({
          itemName: tmpl.itemName,
          consPerPc: 0,
          ratePKR: 0,
          totalCostPKR: 0,
        });
      }
    });
    return list;
  }

  public static subscribe(
    onData: (styles: StyleMasterItem[]) => void,
    onError?: (error: Error) => void
  ): () => void {
    const ref = collection(db, COLLECTION);
    return onSnapshot(
      ref,
      (snap) => {
        const styles: StyleMasterItem[] = [];
        snap.forEach((docSnap) => {
          styles.push({ ...docSnap.data(), id: docSnap.id } as StyleMasterItem);
        });
        onData(styles);
      },
      (error) => {
        console.error("StyleMasterService subscription error:", error);
        onError?.(error);
      }
    );
  }

  public static async save(style: StyleMasterItem): Promise<void> {
    const cleanId = style.id.trim();
    if (!cleanId) {
      throw new Error("Style ID cannot be empty");
    }
    const ref = doc(db, COLLECTION, cleanId);
    await setDoc(ref, style);
  }

  public static async delete(id: string): Promise<void> {
    const ref = doc(db, COLLECTION, id);
    await deleteDoc(ref);
  }

  public static exportToExcel(styles: StyleMasterItem[]): void {
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
  }
}
