import HomeClient from "./HomeClient";

export default function Home() {
  return (
    <div
      className="flex justify-center min-h-screen p-6"
      style={{ background: "linear-gradient(160deg, #1a1428 0%, #141420 40%, #0f0e1a 100%)" }}
    >
      <main className="flex flex-col items-center justify-center w-full max-w-lg gap-10 text-center">
        <div className="flex flex-col items-center gap-4">
          {/* Moon Poker logo: gold + white circles */}
          <div className="flex items-center justify-center gap-1">
            <div className="w-10 h-10 rounded-full border-2 border-[#eab308] bg-[#eab308]/20" />
            <div className="w-16 h-16 rounded-full border-2 border-white/90 bg-white/10 shadow-lg" />
            <div className="w-10 h-10 rounded-full border-2 border-[#eab308] bg-[#eab308]/20" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl text-white">
            Moon Poker
          </h1>
          <p className="max-w-sm text-lg text-white/70">
            Luxury Velvet Lounge style real-time home-games.
          </p>
        </div>

        <HomeClient />

        <div className="flex items-center gap-6 mt-4 text-sm font-medium text-white/35">
          <button className="transition-colors hover:text-white/70">Clubs</button>
          <button className="transition-colors hover:text-white/70">Community</button>
          <button className="transition-colors hover:text-white/70">Help</button>
        </div>
      </main>
    </div>
  );
}
