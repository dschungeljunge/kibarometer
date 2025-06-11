// Dieses Layout sorgt dafür, dass die Test-Seite die volle Bildschirmhöhe ohne die Hauptnavigation nutzen kann.
export default function TestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
} 