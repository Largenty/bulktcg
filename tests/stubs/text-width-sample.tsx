/* Échantillon pour tests/text-width.test.mjs : six fautes volontaires —
   huit lu comme une page, où les gabarits à 820 et à 480 px en deviennent —,
   en classe comme en style en ligne, et des largeurs permises qui ne doivent
   pas être signalées. Ce fichier n'est importé par rien. */
import Link from "next/link";

export function Sample({ isWide }: { isWide: boolean }) {
  return (
    <div className="max-w-[820px]">
      <h1 className="display max-w-[20ch]">Faute</h1>
      <p className={`text-[var(--ink-soft)] ${isWide ? "" : "lg:max-w-[62ch]"}`}>Faute</p>
      <Link href="/" className="max-w-md">
        Faute
      </Link>
      <div className="flex max-w-[68ch] flex-col gap-4">
        <p>Faute : la mesure en caractères bride le paragraphe</p>
      </div>
      <span className="tag max-w-full">Permis</span>
      <p className="max-w-none">Permis</p>
      <main style={{ maxWidth: "480px" }}>
        <p>Faute, lue comme une page : le gabarit bridé en ligne</p>
      </main>
      <p style={{ maxWidth: 640 }}>Faute : un style en ligne bride autant qu&apos;une classe</p>
      <div style={{ maxInlineSize: "68ch" }}>
        <p>Faute : la mesure en caractères, écrite en ligne</p>
      </div>
      <p style={{ maxWidth: "100%" }}>Permis</p>
    </div>
  );
}
