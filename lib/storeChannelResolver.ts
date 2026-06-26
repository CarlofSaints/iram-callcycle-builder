/**
 * Resolve a schedule store's CHANNEL from the store control file.
 *
 * Perigee allows the SAME site code in more than one channel (a code is only
 * unique *within* a channel). For our clients this happens between BEX and
 * Dis-Chem — e.g. "S074" and "S119" exist in both. A plain `code → channel`
 * Map therefore loses information: whichever row is inserted last wins, so the
 * call cycle gets built against the wrong store.
 *
 * Site code stays the primary lookup. When (and only when) a code is shared
 * across channels, we fall back to the store NAME to decide which channel it
 * belongs to — the name reliably carries the channel ("DIS-CHEM ALBEMARLE
 * GARDENS - S074", "BEX CARNIVAL MALL S119").
 */
import { StoreControlEntry } from './types';

export interface StoreLike {
  storeCode: string;
  storeName: string;
  channel: string;
  active?: boolean;
}

export interface StoreChannelResolver {
  /** Channel for a store, disambiguating duplicate codes by store name. '' if the code is unknown. */
  resolve(storeCode: string, storeName: string): string;
  /** True when this code exists under more than one channel in the control file. */
  isAmbiguous(storeCode: string): boolean;
}

/** Uppercase, fold dashes/punctuation to spaces, collapse whitespace. */
function normalizeName(s: string): string {
  return (s || '')
    .toUpperCase()
    .replace(/ /g, ' ')
    .replace(/[–—]/g, '-')
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

/**
 * Separator-insensitive form: uppercase with ALL non-alphanumerics removed.
 * Makes "DIS-CHEM", "DIS CHEM" and "DISCHEM" all compare equal ("DISCHEM").
 */
function squish(s: string): string {
  return (s || '').toUpperCase().replace(/[^A-Z0-9]+/g, '');
}

export function buildStoreChannelResolver(stores: StoreLike[]): StoreChannelResolver {
  const byCode = new Map<string, StoreLike[]>();
  for (const s of stores) {
    const code = (s.storeCode || '').trim().toUpperCase();
    if (!code) continue;
    const list = byCode.get(code);
    if (list) list.push(s);
    else byCode.set(code, [s]);
  }

  function isAmbiguous(storeCode: string): boolean {
    const list = byCode.get((storeCode || '').trim().toUpperCase());
    if (!list || list.length < 2) return false;
    const channels = new Set(
      list.map(s => (s.channel || '').trim().toUpperCase()).filter(Boolean),
    );
    return channels.size > 1;
  }

  function resolve(storeCode: string, storeName: string): string {
    const code = (storeCode || '').trim().toUpperCase();
    const list = byCode.get(code);
    if (!list || list.length === 0) return '';
    if (list.length === 1) return list[0].channel;

    // Duplicate code — disambiguate by the schedule store name.
    const target = normalizeName(storeName);
    const targetSquished = squish(storeName);
    if (target) {
      // 1. Exact store-name match, separator-insensitive (most specific).
      const exact = list.find(s => squish(s.storeName) === targetSquished);
      if (exact) return exact.channel;

      // 2. Channel keyword present in the store name (e.g. "DIS-CHEM"/"DISCHEM",
      //    "BEX"). Separator-insensitive so "DISCHEM" matches "DIS-CHEM ...".
      const byKeyword = list.find(s => {
        const ch = squish(s.channel);
        return ch && targetSquished.includes(ch);
      });
      if (byKeyword) return byKeyword.channel;

      // 3. Best token overlap between control name and schedule name.
      const targetTokens = new Set(target.split(' ').filter(Boolean));
      let best: StoreLike | null = null;
      let bestScore = 0;
      for (const s of list) {
        const tokens = normalizeName(s.storeName).split(' ').filter(Boolean);
        let score = 0;
        for (const t of tokens) if (targetTokens.has(t)) score++;
        if (score > bestScore) { bestScore = score; best = s; }
      }
      if (best && bestScore > 0) return best.channel;
    }

    // 4. Could not disambiguate — prefer an active entry, else the first.
    const active = list.find(s => s.active !== false);
    return (active ?? list[0]).channel;
  }

  return { resolve, isAmbiguous };
}

/** Convenience builder straight from control-file entries. */
export function resolverFromControl(stores: StoreControlEntry[]): StoreChannelResolver {
  return buildStoreChannelResolver(stores);
}
