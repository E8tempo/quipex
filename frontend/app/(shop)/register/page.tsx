import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/account/auth-form";

export const metadata: Metadata = { title: "Регистрация", robots: { index: false } };

export default function RegisterPage() {
  return (
    <div className="container-page flex justify-center pt-10 sm:pt-16">
      <Suspense>
        <AuthForm mode="register" />
      </Suspense>
    </div>
  );
}
