import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/account/auth-form";

export const metadata: Metadata = { title: "Вход", robots: { index: false } };

export default function LoginPage() {
  return (
    <div className="container-page flex justify-center pt-10 sm:pt-16">
      <Suspense>
        <AuthForm mode="login" />
      </Suspense>
    </div>
  );
}
