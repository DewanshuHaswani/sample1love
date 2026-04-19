import { useEffect, useMemo, useState } from "react";
import GlassSurface from "./GlassSurface";
import "./FamilySection.css";

type LocalizedValue = string | Record<string, string>;

type FamilyGroup = {
  label?: LocalizedValue;
  members?: LocalizedValue[];
  [key: string]: LocalizedValue | LocalizedValue[] | undefined;
};

type FamilySide = {
  title?: LocalizedValue;
  [key: string]: LocalizedValue | FamilyGroup | undefined;
};

type WeddingData = {
  defaultLanguage?: string;
  isGroomSide?: boolean;
  couple?: {
    groomFullName?: LocalizedValue;
    brideFullName?: LocalizedValue;
  };
  family?: {
    groom?: FamilySide;
    bride?: FamilySide;
  };
  ui?: Record<string, Record<string, string>>;
};

function getLocalizedValue(value: LocalizedValue | undefined, lang: string, fallback = "en") {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value[lang] || value[fallback] || Object.values(value)[0] || "";
}

function getGroupMembers(group: FamilyGroup | undefined, lang: string) {
  if (!group) return [];
  if (Array.isArray(group.members)) {
    return group.members.map((member) => getLocalizedValue(member, lang)).filter(Boolean);
  }

  return Object.entries(group)
    .filter(([key, value]) => key !== "label" && key !== "members" && value)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, value]) => getLocalizedValue(value as LocalizedValue, lang))
    .filter(Boolean);
}

function getFamilySections(
  family: FamilySide | undefined,
  lang: string,
  labels: Record<string, string>
) {
  if (!family) return [];

  const priority = ["parents", "grandparents"];

  return Object.entries(family)
    .filter(([key, value]) => key !== "title" && value && typeof value === "object" && !Array.isArray(value))
    .map(([key, value]) => {
      const group = value as FamilyGroup;
      const members = getGroupMembers(group, lang);
      if (members.length === 0) return null;

      const fallbackLabel =
        labels[`${key}Label`] ||
        key.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase());

      return {
        key,
        label: getLocalizedValue(group.label, lang) || fallbackLabel,
        members,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const aKey = (a as { key: string }).key;
      const bKey = (b as { key: string }).key;
      const aIndex = priority.includes(aKey) ? priority.indexOf(aKey) : priority.length + 1;
      const bIndex = priority.includes(bKey) ? priority.indexOf(bKey) : priority.length + 1;
      return aIndex - bIndex;
    }) as Array<{ key: string; label: string; members: string[] }>;
}

export function FamilySection() {
  const [data, setData] = useState<WeddingData | null>(null);
  const [language, setLanguage] = useState("en");

  useEffect(() => {
    fetch("/weddingData.json")
      .then((res) => res.json())
      .then((payload: WeddingData) => {
        setData(payload);
        setLanguage(document.documentElement.lang || payload.defaultLanguage || "en");
      })
      .catch((err) => console.error("Could not load family data", err));
  }, []);

  useEffect(() => {
    const handleLanguageChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ lang?: string }>;
      setLanguage(customEvent.detail?.lang || document.documentElement.lang || "en");
    };

    window.addEventListener("wedding-language-change", handleLanguageChange);
    return () => window.removeEventListener("wedding-language-change", handleLanguageChange);
  }, []);

  const orderedSides = useMemo(() => {
    if (!data) return ["groom", "bride"] as const;
    return data.isGroomSide ? (["groom", "bride"] as const) : (["bride", "groom"] as const);
  }, [data]);

  if (!data?.family || !data?.couple) return null;

  const labels = data.ui?.[language] || data.ui?.en || {};

  return (
    <div className="family-react">
      <div className="family-react__grid">
        {orderedSides.map((side) => {
          const family = data.family?.[side];
          if (!family) return null;

          const heading =
            side === "groom"
              ? getLocalizedValue(data.couple?.groomFullName, language)
              : getLocalizedValue(data.couple?.brideFullName, language);

          const sections = getFamilySections(family, language, labels);

          return (
            <GlassSurface
              key={side}
              className="family-react__card"
              width="100%"
              height="auto"
              borderRadius={28}
              borderWidth={0.09}
              brightness={78}
              opacity={0.72}
              blur={12}
              displace={4}
              backgroundOpacity={0.04}
              saturation={1.2}
              distortionScale={-92}
              redOffset={2}
              greenOffset={8}
              blueOffset={14}
              mixBlendMode="screen"
            >
              <div className="family-react__inner">
                <h3 className="family-react__title">{heading}</h3>
                <div className="family-react__sections">
                  {sections.map((section) => (
                    <section key={section.key} className="family-react__section">
                      <span className="family-react__label">{section.label}</span>
                      <div className={`family-react__names family-react__names--count-${Math.min(section.members.length, 4)}`}>
                        {section.members.map((name) => (
                          <span key={`${section.key}-${name}`} className="family-react__name">{name}</span>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              </div>
            </GlassSurface>
          );
        })}
      </div>
    </div>
  );
}
