"use client";

import { useMemo, useState } from "react";

type EmojiEntry = { emoji: string; keywords: string[] };

type EmojiCategory = {
  id: string;
  label: string;
  emojis: EmojiEntry[];
};

const CATEGORIES: EmojiCategory[] = [
  {
    id: "smileys",
    label: "Smileys",
    emojis: [
      { emoji: "😀", keywords: ["grin", "happy", "smile"] },
      { emoji: "😁", keywords: ["beaming", "happy"] },
      { emoji: "😂", keywords: ["laugh", "tears", "lol"] },
      { emoji: "🤣", keywords: ["rofl", "laugh"] },
      { emoji: "😊", keywords: ["blush", "smile"] },
      { emoji: "😇", keywords: ["angel", "innocent"] },
      { emoji: "🙂", keywords: ["slight", "smile"] },
      { emoji: "😉", keywords: ["wink"] },
      { emoji: "😍", keywords: ["love", "hearts", "eyes"] },
      { emoji: "🥰", keywords: ["love", "smiling"] },
      { emoji: "😘", keywords: ["kiss", "blow"] },
      { emoji: "😗", keywords: ["kiss"] },
      { emoji: "😋", keywords: ["yum", "tasty"] },
      { emoji: "😜", keywords: ["wink", "tongue"] },
      { emoji: "🤪", keywords: ["zany", "goofy"] },
      { emoji: "😝", keywords: ["tongue", "squint"] },
      { emoji: "🤑", keywords: ["money", "rich"] },
      { emoji: "🤗", keywords: ["hug"] },
      { emoji: "🤭", keywords: ["oops", "giggle"] },
      { emoji: "🤫", keywords: ["shush", "quiet"] },
      { emoji: "🤔", keywords: ["think", "hmm"] },
      { emoji: "🤐", keywords: ["zipper", "secret"] },
      { emoji: "😐", keywords: ["neutral", "meh"] },
      { emoji: "😑", keywords: ["expressionless"] },
      { emoji: "😶", keywords: ["silent"] },
      { emoji: "🙄", keywords: ["eyes", "roll"] },
      { emoji: "😏", keywords: ["smirk"] },
      { emoji: "😣", keywords: ["persevere"] },
      { emoji: "😥", keywords: ["sad", "relieved"] },
      { emoji: "😮", keywords: ["wow", "open"] },
      { emoji: "😯", keywords: ["surprised"] },
      { emoji: "😪", keywords: ["sleepy"] },
      { emoji: "😫", keywords: ["tired"] },
      { emoji: "🥱", keywords: ["yawn"] },
      { emoji: "😴", keywords: ["sleep", "zzz"] },
      { emoji: "😌", keywords: ["relieved"] },
      { emoji: "😛", keywords: ["tongue"] },
      { emoji: "😓", keywords: ["sweat", "downcast"] },
      { emoji: "😕", keywords: ["confused"] },
      { emoji: "🙃", keywords: ["upside"] },
      { emoji: "😭", keywords: ["cry", "sob"] },
      { emoji: "😱", keywords: ["scream", "fear"] },
      { emoji: "😳", keywords: ["flushed", "embarassed"] },
      { emoji: "🥺", keywords: ["plead", "puppy"] },
      { emoji: "😢", keywords: ["cry", "tear"] },
      { emoji: "😤", keywords: ["huff", "steam"] },
      { emoji: "😠", keywords: ["angry"] },
      { emoji: "😡", keywords: ["rage", "mad"] },
      { emoji: "🤬", keywords: ["swear", "cursing"] },
      { emoji: "🤯", keywords: ["mindblown", "explode"] },
    ],
  },
  {
    id: "people",
    label: "People",
    emojis: [
      { emoji: "👋", keywords: ["wave", "hello", "hi"] },
      { emoji: "🤚", keywords: ["hand", "raised"] },
      { emoji: "✋", keywords: ["stop", "hand"] },
      { emoji: "🖖", keywords: ["vulcan", "spock"] },
      { emoji: "👌", keywords: ["ok", "okay"] },
      { emoji: "✌️", keywords: ["peace", "victory"] },
      { emoji: "🤞", keywords: ["luck", "fingers"] },
      { emoji: "🤟", keywords: ["love", "you"] },
      { emoji: "🤘", keywords: ["rock", "metal"] },
      { emoji: "👍", keywords: ["thumbs", "up", "yes"] },
      { emoji: "👎", keywords: ["thumbs", "down", "no"] },
      { emoji: "👏", keywords: ["clap", "applause"] },
      { emoji: "🙌", keywords: ["raise", "hands", "celebrate"] },
      { emoji: "👐", keywords: ["open", "hands"] },
      { emoji: "🤲", keywords: ["palms", "together"] },
      { emoji: "🤝", keywords: ["handshake", "deal"] },
      { emoji: "🙏", keywords: ["pray", "thanks", "please"] },
      { emoji: "💪", keywords: ["muscle", "strong"] },
      { emoji: "🦾", keywords: ["robot", "arm"] },
      { emoji: "👀", keywords: ["eyes", "look"] },
      { emoji: "👂", keywords: ["ear", "hear"] },
      { emoji: "👃", keywords: ["nose"] },
      { emoji: "🧠", keywords: ["brain", "smart"] },
      { emoji: "🦷", keywords: ["tooth"] },
      { emoji: "🦴", keywords: ["bone"] },
      { emoji: "👶", keywords: ["baby"] },
      { emoji: "🧒", keywords: ["child"] },
      { emoji: "👦", keywords: ["boy"] },
      { emoji: "👧", keywords: ["girl"] },
      { emoji: "🧑", keywords: ["person", "adult"] },
      { emoji: "👨", keywords: ["man"] },
      { emoji: "👩", keywords: ["woman"] },
      { emoji: "🧓", keywords: ["older"] },
      { emoji: "👴", keywords: ["grandpa"] },
      { emoji: "👵", keywords: ["grandma"] },
    ],
  },
  {
    id: "nature",
    label: "Nature",
    emojis: [
      { emoji: "🐶", keywords: ["dog", "puppy"] },
      { emoji: "🐱", keywords: ["cat", "kitten"] },
      { emoji: "🐭", keywords: ["mouse"] },
      { emoji: "🐹", keywords: ["hamster"] },
      { emoji: "🐰", keywords: ["rabbit", "bunny"] },
      { emoji: "🦊", keywords: ["fox"] },
      { emoji: "🐻", keywords: ["bear"] },
      { emoji: "🐼", keywords: ["panda"] },
      { emoji: "🐨", keywords: ["koala"] },
      { emoji: "🐯", keywords: ["tiger"] },
      { emoji: "🦁", keywords: ["lion"] },
      { emoji: "🐮", keywords: ["cow"] },
      { emoji: "🐷", keywords: ["pig"] },
      { emoji: "🐸", keywords: ["frog"] },
      { emoji: "🐵", keywords: ["monkey"] },
      { emoji: "🐔", keywords: ["chicken"] },
      { emoji: "🐧", keywords: ["penguin"] },
      { emoji: "🐦", keywords: ["bird"] },
      { emoji: "🐤", keywords: ["chick"] },
      { emoji: "🦄", keywords: ["unicorn"] },
      { emoji: "🐝", keywords: ["bee"] },
      { emoji: "🦋", keywords: ["butterfly"] },
      { emoji: "🌸", keywords: ["cherry", "blossom", "flower"] },
      { emoji: "🌺", keywords: ["hibiscus", "flower"] },
      { emoji: "🌻", keywords: ["sunflower"] },
      { emoji: "🌹", keywords: ["rose"] },
      { emoji: "🌷", keywords: ["tulip"] },
      { emoji: "🌱", keywords: ["seedling", "plant"] },
      { emoji: "🌲", keywords: ["tree", "evergreen"] },
      { emoji: "🌳", keywords: ["tree", "deciduous"] },
      { emoji: "🍀", keywords: ["clover", "luck"] },
      { emoji: "☀️", keywords: ["sun", "sunny"] },
      { emoji: "🌙", keywords: ["moon"] },
      { emoji: "⭐", keywords: ["star"] },
      { emoji: "🌈", keywords: ["rainbow"] },
      { emoji: "⚡", keywords: ["lightning", "zap"] },
      { emoji: "🔥", keywords: ["fire", "hot"] },
      { emoji: "💧", keywords: ["droplet", "water"] },
      { emoji: "❄️", keywords: ["snow", "cold"] },
    ],
  },
  {
    id: "food",
    label: "Food",
    emojis: [
      { emoji: "🍎", keywords: ["apple", "fruit"] },
      { emoji: "🍌", keywords: ["banana"] },
      { emoji: "🍇", keywords: ["grapes"] },
      { emoji: "🍓", keywords: ["strawberry"] },
      { emoji: "🍉", keywords: ["watermelon"] },
      { emoji: "🍑", keywords: ["peach"] },
      { emoji: "🍒", keywords: ["cherries"] },
      { emoji: "🥭", keywords: ["mango"] },
      { emoji: "🍍", keywords: ["pineapple"] },
      { emoji: "🥥", keywords: ["coconut"] },
      { emoji: "🥝", keywords: ["kiwi"] },
      { emoji: "🍅", keywords: ["tomato"] },
      { emoji: "🥑", keywords: ["avocado"] },
      { emoji: "🌽", keywords: ["corn"] },
      { emoji: "🥕", keywords: ["carrot"] },
      { emoji: "🍞", keywords: ["bread"] },
      { emoji: "🧀", keywords: ["cheese"] },
      { emoji: "🍕", keywords: ["pizza"] },
      { emoji: "🍔", keywords: ["burger", "hamburger"] },
      { emoji: "🍟", keywords: ["fries"] },
      { emoji: "🌮", keywords: ["taco"] },
      { emoji: "🍣", keywords: ["sushi"] },
      { emoji: "🍜", keywords: ["ramen", "noodles"] },
      { emoji: "🍲", keywords: ["stew", "pot"] },
      { emoji: "🥗", keywords: ["salad"] },
      { emoji: "🍿", keywords: ["popcorn"] },
      { emoji: "🍩", keywords: ["donut", "doughnut"] },
      { emoji: "🍪", keywords: ["cookie"] },
      { emoji: "🎂", keywords: ["cake", "birthday"] },
      { emoji: "🍰", keywords: ["cake", "slice"] },
      { emoji: "☕", keywords: ["coffee", "tea"] },
      { emoji: "🍵", keywords: ["tea"] },
      { emoji: "🧃", keywords: ["juice", "box"] },
      { emoji: "🥤", keywords: ["cup", "straw"] },
      { emoji: "🍺", keywords: ["beer"] },
      { emoji: "🍷", keywords: ["wine"] },
    ],
  },
  {
    id: "activity",
    label: "Activity",
    emojis: [
      { emoji: "⚽", keywords: ["soccer", "football"] },
      { emoji: "🏀", keywords: ["basketball"] },
      { emoji: "🏈", keywords: ["football", "american"] },
      { emoji: "⚾", keywords: ["baseball"] },
      { emoji: "🎾", keywords: ["tennis"] },
      { emoji: "🏐", keywords: ["volleyball"] },
      { emoji: "🏉", keywords: ["rugby"] },
      { emoji: "🎱", keywords: ["billiards", "pool"] },
      { emoji: "🏓", keywords: ["pingpong", "table"] },
      { emoji: "🏸", keywords: ["badminton"] },
      { emoji: "⛳", keywords: ["golf"] },
      { emoji: "🎯", keywords: ["target", "bullseye"] },
      { emoji: "🎮", keywords: ["game", "controller"] },
      { emoji: "🎲", keywords: ["dice", "game"] },
      { emoji: "♟️", keywords: ["chess"] },
      { emoji: "🎸", keywords: ["guitar", "music"] },
      { emoji: "🎹", keywords: ["piano", "keyboard"] },
      { emoji: "🥁", keywords: ["drum"] },
      { emoji: "🎤", keywords: ["mic", "sing"] },
      { emoji: "🎧", keywords: ["headphones", "music"] },
      { emoji: "🎬", keywords: ["movie", "clapper"] },
      { emoji: "🎨", keywords: ["art", "palette"] },
      { emoji: "🎭", keywords: ["theater", "drama"] },
      { emoji: "🎪", keywords: ["circus"] },
      { emoji: "🏆", keywords: ["trophy", "win"] },
      { emoji: "🥇", keywords: ["gold", "medal", "first"] },
      { emoji: "🥈", keywords: ["silver", "medal"] },
      { emoji: "🥉", keywords: ["bronze", "medal"] },
      { emoji: "🏅", keywords: ["medal"] },
      { emoji: "🎖️", keywords: ["military", "medal"] },
    ],
  },
  {
    id: "objects",
    label: "Objects",
    emojis: [
      { emoji: "⌚", keywords: ["watch"] },
      { emoji: "📱", keywords: ["phone", "mobile"] },
      { emoji: "💻", keywords: ["laptop", "computer"] },
      { emoji: "⌨️", keywords: ["keyboard"] },
      { emoji: "🖥️", keywords: ["desktop", "computer"] },
      { emoji: "🖨️", keywords: ["printer"] },
      { emoji: "🖱️", keywords: ["mouse"] },
      { emoji: "💾", keywords: ["disk", "save"] },
      { emoji: "📷", keywords: ["camera"] },
      { emoji: "📹", keywords: ["video", "camera"] },
      { emoji: "🎥", keywords: ["movie", "camera"] },
      { emoji: "📺", keywords: ["tv", "television"] },
      { emoji: "📻", keywords: ["radio"] },
      { emoji: "🔋", keywords: ["battery"] },
      { emoji: "🔌", keywords: ["plug", "power"] },
      { emoji: "💡", keywords: ["bulb", "idea", "light"] },
      { emoji: "🔦", keywords: ["flashlight"] },
      { emoji: "🕯️", keywords: ["candle"] },
      { emoji: "📕", keywords: ["book", "red"] },
      { emoji: "📗", keywords: ["book", "green"] },
      { emoji: "📘", keywords: ["book", "blue"] },
      { emoji: "📙", keywords: ["book", "orange"] },
      { emoji: "📚", keywords: ["books"] },
      { emoji: "📝", keywords: ["memo", "note", "write"] },
      { emoji: "✏️", keywords: ["pencil"] },
      { emoji: "🖊️", keywords: ["pen"] },
      { emoji: "📎", keywords: ["paperclip", "attach"] },
      { emoji: "📌", keywords: ["pin", "pushpin"] },
      { emoji: "🔑", keywords: ["key"] },
      { emoji: "🔒", keywords: ["lock", "secure"] },
      { emoji: "🔓", keywords: ["unlock"] },
      { emoji: "🎁", keywords: ["gift", "present"] },
      { emoji: "🎈", keywords: ["balloon"] },
      { emoji: "🎉", keywords: ["party", "tada", "celebrate"] },
      { emoji: "🎊", keywords: ["confetti"] },
    ],
  },
  {
    id: "symbols",
    label: "Symbols",
    emojis: [
      { emoji: "❤️", keywords: ["heart", "love", "red"] },
      { emoji: "🧡", keywords: ["heart", "orange"] },
      { emoji: "💛", keywords: ["heart", "yellow"] },
      { emoji: "💚", keywords: ["heart", "green"] },
      { emoji: "💙", keywords: ["heart", "blue"] },
      { emoji: "💜", keywords: ["heart", "purple"] },
      { emoji: "🖤", keywords: ["heart", "black"] },
      { emoji: "🤍", keywords: ["heart", "white"] },
      { emoji: "💔", keywords: ["broken", "heart"] },
      { emoji: "❣️", keywords: ["heart", "exclamation"] },
      { emoji: "💕", keywords: ["two", "hearts"] },
      { emoji: "💞", keywords: ["revolving", "hearts"] },
      { emoji: "💓", keywords: ["beating", "heart"] },
      { emoji: "💗", keywords: ["growing", "heart"] },
      { emoji: "💖", keywords: ["sparkling", "heart"] },
      { emoji: "💘", keywords: ["cupid", "heart"] },
      { emoji: "💝", keywords: ["gift", "heart"] },
      { emoji: "✅", keywords: ["check", "done", "yes"] },
      { emoji: "❌", keywords: ["x", "no", "cross"] },
      { emoji: "❗", keywords: ["exclamation", "alert"] },
      { emoji: "❓", keywords: ["question"] },
      { emoji: "💯", keywords: ["hundred", "perfect"] },
      { emoji: "🔔", keywords: ["bell", "notify"] },
      { emoji: "🔕", keywords: ["mute", "bell"] },
      { emoji: "♻️", keywords: ["recycle"] },
      { emoji: "⚠️", keywords: ["warning"] },
      { emoji: "🚫", keywords: ["prohibited", "no"] },
      { emoji: "🔴", keywords: ["red", "circle"] },
      { emoji: "🟢", keywords: ["green", "circle"] },
      { emoji: "🔵", keywords: ["blue", "circle"] },
    ],
  },
];

