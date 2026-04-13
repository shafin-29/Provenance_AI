import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import Image from "next/image";

export default function SignInPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen mt-2 bg-background">
      <div className="flex flex-col items-center mb-6">
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity outline-none">
          <div className="relative w-7 h-7">
            <Image src="/pro_logo.png" alt="ProvenanceAI" fill className="object-contain" priority />
          </div>
          <span className="font-semibold text-[20px] text-text-primary tracking-tight">
            ProvenanceAI
          </span>
        </Link>
      </div>
      
      <SignIn path="/sign-in" routing="path" signUpUrl="/sign-up" forceRedirectUrl="/sdk" />
      
      <div className="mt-6 text-[14px] text-text-muted">
        Don't have an account?{" "}
        <Link href="/sign-up" className="text-accent-primary hover:underline font-medium">
          Sign up →
        </Link>
      </div>
    </div>
  );
}
