export interface BOMFabricItem {
  itemName: string;
  consumptionPerPc: number;
  rateUSD: number;
  ratePKR: number;
  fabricCostPKR: number;
}

export interface BOMLiningItem {
  itemName: string;
  consumptionPerPc: number;
  rateUSD: number;
  ratePKR: number;
  liningCostPKR: number;
}

export interface BOMAccessoriesItem {
  category: "Zipper" | "Thread" | "Label" | "Trims" | "Poly Bag" | "Carton" | "Button" | "Packing Mix" | "Sticker";
  itemName: string;
  consPerPc: number;
  ratePKR: number;
  totalCostPKR: number;
}

export interface BOMChemicalsItem {
  washItem: string;
  consPerPc: number;
  ratePKR: number;
  totalCostPKR: number;
}

export interface BOMSpecialChargesItem {
  itemName: string;
  consPerPc: number;
  ratePKR: number;
  totalCostPKR: number;
}

export interface StyleMasterItem {
  id: string; // Style_ID e.g. STY-001
  styleName: string;
  customerName: string;
  styleCategory: string;
  orderType: "Denim" | "Non Denim";
  washType: string;
  orderQuantity: number;
  sizeBracket: string; // Calculated
  smvSewing: number;
  targetEfficiency?: number;
  rejectionPct?: number;
  baseSellingPrice: number; // USD
  bomFabric: BOMFabricItem[];
  bomLining: BOMLiningItem[];
  bomAccessories: BOMAccessoriesItem[];
  bomChemicals: BOMChemicalsItem[];
  bomSpecialCharges: BOMSpecialChargesItem[];
}