export function EmojiPicker({
  onSelect,
  onClose,
}: {
  onSelect: (emoji: string) => void;
  onClose?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState(CATEGORIES[0]!.id);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return CATEGORIES.find((c) => c.id === categoryId)?.emojis ?? [];
    }
    return CATEGORIES.flatMap((c) => c.emojis).filter(
      (e) =>
        e.keywords.some((k) => k.includes(q)) ||
        e.emoji.includes(q),
    );
  }, [categoryId, query]);

  return (
    <div
      className="absolute bottom-full left-0 z-30 mb-2 w-72 overflow-hidden rounded-2xl border border-border bg-white shadow-lg"
      role="dialog"
      aria-label="Emoji picker"
    >
      <div className="border-b border-border p-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search emoji…"
          className="w-full rounded-xl border border-border px-3 py-1.5 text-sm text-foreground focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20"
          aria-label="Search emoji"
        />
      </div>
      {!query.trim() ? (
        <div className="flex gap-0.5 overflow-x-auto border-b border-border px-1.5 py-1">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategoryId(c.id)}
              className={`shrink-0 rounded-lg px-2 py-1 text-[11px] font-medium ${
                categoryId === c.id
                  ? "bg-brand-50 text-brand-700"
                  : "text-foreground-light hover:bg-surface-200"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      ) : null}
      <div className="grid max-h-48 grid-cols-8 gap-0.5 overflow-y-auto p-2">
        {filtered.map((e) => (
          <button
            key={`${e.emoji}-${e.keywords[0]}`}
            type="button"
            className="rounded-lg p-1 text-lg hover:bg-surface-200"
            aria-label={`Insert ${e.keywords[0] ?? e.emoji}`}
            onClick={() => {
              onSelect(e.emoji);
              onClose?.();
            }}
          >
            {e.emoji}
          </button>
        ))}
        {!filtered.length ? (
          <p className="col-span-8 py-6 text-center text-xs text-foreground-lighter">
            No matches
          </p>
        ) : null}
      </div>
    </div>
  );
}
