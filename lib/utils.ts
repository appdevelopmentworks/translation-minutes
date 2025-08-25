// lightweight cn (no external deps)
type ClassValue = string | number | null | undefined | Record<string, boolean> | ClassValue[];

export function cn(...classes: Array<ClassValue>) {
  return classes
    .flatMap((c) =>
      typeof c === "string"
        ? c
        : Array.isArray(c)
        ? c
        : typeof c === "object" && c
        ? Object.entries(c)
            .filter(([, v]) => !!v)
            .map(([k]) => k)
        : []
    )
    .filter(Boolean)
    .join(" ");
}
