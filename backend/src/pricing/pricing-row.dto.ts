// /backend/src/pricing/dto/pricing-row.dto.ts

export class PricingRowDto {
  id!: string;
  yachtId!: string;
  yachtName!: string;
  weekStart!: string;

  basePrice!: number;
  top1?: number | null;
  top3?: number | null;
  mlReco?: number | null;
  discountPct?: number | null;
  finalPrice?: number | null;
  status!: string;

  // Новые поля
  actualPrice?: number | null;
  actualDiscountPct?: number | null;
  priceSource?: string | null;
  priceFetchedAt?: string | null;
  maxDiscountPct?: number | null;

  // Permissions
  canSubmit?: boolean;
  canApproveOrReject?: boolean;
}
