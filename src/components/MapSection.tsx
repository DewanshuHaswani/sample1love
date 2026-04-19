"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";

type LocalizedValue = string | Record<string, string>;

type Venue = {
  name?: LocalizedValue;
  location?: LocalizedValue;
  query?: string;
  link?: string;
  googleMapsLink?: string;
  embedQuery?: string;
};

type WeddingData = {
  defaultLanguage?: string;
  ui?: Record<string, Record<string, string>>;
  mapLocations?: Venue[];
};

function getLocalizedValue(value: LocalizedValue | undefined, lang: string, fallback = "en") {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value[lang] || value[fallback] || Object.values(value)[0] || "";
}

function buildIframeSrc(venue: Venue) {
  const rawQuery =
    venue.embedQuery ||
    venue.query ||
    [venue.name, venue.location]
      .map((value) => (typeof value === "string" ? value : ""))
      .filter(Boolean)
      .join(", ");

  const query = encodeURIComponent(rawQuery);
  return `https://www.google.com/maps?q=${query}&z=15&output=embed`;
}

export function MapSection() {
  const [data, setData] = useState<WeddingData | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [language, setLanguage] = useState("en");

  useEffect(() => {
    fetch("/weddingData.json")
      .then((res) => res.json())
      .then((payload: WeddingData) => {
        setData(payload);
        setLanguage(document.documentElement.lang || payload.defaultLanguage || "en");
      })
      .catch((err) => console.error("Could not load map data", err));
  }, []);

  useEffect(() => {
    const handleLanguageChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ lang?: string }>;
      setLanguage(customEvent.detail?.lang || document.documentElement.lang || "en");
    };

    window.addEventListener("wedding-language-change", handleLanguageChange);
    return () => window.removeEventListener("wedding-language-change", handleLanguageChange);
  }, []);

  const venues = useMemo(() => data?.mapLocations || [], [data]);
  const ui = data?.ui?.[language] || data?.ui?.en || {};

  useEffect(() => {
    if (activeIndex >= venues.length) {
      setActiveIndex(0);
    }
  }, [activeIndex, venues.length]);

  if (venues.length === 0) return null;

  const activeVenue = venues[activeIndex];
  const iframeSrc = buildIframeSrc(activeVenue);

  return (
    <section className="w-full relative pb-20 pt-10" id="locations">
      <div className="text-center mb-10 px-4">
        <h2 className="text-4xl md:text-5xl font-serif text-[#D4AF37] mb-4 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
          {ui.locationsTitle || "Location & Venues"}
        </h2>
        <div className="flex items-center justify-center gap-4">
          <span className="w-16 h-[1px] bg-gradient-to-r from-transparent to-[#D4AF37]/60"></span>
          <span className="text-[#D4AF37] text-xl">✧</span>
          <span className="w-16 h-[1px] bg-gradient-to-l from-transparent to-[#D4AF37]/60"></span>
        </div>
      </div>

      <div className="relative w-full max-w-[1600px] mx-auto min-h-[600px] md:min-h-[700px] md:px-8 border-y md:border border-[#D4AF37]/20 md:rounded-[2rem] overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.6)] group">
        <motion.iframe
          key={iframeSrc}
          initial={{ opacity: 0, scale: 1.02 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8 }}
          src={iframeSrc}
          width="100%"
          height="100%"
          frameBorder="0"
          style={{ border: 0, filter: "contrast(1.05) saturate(1.08)" }}
          allowFullScreen={true}
          tabIndex={0}
          className="absolute inset-0 w-full h-full object-cover z-0"
          title={`Map for ${getLocalizedValue(activeVenue.name, language)}`}
        />

        <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-[#0a0a0a]/55 via-[#0a0a0a]/12 to-transparent pointer-events-none z-0"></div>
        <div className="absolute inset-0 border border-white/5 md:rounded-[2rem] pointer-events-none z-20"></div>

        <div className="absolute bottom-0 left-0 w-full md:w-[420px] md:bottom-auto md:top-1/2 md:-translate-y-1/2 md:left-12 p-4 md:p-0 z-10 flex flex-col gap-3">
          {venues.map((venue, idx) => {
            const isActive = activeIndex === idx;
            const mapLink = venue.googleMapsLink || venue.link || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue.query || getLocalizedValue(venue.location, language) || getLocalizedValue(venue.name, language))}`;

            return (
              <motion.button
                key={`${idx}-${getLocalizedValue(venue.name, language)}`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setActiveIndex(idx)}
                className={`group relative text-left p-5 md:p-6 rounded-2xl transition-all duration-500 overflow-hidden ${
                  isActive
                    ? "bg-black/60 shadow-[0_8px_32px_rgba(0,0,0,0.4)] border border-[#D4AF37]/40 ring-1 ring-[#D4AF37]/10"
                    : "bg-black/30 md:bg-black/40 shadow-lg border border-white/5 hover:border-[#D4AF37]/20 hover:bg-black/50"
                } backdrop-blur-xl`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeVenue"
                    className="absolute right-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#D4AF37] to-[#8A6E2F] shadow-[0_0_15px_#D4AF37]"
                  />
                )}

                <h3 className={`text-xl md:text-2xl font-serif font-medium mb-1 drop-shadow-sm transition-colors duration-300 ${isActive ? "text-[#D4AF37]" : "text-white/80"}`}>
                  {getLocalizedValue(venue.name, language)}
                </h3>
                <p className="text-white/60 text-sm leading-relaxed mb-4 font-body md:font-sans line-clamp-2 md:line-clamp-none">
                  {getLocalizedValue(venue.location, language)}
                </p>

                <div className="flex items-center justify-between gap-3 mt-auto pt-2 border-t border-white/10">
                  <span className={`text-[10px] md:text-xs uppercase tracking-[0.2em] font-medium transition-colors ${isActive ? "text-[#D4AF37]" : "text-white/40"}`}>
                    {isActive
                      ? ui.locationsCurrent || "Currently Viewing"
                      : ui.locationsTap || "Tap to View Map"}
                  </span>

                  <a
                    href={mapLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(event) => event.stopPropagation()}
                    className="inline-flex items-center gap-2 text-xs text-white/70 hover:text-[#D4AF37] transition-all bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-full border border-white/5 hover:border-[#D4AF37]/30"
                  >
                    <span>{ui.directions || "Directions"}</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"></path><path d="M12 5l7 7-7 7"></path></svg>
                  </a>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
