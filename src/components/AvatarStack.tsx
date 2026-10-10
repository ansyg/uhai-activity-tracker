interface Person {
  id: string;
  name: string;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function AvatarStack({ people, max = 4 }: { people: Person[]; max?: number }) {
  if (people.length === 0) {
    return <span className="muted" style={{ fontSize: "0.85em" }}>Unassigned</span>;
  }

  const shown = people.slice(0, max);
  const overflow = people.length - shown.length;

  return (
    <div className="avatar-stack" title={people.map((p) => p.name).join(", ")}>
      {shown.map((person) => (
        <span key={person.id} className="avatar">
          {initials(person.name) || "?"}
        </span>
      ))}
      {overflow > 0 && <span className="avatar avatar-overflow">+{overflow}</span>}
    </div>
  );
}
