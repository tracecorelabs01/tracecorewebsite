// Excluded terms: wording the store never publishes, anywhere (product copy, categories, guides, FAQ, metadata,
// alt text, JSON-LD, llms.txt). The products are FPGA/PCIe development and memory-forensics hardware, video
// overlay and capture devices, and USB input passthrough devices; nothing is written, targeted or linked that
// frames them as cheating, anti-cheat evasion, identity spoofing or device control.
//
// Admin saves turn a match into a field error. Generators (JSON-LD, llms.txt, feeds) drop the string and log it
// with guarded(), never throw, so one bad row can't fail a prerender. No server-only import: forms use it too.
// Self-check: npx tsx scripts/self-check.ts

// Case-insensitive unless marked. Word boundaries keep ESP32, espresso, RDNA and "240 VAC" clean.
const BLOCKED: RegExp[] = [
  // Cheats and cheat features
  /cheat\w*/gi, // cheat, cheats, cheating, cheat sheet, anti-cheat, anticheat
  /aim-?bots?\b/gi,
  /trigger-?bots?\b/gi,
  /wall-?hacks?\b/gi,
  /\b(?:radar|map|speed)[ -]?hacks?\b/gi,
  /\bhacks?\b/gi,
  /\baim(?:ing)?[ -](?:device|assist\w*|lock|key|bot)s?\b/gi,
  /\bsilent aim\b/gi,
  /\b(?:no|anti)[ -]?recoil\b/gi,
  /\brecoil (?:control|script|macro)s?\b/gi,
  /\besps?\b(?!-?(?:\d|idf))/gi, // the overlay feature; ESP32, ESP8266 and ESP-IDF are microcontroller names
  // Anti-cheat systems
  /\beac\b/gi,
  /\bbattl?eye\b/gi,
  /\bvanguard\b/gi,
  /\bvgk\b/gi,
  /\bfaceit\b/gi,
  /(?<![\d.]\s?)\bVAC\b/g, // capitals only, and not a voltage ("100-240 VAC")
  /\bricochet\b/gi,
  /\bACE\b/g, // capitals only
  /\bjavelin\b/gi,
  // Evading detection, spoofing, identity changes, emulation
  /undetect\w*/gi,
  /\b(?:avoid\w*|evad\w*|evasion of|escap\w*|prevent\w*|beat\w*) detection\b/gi,
  /\bno longer (?:be )?detected\b/gi,
  /\bbypass\w*/gi,
  /spoof\w*/gi,
  /\bevad(?:e|es|ed|ing)\b/gi,
  /\bevasion\b/gi,
  /\bdisguis\w*/gi,
  /\bemulat\w*/gi,
  /\bhwid\b/gi,
  /\b(?:chang\w*|edit\w*|modif\w*|rewrit\w*|clon\w*|customi[sz]\w*)\s+(?:the\s+|its\s+|your\s+|a\s+)?(?:edid|serial(?: number)?s?|device ids?|hardware ids?|vendor ids?|product ids?|monitor (?:models?|names?|serials?))\b/gi,
  /\b(?:display|device|hardware|monitor) id(?:entity)? customi[sz]ation\b/gi,
  /\bedid (?:serials?|injection|spoof\w*|clon\w*|edit\w*|chang\w*|modif\w*)\b/gi,
  /\bdna\b/gi, // FPGA "device DNA" identity
  /\bdna_\w+/gi, // DNA_PORT and similar primitives
  // Firmware
  /\b(?:custom|tiered|private|paid|premium|emulated|leaked|cracked|1:1) firmwares?\b/gi,
  /\bfirmware (?:customi[sz]ation|modifications?|mods?)\b/gi,
  /\bflash(?:es|ed|ing)?\s+(?:a\s+|the\s+|your\s+|new\s+|custom\s+)?firmwares?\b/gi,
  /\bfirmware\s+flash\w*/gi,
  // Device control (input devices are covered for passthrough only)
  /\bkm-?box\w*/gi,
  /\b(?:control|mouse|move|input) commands?\b/gi,
  /\b(?:command|control) apis?\b/gi,
  // Steps that switch off platform protections (describing them from the defender's side is fine)
  /\b(?:disabl\w*|turn(?:s|ed|ing)? off|switch(?:es|ed|ing)? off|deactivat\w*)\s+(?:the\s+|your\s+)?(?:vt-?d|iommu|amd-vi|smmu|memory integrity|core isolation|hvci|vbs|virtuali[sz]ation-based security|secure boot|kernel dma protection|dma protection)\b/gi,
  // Game titles: next to this hardware they read as cheating
  /\b(?:valorant|fortnite|apex legends|warzone|call of duty|tarkov|pubg|counter-strike|cs:?go|cs2|overwatch|rainbow six|battlefield|arc raiders|marvel rivals|delta force|league of legends|dota|fivem|gta online)\b/gi,
  // Presenting product families as one set
  /\bcomplete (?:dma |gaming )?setups?\b/gi,
];

/**
 * The owner-approved scope statement says what this website does not sell, so its exact clause is allowed
 * (shortened forms of the statement keep this clause; anything broader is still caught).
 */
const APPROVED = /no game cheats, cheat software or anti-cheat bypass tools are sold on this website/gi;

/** Excluded terms found in `text`, as written there (each once). Empty when the text is clean. */
export function findBlocked(text: string): string[] {
  const scan = text.replace(/\s+/g, " ").replace(APPROVED, " ");
  const found = new Map<string, string>();
  for (const pattern of BLOCKED) {
    for (const m of scan.matchAll(pattern)) {
      const term = m[0].trim();
      if (!found.has(term.toLowerCase())) found.set(term.toLowerCase(), term);
    }
  }
  return [...found.values()];
}

/** For generators: the text when it's clean; otherwise undefined, with the reason logged (never throws). */
export function guarded(text: string | null | undefined, where: string): string | undefined {
  if (!text) return undefined;
  const blocked = findBlocked(text);
  if (!blocked.length) return text;
  console.error(`[content-guard] dropped ${where}: contains ${blocked.map((t) => `"${t}"`).join(", ")}`);
  return undefined;
}

/** Literal dollar amounts ("$149", "$1,299.00"). Guides use {{price:<slug>}} and shipping copy uses the settings tokens. */
export function findLiteralPrices(text: string): string[] {
  return [...new Set(text.match(/\$\s?\d[\d,]*(?:\.\d+)?/g) ?? [])];
}
