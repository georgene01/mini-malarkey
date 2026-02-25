import leoProfanity from 'leo-profanity'

leoProfanity.loadDictionary()

// You can extend dictionary later
// leoProfanity.add([...customWords])

export function normalizeUsername(input: string) {
  return input
    .toLowerCase()
    // leetspeak swaps
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/7/g, 't')
    .replace(/@/g, 'a')
    .replace(/\$/g, 's')

    // remove separators
    .replace(/[\s._-]/g, '')

    // collapse repeated letters (reeeetard → retard)
    .replace(/(.)\1{2,}/g, '$1')

    // remove non letters/numbers
    .replace(/[^a-z0-9]/g, '')
}

export function isUsernameProfane(username: string) {
  const normalized = normalizeUsername(username)

  return leoProfanity.check(normalized)
}