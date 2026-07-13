const PATTERNS = {
  politeness: {
    please: /\b(?:please|pls|plz)\b/gi,
    thanks: /\b(?:thanks?|thank you|thx|ty)\b/gi,
    appreciation: /\b(?:appreciate|appreciated|grateful)\b/gi,
    apology: /\b(?:sorry|apologies|excuse me|my mistake|my bad)\b/gi,
    consideration: /\b(?:could you|can you|would you mind|if possible)\b/gi,
    reassurance: /\b(?:no worries|cheers)\b/gi
  },
  collaboration: {
    affirmation: /\b(?:nice|great|excellent|perfect|brilliant|good catch|exactly|you(?:'|’)re right)\b/gi,
    repair: /\b(?:i was wrong|i forgot|let me rethink|i misunderstood|that makes sense)\b/gi,
    greeting: /\b(?:hey|hi|hello|morning|afternoon|evening)\b/gi
  },
  frustration: {
    stuck: /\b(?:i(?:'|’)m stuck|i(?:'|’)m confused|this makes no sense|why is this happening)\b/gi,
    profanity: /\b(?:fuck(?:ing|ed|er|s)?|shit(?:ty|ting|s)?|wtf|damn(?:it|ed)?|hell|crap(?:py)?|asshole|bitch|cunt|piss(?:ed|ing)?)\b/gi
  }
};

export function analyzeText(text) {
  const counts = {};
  for (const [family, entries] of Object.entries(PATTERNS)) {
    counts[family] = {};
    for (const [name, pattern] of Object.entries(entries)) {
      pattern.lastIndex = 0;
      counts[family][name] = [...text.matchAll(pattern)].length;
    }
  }
  return counts;
}

export function addCounts(total, counts) {
  for (const [family, entries] of Object.entries(counts)) {
    total[family] ??= {};
    for (const [name, count] of Object.entries(entries)) total[family][name] = (total[family][name] ?? 0) + count;
  }
  return total;
}
