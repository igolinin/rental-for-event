import { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Sign In",
};

export default function LoginPage() {
  return (
    <div className="w-full max-w-md">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Event Rental Manager</h1>
        <p className="mt-2 text-sm text-slate-600">Sign in to your account</p>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
        <LoginForm />
      </div>
    </div>
  );
}
