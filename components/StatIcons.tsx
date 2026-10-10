/**
 * Small, simple gradient-filled icons for the Stats tiles — same spirit as
 * the reference set (soft gradient fill, rounded forms, minimal detail),
 * just in the site's own pastel palette rather than on a dark background.
 */
function Grad({ id, from, to }: { id: string; from: string; to: string }) {
  return (
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor={from} />
        <stop offset="1" stopColor={to} />
      </linearGradient>
    </defs>
  );
}

export function HeartStatIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <Grad id="g-heart" from="#F2A9BF" to="#D4638A" />
      <path
        fill="url(#g-heart)"
        d="M12 21.35 10.55 20.03C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.53L12 21.35Z"
      />
    </svg>
  );
}

export function PeopleStatIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <Grad id="g-people" from="#B6ABE8" to="#6E5FC7" />
      <circle cx="9" cy="8" r="3.3" fill="url(#g-people)" />
      <path d="M3 19c0-3.3 2.8-5.5 6-5.5s6 2.2 6 5.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z" fill="url(#g-people)" />
      <circle cx="17.5" cy="9" r="2.4" fill="url(#g-people)" opacity="0.85" />
      <path d="M14.8 19c-.1-2.2-1-3.9-2.5-5 .9-.5 1.9-.8 3-.8 2.8 0 5 1.9 5 4.9a1 1 0 0 1-.9 1h-4.6Z" fill="url(#g-people)" opacity="0.85" />
    </svg>
  );
}

export function SparkleStatIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <Grad id="g-sparkle" from="#F0CA85" to="#DDA53E" />
      <path
        fill="url(#g-sparkle)"
        d="M12 2c.6 4.2 1.8 6.9 3.6 8.4C17.4 11.9 19.3 12.7 22 13c-2.7.3-4.6 1.1-6.4 2.6C13.8 17.1 12.6 19.8 12 24c-.6-4.2-1.8-6.9-3.6-8.4C6.6 14.1 4.7 13.3 2 13c2.7-.3 4.6-1.1 6.4-2.6C10.2 8.9 11.4 6.2 12 2Z"
      />
    </svg>
  );
}

export function FolderStatIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <Grad id="g-folder" from="#9FC3E6" to="#5C9BD1" />
      <path
        fill="url(#g-folder)"
        d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4.6c.5 0 1 .2 1.3.6L11.6 7H19.5A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5Z"
      />
    </svg>
  );
}

export function SproutStatIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <Grad id="g-sprout" from="#A8D3A8" to="#6FAF6F" />
      <path d="M12 21V12.5" fill="none" stroke="url(#g-sprout)" strokeWidth="1.6" strokeLinecap="round" />
      <path
        fill="url(#g-sprout)"
        d="M12 13c0-4 3-6.5 7-6.5-0.3 4-3 6.5-7 6.5Z"
      />
      <path
        fill="url(#g-sprout)"
        d="M12 14.5c0-3.5-2.6-6-6-6 .3 3.5 2.6 6 6 6Z"
      />
    </svg>
  );
}

export function CrownStatIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <Grad id="g-crown" from="#F0CA85" to="#DDA53E" />
      <path
        fill="url(#g-crown)"
        d="M3.5 9.5 7 12l3.3-5.3a1 1 0 0 1 1.7 0L15.3 12l3.5-2.5L17.5 18h-11Z"
      />
      <rect x="6.3" y="19" width="11.4" height="1.6" rx="0.8" fill="url(#g-crown)" />
    </svg>
  );
}
