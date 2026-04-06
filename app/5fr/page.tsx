'use client';

import { useAuth } from '@/lib/useAuth';
import Header from '@/components/Header';

export default function FiveFRPage() {
  const { session, loading, logout } = useAuth();

  if (loading || !session) return null;

  return (
    <div className="min-h-screen bg-[#7CC042] flex flex-col">
      <Header session={session} onLogout={logout} />

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="max-w-2xl w-full text-center flex flex-col gap-8">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            The 5 Fundamental Rules
          </h1>

          <ol className="flex flex-col gap-5 text-left">
            <li className="text-white font-bold text-lg sm:text-xl leading-relaxed">
              <span className="opacity-60 mr-2">1.</span>
              If we don&apos;t look after the customer, someone else will.
            </li>
            <li className="text-white font-bold text-lg sm:text-xl leading-relaxed">
              <span className="opacity-60 mr-2">2.</span>
              Nothing is gained by winning an argument but losing a customer.
            </li>
            <li className="text-white font-bold text-lg sm:text-xl leading-relaxed">
              <span className="opacity-60 mr-2">3.</span>
              Always deliver what we promise. If in doubt, under promise and over deliver.
            </li>
            <li className="text-white font-bold text-lg sm:text-xl leading-relaxed">
              <span className="opacity-60 mr-2">4.</span>
              Always treat customers as we ourselves would like to be treated.
            </li>
            <li className="text-white font-bold text-lg sm:text-xl leading-relaxed">
              <span className="opacity-60 mr-2">5.</span>
              The reputation of the whole company is in the hands of each individual.
            </li>
          </ol>
        </div>
      </main>
    </div>
  );
}
