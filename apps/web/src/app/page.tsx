export default function Home() {
  return (
    <div className="flex justify-center min-h-screen p-6">
      <main className="flex flex-col items-center justify-center w-full max-w-lg gap-10 text-center">
        {/* Logo / Title Area */}
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center justify-center border shadow-lg w-24 h-24 rounded-full bg-surface border-white/5">
            {/* Spade icon placeholder */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-accent-1"
            >
              <path d="M5 11a7 7 0 0 1 14 0c0 4.418-7 11-7 11s-7-6.582-7-11Z" />
              <path d="M12 22v-4" />
              <path d="M8 22h8" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
            OverBet
          </h1>
          <p className="max-w-sm text-lg text-white/70">
            The better Poker Now. Clean, minimal, real-time home-games.
          </p>
        </div>

        {/* Action Triggers */}
        <HomeClient />

        {/* Footer / Links */}
        <div className="flex items-center gap-6 mt-4 text-sm font-medium text-accent-2">
          <button className="transition-colors hover:text-white">Clubs</button>
          <button className="transition-colors hover:text-white">Community</button>
          <button className="transition-colors hover:text-white">Help</button>
        </div>
      </main>
    </div>
  );
}
import HomeClient from "./HomeClient";
