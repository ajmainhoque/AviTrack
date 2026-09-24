export function classifyIdentity(
  query: string,
): "hex" | "registration" | "type" | "callsign" | null {
  const value = query.trim().toUpperCase();
  if (!/^[A-Z0-9~-]{2,16}$/.test(value)) return null;
  if (/^~?[0-9A-F]{6}$/.test(value)) return "hex";
  if (
    /^[A-Z0-9]{1,3}-[A-Z0-9]{2,8}$/.test(value) ||
    /^N\d[A-Z0-9]{0,5}$/.test(value)
  )
    return "registration";
  if (/^[ABCE]\d[A-Z0-9]{2}$/.test(value)) return "type";
  if (/\d/.test(value)) return "callsign";
  return null;
}
