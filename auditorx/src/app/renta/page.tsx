import type { Metadata } from "next";
import { RentaWizard } from "@/components/renta/RentaWizard";

export const metadata: Metadata = {
  title: "Renta — AuditorX",
  description: "Calcula tu declaración de la renta a partir de tus certificados y nóminas, con cada cifra justificada.",
};

export default function RentaPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-4 pb-10 pt-5 sm:px-6">
      <RentaWizard />
    </main>
  );
}
