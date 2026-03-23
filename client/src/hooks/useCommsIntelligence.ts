import { useQuery } from "@tanstack/react-query";

// ─── Client-side Sentiment Analyser ────────────────────────────────────────

const POSITIVE_WORDS = new Set([
  "good","great","excellent","amazing","wonderful","fantastic","awesome","love","happy",
  "perfect","beautiful","brilliant","outstanding","superb","terrific","fabulous","incredible",
  "marvelous","splendid","delightful","pleasant","enjoyable","nice","fine","best","better",
  "improved","impressive","remarkable","exceptional","superior","favorable","positive",
  "optimistic","cheerful","glad","pleased","satisfied","grateful","thankful","excited",
  "thrilled","enthusiastic","passionate","inspired","motivated","confident","helpful","kind",
  "generous","friendly","warm","caring","supportive","encouraging","successful","accomplished",
  "achieved","progress","growth","advance","breakthrough","innovative","creative","elegant",
  "efficient","effective","productive","valuable","agree","yes","correct","right","true",
  "absolutely","definitely","certainly","welcome","thanks","appreciate","congratulations",
  "bravo","cheers","smooth","clean","clear","sharp","strong","solid","reliable","stable",
  "secure","fun","interesting","fascinating","engaging","captivating","compelling","calm",
  "peaceful","relaxed","comfortable","safe","trusted","loyal","honest","smart","clever",
  "genius","wise","insightful","thoughtful","considerate","lol","haha","cool","nice","ok",
]);

const NEGATIVE_WORDS = new Set([
  "bad","terrible","horrible","awful","dreadful","disgusting","hate","angry","sad","worst",
  "worse","poor","weak","pathetic","miserable","depressing","frustrating","annoying",
  "irritating","boring","tedious","ugly","stupid","dumb","idiotic","wrong","incorrect",
  "false","failure","failed","broken","damaged","ruined","useless","worthless","pointless",
  "meaningless","hopeless","helpless","desperate","confused","lost","stuck","trapped",
  "overwhelmed","stressed","anxious","worried","disappointed","upset","hurt","pain",
  "suffering","struggling","difficult","hard","impossible","never","nothing","nobody",
  "nowhere","cannot","refuse","reject","deny","decline","cancel","delete","remove",
  "destroy","crash","error","bug","problem","issue","trouble","concern","risk","danger",
  "threat","warning","slow","lag","delay","timeout","disconnect","offline","unavailable",
  "down","spam","scam","fake","fraud","malicious","suspicious","unsafe","insecure","rude",
  "mean","cruel","harsh","aggressive","hostile","toxic","abusive","fear","scared",
  "terrified","panic","nervous","uncomfortable","embarrassed","lonely","isolated",
  "abandoned","neglected","ignored","forgotten","excluded",
]);

const NEGATION_WORDS = new Set([
  "not","don't","doesn't","didn't","won't","wouldn't","can't","cannot","isn't","aren't",
  "wasn't","weren't","no","never","neither","nor","hardly","barely","scarcely",
]);

const AMPLIFIER_WORDS = new Set([
  "very","extremely","incredibly","absolutely","totally","completely","really","truly",
  "highly","super","ultra","enormously","immensely","deeply","strongly",
]);

export function analyzeTextSentiment(text: string): {
  score: number;
  label: "positive" | "neutral" | "negative";
  confidence: number;
} {
  if (!text || text.trim().length === 0) {
    return { score: 0, label: "neutral", confidence: 0 };
  }

  const words = text.toLowerCase().replace(/[^a-z'\s]/g, "").split(/\s+/);
  let score = 0;
  let matches = 0;
  let negated = false;
  let amplify = 1;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (NEGATION_WORDS.has(word)) { negated = true; continue; }
    if (AMPLIFIER_WORDS.has(word)) { amplify = 1.5; continue; }

    let delta = 0;
    if (POSITIVE_WORDS.has(word)) { delta = 1 * amplify; matches++; }
    else if (NEGATIVE_WORDS.has(word)) { delta = -1 * amplify; matches++; }

    if (delta !== 0) {
      score += negated ? -delta : delta;
      negated = false;
      amplify = 1;
    }
  }

  const normalised = matches > 0 ? Math.max(-1, Math.min(1, score / matches)) : 0;
  const confidence = matches > 0 ? Math.min(1, matches / Math.max(1, words.length) * 3) : 0;

  const label =
    normalised > 0.1 ? "positive" : normalised < -0.1 ? "negative" : "neutral";

  return { score: normalised, label, confidence };
}

// ─── TanStack Query Hooks ───────────────────────────────────────────────────

export function useUserInsights(userId: string) {
  return useQuery({
    queryKey: ["/api/comms/intelligence/profile", userId],
    queryFn: async () => {
      const res = await fetch(`/api/comms/intelligence/profile/${userId}`);
      if (!res.ok) throw new Error("Failed to fetch user insights");
      return res.json();
    },
    refetchInterval: 30_000,
    enabled: !!userId,
  });
}

export function useContactSuggestions(userId: string) {
  return useQuery({
    queryKey: ["/api/comms/intelligence/suggestions", userId],
    queryFn: async () => {
      const res = await fetch(`/api/comms/intelligence/suggestions/${userId}`);
      if (!res.ok) throw new Error("Failed to fetch contact suggestions");
      return res.json();
    },
    refetchInterval: 60_000,
    enabled: !!userId,
  });
}

export function useAnomalyAlerts(userId: string) {
  return useQuery({
    queryKey: ["/api/comms/intelligence/anomalies", userId],
    queryFn: async () => {
      const res = await fetch(`/api/comms/intelligence/anomalies/${userId}`);
      if (!res.ok) throw new Error("Failed to fetch anomaly alerts");
      return res.json();
    },
    refetchInterval: 30_000,
    enabled: !!userId,
  });
}

export function useNetworkHealth() {
  return useQuery({
    queryKey: ["/api/comms/intelligence/network-health"],
    queryFn: async () => {
      const res = await fetch("/api/comms/intelligence/network-health");
      if (!res.ok) throw new Error("Failed to fetch network health");
      return res.json();
    },
    refetchInterval: 15_000,
  });
}
