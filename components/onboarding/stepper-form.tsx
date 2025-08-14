"use client";

import { memo, useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { NumberInput } from "@heroui/number-input";
import { Progress } from "@heroui/progress";
import { Select, SelectItem } from "@heroui/select";
import type { Dictionary } from "@/types/dictionary";
import { Icon } from "@iconify/react";

type Props = {
   dict: Dictionary;
   onSubmit: (formData: FormData) => void;
};

export function OnboardingStepperForm({ dict, onSubmit }: Props) {
   const [step, setStep] = useState<number>(0);

   // Local state mirrors form, for validation and selects
   const [age, setAge] = useState<number | null>(null);
   const [country, setCountry] = useState<string>(""); // localized label for UI
   const [countryCode, setCountryCode] = useState<string>(""); // ISO code to submit
   const [countryQuery, setCountryQuery] = useState<string>("");
   const [discovery, setDiscovery] = useState<string>(""); // localized label for UI
   const [discoveryKey, setDiscoveryKey] = useState<string>(""); // canonical key to submit
   const [primaryCurrency, setPrimaryCurrency] = useState<string>("");
   const [userEditedCurrency, setUserEditedCurrency] = useState<boolean>(false);
   const [experienceLevel, setExperienceLevel] = useState<string>(""); // localized label for UI
   const [experienceKey, setExperienceKey] = useState<string>(""); // canonical key to submit
   const [primaryGoal, setPrimaryGoal] = useState<string>(""); // localized label for UI
   const [goalKey, setGoalKey] = useState<string>(""); // canonical key to submit
   const [netWorth, setNetWorth] = useState<string>(""); // raw band label for UI
   const [netWorthValue, setNetWorthValue] = useState<number | "">(""); // numeric to submit
   const [expectations, setExpectations] = useState<string>("");

   const totalSteps = 8;
   const progress = useMemo(() => ((step + 1) / totalSteps) * 100, [step]);

   // Localized options with icons
   const fieldDesc = dict.onboarding?.fieldDescriptions || [];

   const mapCountryIcon = (label: string) => {
      const v = label.toLowerCase();
      if (v.includes("france") || v.includes("francia")) return "twemoji:flag-france";
      if (v.includes("italy") || v.includes("italia")) return "twemoji:flag-italy";
      if (v.includes("united states") || v.includes("stati uniti")) return "twemoji:flag-united-states";
      if (v.includes("united kingdom") || v.includes("regno unito")) return "twemoji:flag-united-kingdom";
      if (v.includes("germany") || v.includes("germania")) return "twemoji:flag-germany";
      if (v.includes("spain") || v.includes("spagna")) return "twemoji:flag-spain";
      if (v.includes("switzerland") || v.includes("svizzera")) return "twemoji:flag-switzerland";
      if (v.includes("belgium") || v.includes("belgio")) return "twemoji:flag-belgium";
      if (v.includes("canada")) return "twemoji:flag-canada";
      if (v.includes("australia")) return "twemoji:flag-australia";
      if (v.includes("netherlands") || v.includes("paesi bassi")) return "twemoji:flag-netherlands";
      if (v.includes("sweden") || v.includes("svezia")) return "twemoji:flag-sweden";
      if (v.includes("norway") || v.includes("norvegia")) return "twemoji:flag-norway";
      if (v.includes("denmark") || v.includes("danimarca")) return "twemoji:flag-denmark";
      if (v.includes("austria")) return "twemoji:flag-austria";
      if (v.includes("portugal") || v.includes("portogallo")) return "twemoji:flag-portugal";
      if (v.includes("ireland") || v.includes("irlanda")) return "twemoji:flag-ireland";
      if (v.includes("poland") || v.includes("polonia")) return "twemoji:flag-poland";
      if (v.includes("greece") || v.includes("grecia")) return "twemoji:flag-greece";
      if (v.includes("india")) return "twemoji:flag-india";
      if (v.includes("japan") || v.includes("giappone")) return "twemoji:flag-japan";
      if (v.includes("china") || v.includes("cina")) return "twemoji:flag-china";
      if (v.includes("brazil") || v.includes("brasile")) return "twemoji:flag-brazil";
      if (v.includes("mexico") || v.includes("messico")) return "twemoji:flag-mexico";
      if (v.includes("argentina")) return "twemoji:flag-argentina";
      if (v.includes("south africa") || v.includes("sudafrica")) return "twemoji:flag-south-africa";
      if (v.includes("united arab emirates") || v.includes("emirati arabi")) return "twemoji:flag-united-arab-emirates";
      if (v.includes("singapore")) return "twemoji:flag-singapore";
      if (v.includes("hong kong")) return "twemoji:flag-hong-kong-sar-china";
      if (v.includes("new zealand") || v.includes("nuova zelanda")) return "twemoji:flag-new-zealand";
      return "fluent-emoji-flat:globe-showing-americas";
   };

   const mapDiscoveryIcon = (label: string) => {
      const v = label.toLowerCase();
      if (v.includes("youtube")) return "qlementine-icons:youtube-fill-24";
      if (v.includes("blog") || v.includes("articolo") || v.includes("article")) return "solar:document-text-linear";
      if (v.includes("search") || v.includes("motore")) return "material-symbols:search-rounded";
      if (v.includes("friend") || v.includes("amici") || v.includes("family") || v.includes("famiglia")) return "solar:users-group-rounded-outline";
      if (v.includes("linkedin")) return "brandico:linkedin-rect";
      if (v.includes("facebook") || v.includes("instagram")) return "mingcute:meta-fill";
      if (v.includes("tiktok")) return "ic:baseline-tiktok";
      if (v === "x" || v.includes(" twitter") || v.includes(" x ") || v.startsWith("x")) return "ri:twitter-x-fill";
      if (v.includes("google")) return "logos:google-icon";
      if (v.includes("social")) return "solar:share-line-duotone";
      return "solar:alt-arrow-down-linear";
   };

   const mapExperienceIcon = (label: string) => {
      const v = label.toLowerCase();
      if (
         v.includes("totally new") ||
         v.includes("nuovo") ||
         v.includes("beginner") ||
         v.includes("principiante")
      ) {
         return "solar:seedling-outline"; // getting started
      }
      if (
         v.includes("basic") ||
         v.includes("base")
      ) {
         return "solar:book-2-linear"; // basic understanding
      }
      if (
         v.includes("for a while") ||
         v.includes("da un po") ||
         v.includes("intermediate") ||
         v.includes("intermedio")
      ) {
         return "iconamoon:trend-up-fill"; // growing experience
      }
      if (
         v.includes("expert") ||
         v.includes("esperto")
      ) {
         return "solar:medal-ribbons-star-linear"; // expert level
      }
      return "solar:chart-2-line-duotone";
   };

   const mapGoalIcon = (label: string) => {
      const v = label.toLowerCase();
      if (v.includes("grow my wealth") || v.includes("crescere il mio patrimonio")) return "hugeicons:plant-03";
      if (v.includes("financial freedom") || v.includes("libertà finanziaria")) return "fluent-emoji-high-contrast:broken-chain";
      if (v.includes("estate") || v.includes("patrimonio")) return "stash:plan";
      if (v.includes("major purchase") || v.includes("grande acquisto")) return "solar:bag-3-linear";
      if (v.includes("retirement") || v.includes("pensione")) return "solar:calendar-linear";
      if (v.includes("assess") || v.includes("valutare")) return "solar:chart-2-line-duotone";
      if (v.includes("budget")) return "solar:wallet-money-linear";
      return "solar:stars-line-duotone";
   };

   const countryOptions = (dict.onboarding?.options?.countries || [
      "France",
      "United States",
      "Switzerland",
      "Belgium",
      "United Kingdom",
      "Germany",
      "Spain",
      "Italy",
      "Other",
   ]).map((label) => ({ key: label, label, icon: mapCountryIcon(label) }));

   const discoveryOptions = (dict.onboarding?.options?.discovery || [
      "Friends or Family",
      "Blog or Article",
      "X",
      "Podcast",
      "Youtube",
      "LinkedIn",
      "Search Engine",
      "TikTok",
      "Other",
   ]).map((label) => ({ key: label, label, icon: mapDiscoveryIcon(label) }));

   const experienceOptions = (dict.onboarding?.options?.experience || [
      "Beginner",
      "Intermediate",
      "Advanced",
   ]).map((label) => ({ key: label, label, icon: mapExperienceIcon(label) }));

   const goalOptions = (dict.onboarding?.options?.goals || [
      "Grow my wealth",
      "Achieve financial freedom",
      "Plan my estate",
      "Save for a major purchase",
      "Prepare for retirement",
      "Assess my situation",
      "Other",
   ]).map((label) => ({ key: label, label, icon: mapGoalIcon(label) }));

   // Currency options (editable by user)
   const currencyOptions = useMemo(() => ([
      { code: "EUR", name: "Euro" , symbol: "€"},
      { code: "USD", name: "US Dollar" , symbol: "$"},
      { code: "GBP", name: "British Pound" , symbol: "£"},
      { code: "CHF", name: "Swiss Franc" , symbol: "CHF"},
      { code: "CAD", name: "Canadian Dollar" , symbol: "CA$"},
      { code: "AUD", name: "Australian Dollar" , symbol: "A$"},
      { code: "JPY", name: "Japanese Yen" , symbol: "¥"},
      { code: "INR", name: "Indian Rupee" , symbol: "₹"},
      { code: "MXN", name: "Mexican Peso" , symbol: "MX$"},
      { code: "BRL", name: "Brazilian Real" , symbol: "R$"},
      { code: "ARS", name: "Argentine Peso" , symbol: "ARS"},
      { code: "ZAR", name: "South African Rand" , symbol: "ZAR"},
      { code: "SGD", name: "Singapore Dollar" , symbol: "S$"},
      { code: "HKD", name: "Hong Kong Dollar" , symbol: "HK$"},
      { code: "NZD", name: "New Zealand Dollar" , symbol: "NZ$"},
      { code: "PLN", name: "Polish Zloty" , symbol: "PLN"},
      { code: "NOK", name: "Norwegian Krone" , symbol: "NOK"},
      { code: "SEK", name: "Swedish Krona" , symbol: "SEK"},
      { code: "DKK", name: "Danish Krone" , symbol: "DKK"},
      { code: "AED", name: "UAE Dirham" , symbol: "AED"},
   ]), []);

   const currencyByCode = useMemo(() => {
      const m = new Map<string, { code: string; name: string; symbol?: string }>();
      currencyOptions.forEach((c) => m.set(c.code, c));
      return m;
   }, [currencyOptions]);

   const deferredQuery = useDeferredValue(countryQuery);
   const filteredCountries = useMemo(() => {
      const q = deferredQuery.trim().toLowerCase();
      if (!q) return countryOptions;
      return countryOptions.filter((c) => c.label.toLowerCase().includes(q));
   }, [deferredQuery, countryOptions]);

   const sortedFilteredCountries = useMemo(() => {
      return [...filteredCountries].sort((a, b) => a.label.localeCompare(b.label));
   }, [filteredCountries]);

   // Helpers to standardize values
   const mapDiscoveryToKey = (label: string): string => {
      const v = label.toLowerCase();
      if (v.includes("youtube")) return "youtube";
      if (v.includes("blog")) return "blog";
      if (v.includes("search") || v.includes("motore")) return "search";
      if (v.includes("friend") || v.includes("amici") || v.includes("family") || v.includes("famiglia")) return "friends";
      if (v.includes("linkedin")) return "linkedin";
      if (v.includes("facebook") || v.includes("instagram")) return "meta";
      if (v.includes("tiktok")) return "tiktok";
      if (v.includes(" x") || v.startsWith("x") || v.includes("twitter")) return "x";
      return v;
   };

   const mapExperienceToKey = (label: string): string => {
      const v = label.toLowerCase();
      if (v.includes("totally") || v.includes("pivello") || v.includes("beginner") || v.includes("nuovo")) return "new";
      if (v.includes("basic") || v.includes("base")) return "basic";
      if (v.includes("for a while") || v.includes("da un po") || v.includes("intermedio") || v.includes("intermediate")) return "intermediate";
      if (v.includes("expert") || v.includes("esperto")) return "expert";
      return v;
   };

   const mapGoalToKey = (label: string): string => {
      const v = label.toLowerCase();
      if (v.includes("grow") || v.includes("crescere")) return "grow_wealth";
      if (v.includes("freedom") || v.includes("libert")) return "financial_freedom";
      if (v.includes("estate") || v.includes("patrimonio")) return "estate";
      if (v.includes("purchase") || v.includes("acquisto")) return "major_purchase";
      if (v.includes("retire") || v.includes("pension")) return "retirement";
      if (v.includes("assess") || v.includes("valut")) return "assess";
      return "other";
   };

   const resolveCountryCode = (label: string): string => {
      const v = label.toLowerCase();
      if (/(italy|italia)/.test(v)) return "IT";
      if (/(france|francia)/.test(v)) return "FR";
      if (/(spain|spagna)/.test(v)) return "ES";
      if (/(germany|germania)/.test(v)) return "DE";
      if (/(belgium|belgio)/.test(v)) return "BE";
      if (/(switzerland|svizzera)/.test(v)) return "CH";
      if (/(united kingdom|regno unito)/.test(v)) return "GB";
      if (/(united states|stati uniti)/.test(v)) return "US";
      if (/canada/.test(v)) return "CA";
      if (/australia/.test(v)) return "AU";
      if (/(japan|giappone)/.test(v)) return "JP";
      if (/india/.test(v)) return "IN";
      if (/(mexico|messico)/.test(v)) return "MX";
      if (/(brazil|brasile|brasil)/.test(v)) return "BR";
      if (/argentina/.test(v)) return "AR";
      if (/(south africa|sudafrica)/.test(v)) return "ZA";
      if (/singapore/.test(v)) return "SG";
      if (/(hong kong)/.test(v)) return "HK";
      if (/(new zealand|nuova zelanda)/.test(v)) return "NZ";
      if (/(portugal|portogallo)/.test(v)) return "PT";
      if (/(ireland|irlanda)/.test(v)) return "IE";
      if (/(poland|polonia)/.test(v)) return "PL";
      if (/(greece|grecia)/.test(v)) return "GR";
      if (/austria/.test(v)) return "AT";
      if (/(norway|norvegia)/.test(v)) return "NO";
      if (/(sweden|svezia)/.test(v)) return "SE";
      if (/(denmark|danimarca)/.test(v)) return "DK";
      if (/(netherlands|paesi bassi)/.test(v)) return "NL";
      if (/(united arab emirates|emirati arabi)/.test(v)) return "AE";
      return label;
   };

   // Suggest a primary currency based on the selected country (i18n-aware)
   useEffect(() => {
      const c = (country || "").toLowerCase();
      let code = "";
      if (/(france|francia)/.test(c)) code = "EUR";
      else if (/(italy|italia)/.test(c)) code = "EUR";
      else if (/(spain|spagna)/.test(c)) code = "EUR";
      else if (/(germany|germania)/.test(c)) code = "EUR";
      else if (/(belgium|belgio)/.test(c)) code = "EUR";
      else if (/(switzerland|svizzera)/.test(c)) code = "CHF";
      else if (/(united kingdom|regno unito)/.test(c)) code = "GBP";
      else if (/(united states|stati uniti)/.test(c)) code = "USD";
      else if (/canada/.test(c)) code = "CAD";
      else if (/australia/.test(c)) code = "AUD";
      else if (/(japan|giappone)/.test(c)) code = "JPY";
      else if (/india/.test(c)) code = "INR";
      else if (/(mexico|messico)/.test(c)) code = "MXN";
      else if (/(brazil|brasil|brasile)/.test(c)) code = "BRL";
      else if (/argentina/.test(c)) code = "ARS";
      else if (/(south africa|sudafrica)/.test(c)) code = "ZAR";
      else if (/singapore/.test(c)) code = "SGD";
      else if (/(hong kong)/.test(c)) code = "HKD";
      else if (/(new zealand|nuova zelanda)/.test(c)) code = "NZD";
      else if (/(portugal|portogallo)/.test(c)) code = "EUR";
      else if (/(ireland|irlanda)/.test(c)) code = "EUR";
      else if (/(poland|polonia)/.test(c)) code = "PLN";
      else if (/(greece|grecia)/.test(c)) code = "EUR";
      else if (/austria/.test(c)) code = "EUR";
      else if (/(norway|norvegia)/.test(c)) code = "NOK";
      else if (/(sweden|svezia)/.test(c)) code = "SEK";
      else if (/(denmark|danimarca)/.test(c)) code = "DKK";
      else if (/(netherlands|paesi bassi)/.test(c)) code = "EUR";
      else if (/(united arab emirates|emirati arabi)/.test(c)) code = "AED";

      if (!userEditedCurrency) {
         setPrimaryCurrency(code);
      }
   }, [country, userEditedCurrency]);

   const canProceed = useMemo(() => {
      if (step === 0) return typeof age === 'number' && age >= 18;
      if (step === 1) return !!country && !!primaryCurrency;
      if (step === 2) return !!discovery;
      if (step === 3) return !!experienceLevel;
      if (step === 4) return !!primaryGoal;
      if (step === 5) return !!netWorth;
      if (step === 6) return !!expectations;
      return true;
   }, [step, age, country, primaryCurrency, discovery, experienceLevel, primaryGoal, netWorth, expectations]);

   const fieldIndexForStep = (s: number) => (s >= 0 && s <= 6 ? s : -1);
   const currentFieldIndex = fieldIndexForStep(step);
   const currentTitle = currentFieldIndex >= 0 ? dict.onboarding?.whatItems?.[currentFieldIndex] : undefined;
   const currentDesc = currentFieldIndex >= 0 ? (dict.onboarding?.fieldDescriptions || [])[currentFieldIndex] : undefined;

   const OptionTile = ({
      label,
      selected,
      icon,
      onPress,
   }: { label: string; selected: boolean; icon?: string | null; onPress: () => void }) => (
      <button
         type="button"
         onClick={onPress}
         className={`group flex w-full items-center gap-3 rounded-large border p-4 text-left transition-colors ${selected ? "border-primary/60 bg-primary/5 text-primary" : "border-default-200/60 bg-background/60 hover:border-default-300 hover:bg-default-100/50"
            }`}
      >
        {icon === null ? null : (
          <span className={`flex h-8 w-8 items-center justify-center rounded-full ${selected ? "bg-primary/20 text-primary" : "bg-default-100 text-foreground-500"}`}>
            {icon ? <Icon icon={icon} width={18} height={18} /> : <Icon icon="solar:checklist-minimalistic-linear" width={18} height={18} />}
          </span>
        )}
         <span className="text-[15px]">{label}</span>
      </button>
   );

   return (
      <form action={onSubmit} className="mt-6 flex w-full flex-col gap-6">
         <div className="flex items-center justify-between">
            <Progress aria-label="Progress" value={progress} className="w-full" />
         </div>

         {currentTitle && (
            <div className="space-y-1">
               <h2 className="text-2xl font-semibold tracking-tight">{currentTitle}</h2>
               {currentDesc && <p className="text-sm text-foreground-500">{currentDesc}</p>}
            </div>
         )}

          {step === 0 && (
            <NumberInput
              name="age"
              label={dict.onboarding?.whatItems?.[0]}
              minValue={18}
              step={1}
              isRequired
              value={age ?? undefined}
              onValueChange={(v) => setAge(typeof v === 'number' ? v : null)}
              validationBehavior="native"
            />
          )}

          {step === 1 && (
            <div className="flex flex-col gap-3">
               <Input
                  aria-label="country-search"
                  placeholder={dict.onboarding?.searchPlaceholder || "Search country..."}
                  value={countryQuery}
                  onChange={(e) => setCountryQuery(e.target.value)}
               />
                <div className="flex max-h-60 flex-col gap-3 overflow-y-auto">
                  {sortedFilteredCountries.map((opt) => (
                     <OptionTile
                       key={opt.key}
                       label={opt.label}
                       icon={opt.icon}
                       selected={country === opt.label}
                       onPress={() => {
                         setCountry(opt.label);
                         setCountryCode(resolveCountryCode(opt.label));
                       }}
                     />
                  ))}
               </div>
               <div className="grid grid-cols-1 gap-2">
                  <Select
                   aria-label={dict.onboarding?.currencyLabel || "Primary currency"}
                   label={dict.onboarding?.currencyLabel || "Primary currency"}
                   selectedKeys={primaryCurrency ? new Set([primaryCurrency]) : new Set([])}
                   onSelectionChange={(keys) => {
                     setPrimaryCurrency(Array.from(keys)[0] as string);
                     setUserEditedCurrency(true);
                   }}
                   disallowEmptySelection
                    isVirtualized
                    itemHeight={36}
                    maxListboxHeight={256}
                   renderValue={() => {
                      if (!primaryCurrency) return null;
                      const selectedOption = currencyByCode.get(primaryCurrency);
                     return (
                       <span className="flex items-center gap-2">
                         <span>
                           {selectedOption?.name || ""} ({selectedOption?.symbol})
                         </span>
                       </span>
                     );
                   }}
                 >
                    {currencyOptions.map((c) => (
                     <SelectItem
                       key={c.code}
                       textValue={`${c.code} — ${c.name}`}
                       
                     >
                       <span className="flex w-full items-center justify-between">
                         <span>{c.name} ({c.symbol})</span>
                       </span>
                     </SelectItem>
                   ))}
                 </Select>
               </div>
                <input type="hidden" name="country" value={countryCode || resolveCountryCode(country)} />
                <input type="hidden" name="country_label" value={country} />
               <input type="hidden" name="primaryCurrency" value={primaryCurrency} />
            </div>
          )}

         {step === 2 && (
            <div className="flex flex-col gap-3">
               <div className="flex max-h-60 flex-col gap-3 overflow-y-auto">
                  {discoveryOptions.map((opt) => (
                     <OptionTile key={opt.key} label={opt.label} icon={opt.icon} selected={discovery === opt.label}
                       onPress={() => { setDiscovery(opt.label); setDiscoveryKey(mapDiscoveryToKey(opt.label)); }} />
                  ))}
               </div>
                <input type="hidden" name="discovery" value={discoveryKey || mapDiscoveryToKey(discovery)} />
            </div>
         )}

         {step === 3 && (
            <div className="flex flex-col gap-3">
               <div className="flex max-h-60 flex-col gap-3 overflow-y-auto">
                  {experienceOptions.map((opt) => (
                     <OptionTile key={opt.key} label={opt.label} icon={opt.icon} selected={experienceLevel === opt.label}
                       onPress={() => { setExperienceLevel(opt.label); setExperienceKey(mapExperienceToKey(opt.label)); }} />
                  ))}
                <input type="hidden" name="experienceLevel" value={experienceKey || mapExperienceToKey(experienceLevel)} />
               </div>
            </div>
         )}

         {step === 4 && (
            <div className="flex flex-col gap-3">
               <div className="flex max-h-60 flex-col gap-3 overflow-y-auto">
                  {goalOptions.map((opt) => (
                     <OptionTile key={opt.key} label={opt.label} icon={opt.icon} selected={primaryGoal === opt.label}
                       onPress={() => { setPrimaryGoal(opt.label); setGoalKey(mapGoalToKey(opt.label)); }} />
                  ))}
               </div>
                <input type="hidden" name="primaryGoal" value={goalKey || mapGoalToKey(primaryGoal)} />
            </div>
         )}

          {step === 5 && (
            <div className="flex flex-col gap-3">
               <div className="flex max-h-60 flex-col gap-3 overflow-y-auto">
                  {(() => {
                    const sym = currencyOptions.find(c => c.code === primaryCurrency)?.symbol || "";
                    const fmt = (n: number) => new Intl.NumberFormat(undefined).format(n);
                    const options = [
                      { key: "lt50", label: (dict.onboarding?.netWorthLabels?.lessThan || "Less than {amount}").replace("{amount}", `${sym}${fmt(50000)}`), raw: "< 50,000" },
                      { key: "50-200", label: (dict.onboarding?.netWorthLabels?.between || "Between {min} and {max}").replace("{min}", `${sym}${fmt(50000)}`).replace("{max}", `${sym}${fmt(200000)}`), raw: "50,000 - 200,000" },
                      { key: "200-500", label: (dict.onboarding?.netWorthLabels?.between || "Between {min} and {max}").replace("{min}", `${sym}${fmt(200000)}`).replace("{max}", `${sym}${fmt(500000)}`), raw: "200,000 - 500,000" },
                      { key: "500-1m", label: (dict.onboarding?.netWorthLabels?.between || "Between {min} and {max}").replace("{min}", `${sym}${fmt(500000)}`).replace("{max}", `${sym}${fmt(1000000)}`), raw: "500,000 - 1,000,000" },
                      { key: ">1m", label: (dict.onboarding?.netWorthLabels?.moreThan || "More than {amount}").replace("{amount}", `${sym}${fmt(1000000)}`), raw: "> 1,000,000" },
                    ];
                    return options.map(o => (
                      <OptionTile
                        key={o.key}
                        label={o.label}
                        icon={null}
                        selected={netWorth === o.raw}
                        onPress={() => { setNetWorth(o.raw); setNetWorthValue(
                          o.raw === "< 50,000" ? 50000 :
                          o.raw === "50,000 - 200,000" ? 200000 :
                          o.raw === "200,000 - 500,000" ? 500000 :
                          o.raw === "500,000 - 1,000,000" ? 1000000 : 1000000
                        ); }}
                      />
                    ));
                  })()}
               </div>
            </div>
          )}

         {step === 6 && (
            <div className="flex flex-col">
               <textarea
                  name="expectations"
                  required
                  value={expectations}
                  onChange={(e) => setExpectations(e.target.value)}
                  className="min-h-24 rounded-large border border-default-200 bg-background/60 p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
               />
            </div>
         )}

          {step === 7 && (
            <div className="space-y-3 text-sm text-foreground-600">
               <div className="flex items-center justify-between"><span>{dict.onboarding?.whatItems?.[0]}</span><span className="font-medium">{age}</span></div>
               <div className="flex items-center justify-between"><span>{dict.onboarding?.whatItems?.[1]}</span><span className="font-medium">{country} ({countryCode || resolveCountryCode(country)})</span></div>
               <div className="flex items-center justify-between"><span>{dict.onboarding?.whatItems?.[2]}</span><span className="font-medium">{discovery}</span></div>
               <div className="flex items-center justify-between"><span>{dict.onboarding?.whatItems?.[3]}</span><span className="font-medium">{experienceLevel}</span></div>
               <div className="flex items-center justify-between"><span>{dict.onboarding?.whatItems?.[4]}</span><span className="font-medium">{primaryGoal}</span></div>
               <div className="flex items-center justify-between"><span>{dict.onboarding?.whatItems?.[5]}</span><span className="font-medium">{netWorth}</span></div>
               <div className="flex items-center justify-between"><span>{dict.onboarding?.whatItems?.[6]}</span><span className="font-medium">{expectations}</span></div>
            </div>
         )}

         <div className="mt-2 flex items-center justify-between gap-3">
             <Button type="button" variant="flat" radius="full" onPress={() => setStep((s) => Math.max(0, s - 1))} isDisabled={step === 0} startContent={<Icon icon="solar:arrow-left-linear" />}>
               {dict.onboarding?.back || "Back"}
            </Button>
            {step < totalSteps - 1 ? (
                <Button type="button" color="primary" radius="full" onPress={() => {
                if (!canProceed) return;
                setTimeout(() => {
                    setStep((s) => Math.min(totalSteps - 1, s + 1));
                }, 0);
                }} isDisabled={!canProceed} endContent={<Icon icon="solar:arrow-right-linear" />}>
                  {dict.onboarding?.next || "Next"}
               </Button>
            ) : (
               <Button color="primary" radius="full" type="submit" isDisabled={!canProceed} endContent={<Icon icon="solar:check-circle-linear" />}>
                  {dict.onboarding?.primaryCta}
               </Button>
            )}
         </div>

         {/* Hidden mirrors to ensure all values submit even if not visible */}
          <input type="hidden" name="age" value={age != null ? String(age) : ""} />
          <input type="hidden" name="country" value={countryCode || resolveCountryCode(country)} />
          <input type="hidden" name="country_label" value={country} />
          <input type="hidden" name="discovery" value={discoveryKey || mapDiscoveryToKey(discovery)} />
          <input type="hidden" name="experienceLevel" value={experienceKey || mapExperienceToKey(experienceLevel)} />
          <input type="hidden" name="primaryGoal" value={goalKey || mapGoalToKey(primaryGoal)} />
          <input type="hidden" name="netWorth" value={netWorthValue !== "" ? String(netWorthValue) : ""} />
         <input type="hidden" name="expectations" value={expectations} />
      </form>
   );
}


