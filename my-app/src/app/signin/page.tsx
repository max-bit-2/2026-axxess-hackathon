import Link from "next/link";
import { redirect } from "next/navigation";
import { getOptionalUser } from "@/lib/auth";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { user } = await getOptionalUser();
  if (user) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const error = params.error;

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center bg-[#050505] text-white selection:bg-white/20 font-sans overflow-hidden px-4">
      {/* Subtle Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-white/[0.02] rounded-full blur-[120px] pointer-events-none" />

      {/* Back to Home Navigation */}
      <div className="absolute top-6 left-6 z-20">
        <Link 
          href="/" 
          className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Home
        </Link>
      </div>

      <div className="relative z-10 w-full max-w-[400px]">
        
        {/* Logo & Header */}
        <div className="flex flex-col items-center mb-10 text-center">
          <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(255,255,255,0.1)]">
            <div className="w-4 h-4 rounded-full bg-[#050505]" />
          </div>
          <h1 className="text-3xl font-medium tracking-tight mb-2">Welcome back</h1>
          <p className="text-neutral-400 font-light">Sign in to your secure workspace</p>
        </div>

        {/* Sleek Dark Card */}
        <div className="rounded-[24px] border border-white/10 bg-[#0A0A0A] p-8 shadow-2xl relative overflow-hidden">
          {/* Subtle top edge highlight */}
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          
          <div className="flex flex-col gap-6">
            
            {error ? (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400 flex items-center justify-center">
                {error}
              </div>
            ) : null}

            {/* Google OAuth Button */}
            <Link
              href="/auth/login"
              className="w-full flex items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-5 py-3.5 text-sm font-medium transition-colors"
            >
                <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"></path>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path>
                </svg>
                <span>Continue with Google</span>
            </Link>

            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-white/10"></div>
              <span className="mx-4 text-xs text-neutral-500 uppercase tracking-widest">Enterprise Access</span>
              <div className="flex-grow border-t border-white/10"></div>
            </div>

            {/* Email Form Placeholder (Matches aesthetic) */}
            <div className="space-y-4">
              <input 
                type="email" 
                placeholder="Work Email" 
                disabled
                className="w-full rounded-xl border border-white/10 bg-[#050505] px-4 py-3.5 text-sm text-white placeholder-neutral-600 outline-none cursor-not-allowed opacity-50"
              />
              <button 
                disabled
                className="w-full rounded-xl bg-white text-[#050505] px-5 py-3.5 text-sm font-medium cursor-not-allowed opacity-50"
              >
                Sign In with SSO
              </button>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center text-xs text-neutral-600 flex justify-center gap-4">
          <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
          <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
        </div>
      </div>
    </div>
  );
}
