import { Auditor } from "@/components/Auditor";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-4 pb-10 pt-5 sm:px-6">
      <Auditor />
      <footer className="mt-auto pt-10 text-center text-xs leading-relaxed text-muted">
        AuditorX orienta, no sustituye a un abogado. Tu documento se analiza al momento y no se guarda.
      </footer>
    </main>
  );
}
