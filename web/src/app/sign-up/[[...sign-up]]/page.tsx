import { SignUp } from "@clerk/nextjs";
import Link from "next/link";
import Image from "next/image";

export default function SignUpPage() {
  return (
    <div className="flex flex-col items-center justify-center mt-2 min-h-screen bg-background">
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
      
      <SignUp path="/sign-up" routing="path" signInUrl="/sign-in" forceRedirectUrl="/sdk" />
      
      <div className="mt-6 text-[14px] text-text-muted">
        Already have an account?{" "}
        <Link href="/sign-in" className="text-accent-primary hover:underline font-medium">
          Sign in →
        </Link>
      </div>
    </div>
  );
}
