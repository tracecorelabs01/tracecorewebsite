// Regions on the /shipping page. Each lists its countries by ISO code (names come from src/lib/countries.ts, and
// countries excluded in Settings are left out). Notes stay general on purpose: duty and VAT rules change, so the page
// says who charges what, not rates or thresholds.

export interface ShippingRegion {
  id: string;
  name: string;
  codes: string[];
  /** Import taxes and duties: who charges them and when. */
  taxes: string;
}

export const SHIPPING_REGIONS: ShippingRegion[] = [
  {
    id: "north-america",
    name: "United States and Canada",
    codes: ["US", "CA"],
    taxes: "Import duties, sales taxes and courier brokerage fees, where they apply, are set by US and Canadian customs and are paid by the buyer on delivery.",
  },
  {
    id: "united-kingdom",
    name: "United Kingdom",
    codes: ["GB", "GG", "JE", "IM", "GI"],
    taxes: "Import VAT and any customs duty or courier handling fee are set by HMRC and are paid by the buyer on delivery.",
  },
  {
    id: "european-union",
    name: "European Union",
    codes: ["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE"],
    taxes: "Every parcel imported into the EU is subject to import VAT at your country's rate, and customs duty can also apply. These and any courier handling fee are paid by the buyer on delivery.",
  },
  {
    id: "rest-of-europe",
    name: "Rest of Europe",
    codes: ["CH", "LI", "NO", "IS", "AD", "MC", "SM", "VA", "FO", "AX", "SJ", "AL", "BA", "ME", "MK", "RS", "MD", "UA", "GE", "AM", "AZ"],
    taxes: "Countries outside the EU, such as Switzerland and Norway, charge their own import VAT and duties, paid by the buyer on delivery.",
  },
  {
    id: "gulf",
    name: "Gulf states (GCC)",
    codes: ["AE", "SA", "QA", "KW", "BH", "OM"],
    taxes: "Each GCC state applies its own VAT and customs duty above its duty-free threshold. Any charges are collected by customs or the courier and paid by the buyer on delivery.",
  },
  {
    id: "middle-east",
    name: "Middle East and North Africa",
    codes: ["TR", "IL", "PS", "JO", "LB", "IQ", "EG", "LY", "TN", "DZ", "MA", "EH", "YE", "IR", "SY"],
    taxes: "Import duties and taxes follow each country's rules and are paid by the buyer on delivery. Some countries need extra customs paperwork, which can add a few days.",
  },
  {
    id: "oceania",
    name: "Australia, New Zealand and the Pacific",
    codes: ["AU", "NZ", "FJ", "PG", "NC", "PF", "WS", "TO", "VU", "SB", "KI", "FM", "MH", "PW", "NR", "TV", "CK", "NU", "NF", "CX", "CC", "GU", "MP", "AS", "WF", "PN", "TK"],
    taxes: "GST and any duty are charged by the destination country's customs where they apply, and paid by the buyer.",
  },
  {
    id: "asia",
    name: "Asia",
    codes: ["IN", "PK", "BD", "LK", "NP", "BT", "MV", "AF", "SG", "MY", "TH", "VN", "PH", "ID", "KH", "LA", "MM", "BN", "TL", "JP", "KR", "KP", "CN", "HK", "MO", "TW", "MN", "KZ", "UZ", "KG", "TJ", "TM", "RU", "BY"],
    taxes: "Import duties and taxes follow each country's rules and are paid by the buyer on delivery.",
  },
  {
    id: "latin-america",
    name: "Latin America and the Caribbean",
    codes: [
      "MX", "GT", "BZ", "SV", "HN", "NI", "CR", "PA", "CO", "VE", "EC", "PE", "BO", "BR", "PY", "UY", "AR", "CL", "GY", "SR", "GF", "FK",
      "CU", "JM", "HT", "DO", "PR", "BS", "BB", "TT", "AG", "DM", "GD", "KN", "LC", "VC", "AI", "AW", "BQ", "CW", "SX", "BL", "MF", "GP", "MQ", "KY", "TC", "VG", "VI", "MS", "BM", "PM", "GL",
    ],
    taxes: "Import duties and taxes follow each country's rules and are paid by the buyer on delivery. Some countries hold parcels for longer customs checks.",
  },
  {
    id: "africa",
    name: "Sub-Saharan Africa",
    codes: [
      "ZA", "NG", "KE", "GH", "ET", "TZ", "UG", "RW", "BI", "SO", "DJ", "ER", "SD", "SS", "CM", "CI", "SN", "ML", "BF", "NE", "TD", "CF", "CG", "CD", "GA", "GQ", "ST", "AO", "ZM", "ZW", "MW", "MZ", "BW", "NA", "LS", "SZ", "MG", "MU", "SC", "KM", "RE", "YT", "CV", "GM", "GN", "GW", "SL", "LR", "TG", "BJ", "MR", "SH",
    ],
    taxes: "Import duties and taxes follow each country's rules and are paid by the buyer on delivery.",
  },
];
