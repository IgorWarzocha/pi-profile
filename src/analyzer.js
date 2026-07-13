const PATTERNS = {
  courtesy: {
    please: /\b(?:please|pls|plz|kindly)\b/gi,
    thanks: /\b(?:thanks?|thank\s+you|thank\s+ya|thx|ty|ta)\b/gi,
    appreciation: /\b(?:appreciat(?:e|ed|ing)|grateful|much\s+obliged|means\s+a\s+lot)\b/gi,
    apology: /\b(?:sorry|apolog(?:y|ies|ise|ize|ised|ized)|excuse\s+me|pardon\s+me|my\s+(?:bad|mistake))\b/gi,
    softRequest: /\b(?:could\s+you|would\s+you|would\s+you\s+mind|if\s+possible|when\s+you\s+can|do\s+you\s+mind)\b/gi,
    warmth: /\b(?:cheers|no\s+worries|all\s+good|lovely|mate|pal)\b/gi,
  },
  collaboration: {
    affirmation: /\b(?:nice|great|excellent|perfect|brilliant|spot\s+on|exactly|good\s+(?:job|work|catch)|well\s+done|you(?:'|’)re\s+right)\b/gi,
    context: /\b(?:for\s+context|the\s+goal\s+is|what\s+i(?:'|’)m\s+after|the\s+point\s+is|to\s+clarify|more\s+specifically)\b/gi,
    delegation: /\b(?:go\s+ahead|crack\s+on|take\s+a\s+look|have\s+a\s+look|carry\s+on|run\s+with\s+it|use\s+your\s+judgment)\b/gi,
    review: /\b(?:double[- ]check|verify|review\s+(?:it|this|that)|test\s+(?:it|this|that)|make\s+sure|have\s+another\s+look)\b/gi,
    repair: /\b(?:i\s+was\s+wrong|i\s+forgot|let\s+me\s+rethink|i\s+misunderstood|that\s+makes\s+sense|fair\s+enough|you\s+were\s+right)\b/gi,
    greeting: /\b(?:hey|hiya|hello|morning|afternoon|evening|alrighty)\b/gi,
  },
  friction: {
    correction: /\b(?:no[,.! ]+(?:that|this|you|i|we)|wrong|that(?:'|’)s\s+not|not\s+what\s+i|you\s+(?:didn(?:'|’)t|haven(?:'|’)t|never)|do\s+it\s+again|start\s+again|stop\s+(?:doing|adding|trying))\b/gi,
    stuck: /\b(?:i(?:'|’)m\s+stuck|i(?:'|’)m\s+confused|this\s+makes\s+no\s+sense|why\s+is\s+this\s+happening|what\s+the\s+hell)\b/gi,
    urgency: /\b(?:just\s+do\s+it|right\s+now|immediately|asap|for\s+the\s+last\s+time)\b/gi,
    profanity: /\b(?:f+u+c+k+(?:ing|ed|er|s|up|off|wit|tard|face|head)?|motherf+u+c+k+(?:er|ing)?|clusterf+u+c+k+|fukc(?:ing|ed|er)?|fcuk(?:ing|ed)?|sh+i+t+(?:ty|ting|ted|s|show|head|hole|face|stain|bag)?|bullsh+i+t+|horsesh+i+t+|dipsh+i+t+|hsit|siht|shti|ass(?:es|hole|holes|hat|wipe)?|jackass|dumbass|badass|damn(?:ed|it)?|dammit|goddamn(?:it)?|bitch(?:es|ing|y|ass)?|bastards?|piss(?:ed|ing|off)?|dick(?:head)?|crap(?:py|ping)?|hell|wtf|stfu|lmao|lmfao|cunts?)\b/gi,
  },
};

export function analyzeText(input) {
  const text = stripCode(input);
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
  for (const [family, entries] of Object.entries(counts ?? {})) {
    total[family] ??= {};
    for (const [name, count] of Object.entries(entries)) total[family][name] = (total[family][name] ?? 0) + count;
  }
  return total;
}

export function totalSignals(group = {}) {
  return Object.values(group).reduce((sum, value) => sum + Number(value || 0), 0);
}

function stripCode(text) {
  return String(text ?? "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`\n]+`/g, " ")
    .replace(/<tool_result>[\s\S]*?<\/tool_result>/gi, " ");
}
