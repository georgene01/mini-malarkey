import leoProfanity from 'leo-profanity'

/* ─────────────────────────────────────────────────────────────
   Dictionary setup
───────────────────────────────────────────────────────────── */

leoProfanity.loadDictionary()

// South African slurs, Afrikaans offensive terms, and hateful words
// that slip past the English-only default dictionary.
const saAndExtraBanned = [
  // Racial slurs against Black South Africans
  'kaffir', 'kaffer', 'kafir', 'kafr', 'kaffa', 'kaf',
  'kaffirboetie', 'kafferboetie',
  // Slurs for Khoikhoi / Coloured people
  'hotnot', 'hottentot', 'hotnotsgod',
  // Slurs against San / Bushmen
  'boesman', 'boesmann', 'boeskop',
  // Slurs against Indian South Africans
  'koeli', 'koelie', 'coolie',
  // Slurs against women
  'meid', 'meide',
  // Afrikaans insults
  'poes', 'naaier', 'naai', 'fok', 'fokker', 'fokoff',
  'doos', 'dooskop', 'bliksem', 'moer', 'moerse',
  'jouma', 'joumase', 'soutpiel', 'hardepiel', 'piel',
  'pielkop', 'teef',
  // English slurs sometimes missed by leo-profanity
  'retard', 'retarded', 'nigger', 'nigga', 'niglet',
  'chink', 'gook', 'wetback', 'beaner', 'spic',
  'faggot', 'fag', 'dyke', 'tranny',
  'kike', 'heeb',
  'coon', 'junglebunny',
  'paki', 'towelhead', 'raghead',
  'kys', 'kms',
  // Authority / system words to reserve
  'admin', 'administrator', 'moderator', 'support',
  'owner', 'staff', 'root', 'sysop', 'official',
  // Hateful
  'nazi', 'nazis', 'hitler', 'fuhrer', 'fuehrer',
  'racist', 'sexist', 'bigot',
  'slut', 'whore', 'hooker', 'prostitute',
  'rapist', 'pedophile', 'paedo', 'paedophile',
]

const existing = new Set(leoProfanity.list())
for (const w of saAndExtraBanned) {
  if (!existing.has(w)) leoProfanity.add(w)
}

/* ─────────────────────────────────────────────────────────────
   Normalisation — defeats leetspeak, separators, repeats, homoglyphs
───────────────────────────────────────────────────────────── */

const HOMOGLYPH: Record<string, string> = {
  'а': 'a', 'е': 'e', 'і': 'i', 'о': 'o', 'р': 'p', 'с': 'c',
  'у': 'y', 'х': 'x', 'ѕ': 's', 'ԁ': 'd', 'ƅ': 'b',
  'α': 'a', 'β': 'b', 'ε': 'e', 'ι': 'i', 'κ': 'k', 'ο': 'o',
  'ρ': 'p', 'τ': 't', 'υ': 'u', 'χ': 'x',
  'ℯ': 'e', '𝒶': 'a', '𝒷': 'b', '𝒸': 'c', '𝒹': 'd',
}

function stripHomoglyphs(s: string) {
  let out = ''
  for (const ch of s) out += HOMOGLYPH[ch] ?? ch
  return out.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export function normalizeUsername(input: string) {
  return stripHomoglyphs(input)
    .toLowerCase()
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/!/g, 'i')
    .replace(/\|/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/@/g, 'a')
    .replace(/5/g, 's')
    .replace(/\$/g, 's')
    .replace(/7/g, 't')
    .replace(/\+/g, 't')
    .replace(/8/g, 'b')
    .replace(/9/g, 'g')
    .replace(/6/g, 'g')
    .replace(/2/g, 'z')
    .replace(/[\s._\-*]/g, '')
    .replace(/(.)\1{2,}/g, '$1')
    .replace(/[^a-z0-9]/g, '')
}

/* ─────────────────────────────────────────────────────────────
   Public checks
───────────────────────────────────────────────────────────── */

export function isUsernameProfane(username: string): boolean {
  const normalized = normalizeUsername(username)
  if (!normalized) return false

  if (leoProfanity.check(normalized)) return true

  for (const word of saAndExtraBanned) {
    const clean = word.replace(/[^a-z0-9]/g, '')
    if (clean.length >= 3 && normalized.includes(clean)) return true
  }

  for (const word of leoProfanity.list()) {
    if (word.length >= 4 && normalized.includes(word)) return true
  }

  return false
}

export function validateUsername(raw: string): string | null {
  const name = raw.trim().toLowerCase()
  if (!name) return 'Please enter a username'
  if (name.length < 3) return 'Username must be at least 3 characters'
  if (name.length > 20) return 'Username must be 20 characters or fewer'
  if (!/^[a-z0-9._]+$/.test(name))
    return 'Only lowercase letters, numbers, dots and underscores allowed'
  if (isUsernameProfane(name))
    return 'That username is not allowed. Please choose another.'
  return null
}
