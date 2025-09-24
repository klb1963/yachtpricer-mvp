// /backend/src/pricing/dto/pricing-row.dto.ts

export type PriceSource = 'INTERNAL' | 'NAUSYS' | 'BOOKING_MANAGER' | 'OTHER';

export type PricingRowDto = {
  yachtId: string;
  name: string;
  basePrice: number; // примитив
  snapshot: null | {
    top1Price: number;
    top3Avg: number;
    currency: string;
    sampleSize: number;
    collectedAt: string; // ISO
  };
  decision: null | {
    discountPct: number | null;
    finalPrice: number | null;
    status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  };

  // новые поля
  actualPrice: number | null;
  actualDiscountPct: number | null;
  priceSource: PriceSource | null;
  priceFetchedAt: string | null;
  maxDiscountPct: number | null;

  lastComment: string | null;
  lastActionAt: string | null;

  mlReco: number | null;
  finalPrice: number | null;

  perms: {
    canEditDraft: boolean;
    canSubmit: boolean;
    canApproveOrReject: boolean;
  };
};
