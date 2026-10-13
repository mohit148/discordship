const LABEL: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  ship_creator: "Ship Creator",
};

const STYLE: Record<string, string> = {
  owner: "bg-amber-100 text-amber-500",
  admin: "bg-lavender-100 text-lavender-600",
  ship_creator: "bg-blossom-100 text-blossom-600",
};

export function RoleBadge({ role }: { role: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STYLE[role] ?? "bg-cream-200 text-ink-soft"}`}>
      {LABEL[role] ?? role}
    </span>
  );
}
