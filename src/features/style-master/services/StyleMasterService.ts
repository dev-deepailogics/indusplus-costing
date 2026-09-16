import { collection, doc, getDocs, onSnapshot, setDoc, deleteDoc } from "firebase/firestore";
import * as XLSX from "xlsx";
import { db } from "@/lib/firebase";
import { calculateSizeBracket as formulaCalculateSizeBracket } from "@/features/cost-sheet/services/CostSheetFormulaEngine";
import type {
  StyleMasterItem,
  BOMAccessoriesItem,
  BOMChemicalsItem,
  BOMSpecialChargesItem,
} from "../types";

const COLLECTION = "styles_master";

export class StyleMasterService {
  public static calculateSizeBracket(qty: number, availableBrackets?: string[]): string {
    return formulaCalculateSizeBracket(qty, availableBrackets);
  }

  public static mergeAccessories(existing: BOMAccessoriesItem[] | undefined): BOMAccessoriesItem[] {
    return existing ? [...existing] : [];
  }

  public static mergeChemicals(existing: BOMChemicalsItem[] | undefined): BOMChemicalsItem[] {
    return existing ? [...existing] : [];
  }

  public static mergeSpecialCharges(
    existing: BOMSpecialChargesItem[] | undefined
  ): BOMSpecialChargesItem[] {
    return existing ? [...existing] : [];
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
