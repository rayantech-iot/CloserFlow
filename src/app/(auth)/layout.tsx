import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Connexion - CloserFlow",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#030712]">
      {children}
    </div>
  );
}
