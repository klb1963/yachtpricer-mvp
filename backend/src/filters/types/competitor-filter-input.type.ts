import { $Enums } from '@prisma/client';

export type CompetitorFilterInput = {
  scope?: $Enums.FilterScope; // 'USER' | 'ORG'

  // M2M selectors
  locationIds?: string[];
  categoryIds?: Array<string | number>;
  builderIds?: Array<string | number>;
  modelIds?: Array<string | number>;
  regionIds?: Array<string | number>;
  countryCodes?: string[];

  // numeric settings
  lenFtMinus?: number;
  lenFtPlus?: number;
  yearMinus?: number;
  yearPlus?: number;
  peopleMinus?: number;
  peoplePlus?: number;
  cabinsMinus?: number;
  cabinsPlus?: number;
  headsMin?: number;
};
