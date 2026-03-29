import { SignUp } from "@clerk/nextjs";
import Link from "next/link";

export default function SignUpPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background">
      <div className="flex flex-col items-center mb-8">
        <div className="flex items-center gap-2 mb-2">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent-primary">
            <circle cx="18" cy="5" r="3"></circle>
            <circle cx="6" cy="12" r="3"></circle>
            <circle cx="18" cy="19" r="3"></circle>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
          </svg>
          <span className="font-semibold text-[20px] text-text-primary tracking-tight">
            ProvenanceAI
          </span>
        </div>
      </div>
      
      <SignUp path="/sign-up" routing="path" signInUrl="/sign-in" />
      
      <div className="mt-6 text-[14px] text-text-muted">
        Already have an account?{" "}
        <Link href="/sign-in" className="text-accent-primary hover:underline font-medium">
          Sign in →
        </Link>
      </div>
    </div>
  );
}
