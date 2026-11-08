const GROUPS = [
  {
    id: "faces",
    label: "Faces",
    emojis: ["😀","😁","😂","🤣","😊","😍","😘","😎","🤔","😴","😢","😭","😡","🤯","🥳","😇","🙃","😉","🙂","😋","🤗","🤩","😬","😅"],
  },
  {
    id: "gestures",
    label: "Gestures",
    emojis: ["👍","👎","👏","🙏","💪","✌️","🤝","👌","🙌","👋","🤞","🫶","👉","👈","👆","👇"],
  },
  {
    id: "hearts",
    label: "Hearts",
    emojis: ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","💔","💕","💞","💖","💗","💓"],
  },
  {
    id: "food",
    label: "Food",
    emojis: ["🍏","🍎","🌽","🌾","🍞","🧀","🍇","🍓","🍉","🥑","🍅","🥕","☕","🍵"],
  },
  {
    id: "nature",
    label: "Nature",
    emojis: ["🌱","🌿","🍀","🌳","🌞","🌧️","🌈","🔥","💧","⭐","🌸","🌻"],
  },
  {
    id: "more",
    label: "More",
    emojis: ["🎉","🎊","✅","❌","📌","📝","📚","📎","📷","📄","⏰","💡","🎓","🏆"],
  },
];

function EmojiPicker({ onSelect, onClose }) {
  return (
    <div className="community-emoji-picker" role="dialog" aria-label="Emoji picker">
      <div className="community-emoji-head">
        <strong>Emoji</strong>
        <button type="button" onClick={onClose} aria-label="Close emoji picker">
          Close
        </button>
      </div>
      {GROUPS.map((group) => (
        <div key={group.id} className="community-emoji-group">
          <span>{group.label}</span>
          <div className="community-emoji-grid">
            {group.emojis.map((emoji) => (
              <button
                key={`${group.id}-${emoji}`}
                type="button"
                onClick={() => onSelect(emoji)}
                aria-label={`Insert ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default EmojiPicker;
