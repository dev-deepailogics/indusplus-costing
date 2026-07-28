import { collection, doc, getDocs, onSnapshot, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { StyleMasterItem } from "./types";

const COLLECTION = "styles_master";

export const SEED_STYLES: StyleMasterItem[] = [
  {
    id: "STY-001",
    styleName: "TR 298 VITA",
    customerName: "Duer",
    styleCategory: "Top Ware",
    orderType: "Denim",
    washType: "Rinse",
    orderQuantity: 219,
    sizeBracket: "<=500",
    smvSewing: 28.47,
    targetEfficiency: 0.47,
    rejectionPct: 0.0415,
    baseSellingPrice: 22.9,
    bomFabric: [
      {
        itemName: "FVG0562 Black IAF-3605",
        consumptionPerPc: 1.35,
        rateUSD: 3.654676,
        ratePKR: 1016,
        fabricCostPKR: 1371.6,
      },
    ],
    bomLining: [
      {
        itemName: "IAF-34663 65:35 PC",
        consumptionPerPc: 0.1,
        rateUSD: 0.773381,
        ratePKR: 215,
        liningCostPKR: 21.5,
      },
    ],
    bomAccessories: [
      {
        category: "Zipper",
        itemName: "Zipper (YKK)",
        consPerPc: 1,
        ratePKR: 2280,
        totalCostPKR: 2280,
      },
      {
        category: "Thread",
        itemName: "Sewing Thread",
        consPerPc: 1,
        ratePKR: 0,
        totalCostPKR: 0,
      },
      {
        category: "Label",
        itemName: "Main Label",
        consPerPc: 1,
        ratePKR: 0,
        totalCostPKR: 0,
      },
      {
        category: "Trims",
        itemName: "Trims Mix Materials",
        consPerPc: 1,
        ratePKR: 0,
        totalCostPKR: 0,
      },
      {
        category: "Poly Bag",
        itemName: "Poly Bag",
        consPerPc: 1,
        ratePKR: 0,
        totalCostPKR: 0,
      },
      {
        category: "Carton",
        itemName: "Carton",
        consPerPc: 1,
        ratePKR: 0,
        totalCostPKR: 0,
      },
    ],
    bomChemicals: [
      {
        washItem: "Rinse Wash Chemicals",
        consPerPc: 1,
        ratePKR: 25,
        totalCostPKR: 25,
      },
    ],
    bomSpecialCharges: [
      {
        itemName: "Embroidery",
        consPerPc: 1,
        ratePKR: 0,
        totalCostPKR: 0,
      },
      {
        itemName: "Printing",
        consPerPc: 1,
        ratePKR: 0,
        totalCostPKR: 0,
      },
      {
        itemName: "Testing",
        consPerPc: 1,
        ratePKR: 0,
        totalCostPKR: 0,
      },
      {
        itemName: "Inspection",
        consPerPc: 1,
        ratePKR: 0,
        totalCostPKR: 0,
      },
    ],
  },
];

async function ensureSeeded() {
  const ref = collection(db, COLLECTION);
  const snap = await getDocs(ref);
  if (snap.empty) {
    for (const style of SEED_STYLES) {
      await setDoc(doc(ref, style.id), style);
    }
  }
}

export function subscribeToStyles(onData: (styles: StyleMasterItem[]) => void): () => void {
  const ref = collection(db, COLLECTION);
  let unsub = () => {};
  ensureSeeded().finally(() => {
    unsub = onSnapshot(ref, (snap) => {
      const styles: StyleMasterItem[] = [];
      snap.forEach((docSnap) => {
        const docData = docSnap.data();
        styles.push({
          ...docData,
          id: docSnap.id,
        } as StyleMasterItem);
      });
      onData(styles);
    });
  });
  return () => unsub();
}

export async function saveStyle(style: StyleMasterItem): Promise<void> {
  const ref = doc(db, COLLECTION, style.id);
  await setDoc(ref, style);
}

export async function deleteStyle(id: string): Promise<void> {
  const ref = doc(db, COLLECTION, id);
  await deleteDoc(ref);
}
