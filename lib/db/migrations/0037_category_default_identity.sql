ALTER TABLE "categories" ADD COLUMN "default_key" text;
--> statement-breakpoint
-- Conservatively identify untouched legacy defaults; custom labels remain unmarked.
UPDATE "categories" SET "default_key" = 'affitto' WHERE "default_key" IS NULL AND "name" IN ('Affitto & Mutuo', 'Rent & Mortgage', 'Miete & Immobilienkredit') AND "type" = 'dovuta' AND "icon" = 'home' AND "is_fallback" = false AND ("description" IN ('Affitto, rata del mutuo, condominio', 'Rent, mortgage payment, service charges', 'Miete, Kreditrate, Hausgeld'));
--> statement-breakpoint
UPDATE "categories" SET "default_key" = 'bollette' WHERE "default_key" IS NULL AND "name" IN ('Bollette & Telefono', 'Utilities & Phone', 'Versorgung & Telefon') AND "type" = 'dovuta' AND "icon" = 'zap' AND "is_fallback" = false AND ("description" IN ('Luce, gas, acqua, internet, cellulare', 'Electricity, gas, water, internet, mobile', 'Strom, Gas, Wasser, Internet, Mobilfunk'));
--> statement-breakpoint
UPDATE "categories" SET "default_key" = 'spesa' WHERE "default_key" IS NULL AND "name" IN ('Spesa', 'Groceries', 'Lebensmittel') AND "type" = 'dovuta' AND "icon" = 'shopping-cart' AND "is_fallback" = false AND ("description" IN ('Supermercato, alimentari, casalinghi', 'Supermarkets, groceries, household supplies', 'Supermarkt, Lebensmittel, Haushaltswaren'));
--> statement-breakpoint
UPDATE "categories" SET "default_key" = 'trasporti' WHERE "default_key" IS NULL AND "name" IN ('Trasporti', 'Transport', 'Verkehr') AND "type" = 'dovuta' AND "icon" = 'car' AND "is_fallback" = false AND ("description" IN ('Carburante, mezzi pubblici, pedaggi, parcheggi, officina', 'Fuel, public transport, tolls, parking, repairs', 'Kraftstoff, Nahverkehr, Maut, Parken, Werkstatt'));
--> statement-breakpoint
UPDATE "categories" SET "default_key" = 'salute' WHERE "default_key" IS NULL AND "name" IN ('Salute', 'Health', 'Gesundheit') AND "type" = 'dovuta' AND "icon" = 'pill' AND "is_fallback" = false AND ("description" IN ('Farmacia, visite, dentista, analisi', 'Pharmacy, appointments, dentist, tests', 'Apotheke, Arztbesuche, Zahnarzt, Untersuchungen'));
--> statement-breakpoint
UPDATE "categories" SET "default_key" = 'assicurazioni' WHERE "default_key" IS NULL AND "name" IN ('Assicurazioni', 'Insurance', 'Versicherungen') AND "type" = 'dovuta' AND "icon" = 'shield' AND "is_fallback" = false AND ("description" IN ('Auto, casa, vita, salute', 'Car, home, life, health', 'Auto, Haus, Leben, Gesundheit'));
--> statement-breakpoint
UPDATE "categories" SET "default_key" = 'rate' WHERE "default_key" IS NULL AND "name" IN ('Rate & Prestiti', 'Loans & Instalments', 'Kredite & Raten') AND "type" = 'dovuta' AND "icon" = 'credit-card' AND "is_fallback" = false AND ("description" IN ('Finanziamenti, prestiti, acquisti a rate', 'Loans, borrowing, instalment purchases', 'Kredite, Darlehen, Ratenkäufe'));
--> statement-breakpoint
UPDATE "categories" SET "default_key" = 'ristoranti' WHERE "default_key" IS NULL AND "name" IN ('Ristoranti & Bar', 'Restaurants & Cafés') AND "type" = 'voluta' AND "icon" = 'utensils' AND "is_fallback" = false AND ("description" IN ('Pranzi e cene fuori, bar, caffè, consegne a domicilio', 'Eating out, cafés, coffee, takeaway', 'Restaurants, Cafés, Kaffee, Lieferdienste'));
--> statement-breakpoint
UPDATE "categories" SET "default_key" = 'abbonamenti' WHERE "default_key" IS NULL AND "name" IN ('Abbonamenti', 'Subscriptions', 'Abonnements') AND "type" = 'voluta' AND "icon" = 'tv' AND "is_fallback" = false AND ("description" IN ('Streaming, musica, app, software, giornali', 'Streaming, music, apps, software, newspapers', 'Streaming, Musik, Apps, Software, Zeitungen'));
--> statement-breakpoint
UPDATE "categories" SET "default_key" = 'svago' WHERE "default_key" IS NULL AND "name" IN ('Svago', 'Leisure', 'Freizeit') AND "type" = 'voluta' AND "icon" = 'gamepad-2' AND "is_fallback" = false AND ("description" IN ('Cinema, concerti, hobby, giochi, libri', 'Cinema, concerts, hobbies, games, books', 'Kino, Konzerte, Hobbys, Spiele, Bücher'));
--> statement-breakpoint
UPDATE "categories" SET "default_key" = 'benessere' WHERE "default_key" IS NULL AND "name" IN ('Sport & Benessere', 'Sport & Wellbeing', 'Sport & Wohlbefinden') AND "type" = 'voluta' AND "icon" = 'dumbbell' AND "is_fallback" = false AND ("description" IN ('Palestra, sport, parrucchiere, estetista', 'Gym, sports, hairdresser, beauty', 'Fitnessstudio, Sport, Friseur, Kosmetik'));
--> statement-breakpoint
UPDATE "categories" SET "default_key" = 'shopping' WHERE "default_key" IS NULL AND "name" IN ('Shopping') AND "type" = 'voluta' AND "icon" = 'shopping-bag' AND "is_fallback" = false AND ("description" IN ('Vestiti, scarpe, elettronica, acquisti online', 'Clothes, shoes, electronics, online shopping', 'Kleidung, Schuhe, Elektronik, Onlinekäufe'));
--> statement-breakpoint
UPDATE "categories" SET "default_key" = 'viaggi' WHERE "default_key" IS NULL AND "name" IN ('Viaggi', 'Travel', 'Reisen') AND "type" = 'voluta' AND "icon" = 'plane' AND "is_fallback" = false AND ("description" IN ('Voli, treni per le vacanze, hotel, case vacanza', 'Flights, holiday trains, hotels, holiday homes', 'Flüge, Urlaubsreisen, Hotels, Ferienwohnungen'));
--> statement-breakpoint
UPDATE "categories" SET "default_key" = 'contanti' WHERE "default_key" IS NULL AND "name" IN ('Contanti', 'Cash', 'Bargeld') AND "type" = 'voluta' AND "icon" = 'wallet' AND "is_fallback" = false AND ("description" IN ('Prelievi al bancomat', 'Cash withdrawals', 'Bargeldabhebungen'));
--> statement-breakpoint
UPDATE "categories" SET "default_key" = 'risparmio' WHERE "default_key" IS NULL AND "name" IN ('Risparmio', 'Savings', 'Sparen') AND "type" = 'futuro' AND "icon" = 'piggy-bank' AND "is_fallback" = false AND ("description" IN ('Versamenti sul conto deposito o sul salvadanaio', 'Deposits into savings accounts or savings pots', 'Einzahlungen auf Sparkonten oder Sparziele'));
--> statement-breakpoint
UPDATE "categories" SET "default_key" = 'investimenti' WHERE "default_key" IS NULL AND "name" IN ('Investimenti', 'Investments', 'Anlagen') AND "type" = 'futuro' AND "icon" = 'coins' AND "is_fallback" = false AND ("description" IN ('Versamenti al broker, piani di accumulo', 'Broker deposits, regular investment plans', 'Einzahlungen beim Broker, Sparpläne'));
--> statement-breakpoint
UPDATE "categories" SET "default_key" = 'tasse' WHERE "default_key" IS NULL AND "name" IN ('Tasse & Bolli', 'Taxes & Duties', 'Steuern & Abgaben') AND "type" = 'saltuaria' AND "icon" = 'receipt' AND "is_fallback" = false AND ("description" IN ('F24, IMU, TARI, bollo auto, canone', 'Italian F24 payments, IMU, TARI, vehicle tax, licence fee', 'Italienische F24-Zahlungen, IMU, TARI, Kfz-Steuer, Rundfunkgebühr'));
--> statement-breakpoint
UPDATE "categories" SET "default_key" = 'casa' WHERE "default_key" IS NULL AND "name" IN ('Casa & Arredamento', 'Home & Furniture', 'Wohnen & Einrichtung') AND "type" = 'saltuaria' AND "icon" = 'sofa' AND "is_fallback" = false AND ("description" IN ('Mobili, elettrodomestici, lavori in casa', 'Furniture, appliances, home improvements', 'Möbel, Haushaltsgeräte, Renovierung'));
--> statement-breakpoint
UPDATE "categories" SET "default_key" = 'regali' WHERE "default_key" IS NULL AND "name" IN ('Regali & Donazioni', 'Gifts & Donations', 'Geschenke & Spenden') AND "type" = 'saltuaria' AND "icon" = 'gift' AND "is_fallback" = false AND ("description" IN ('Regali, ricorrenze, beneficenza', 'Gifts, celebrations, charity', 'Geschenke, Feiern, Spenden'));
--> statement-breakpoint
UPDATE "categories" SET "default_key" = 'trasferimenti' WHERE "default_key" IS NULL AND "name" IN ('Trasferimenti tra i miei conti', 'Transfers between my accounts', 'Umbuchungen eigener Konten') AND "type" = 'trasferimento' AND "icon" = 'landmark' AND "is_fallback" = false AND ("description" IN ('Giroconti fra conti di tua proprietà: esclusi da entrate e spese', 'Transfers between your own accounts: excluded from income and spending', 'Umbuchungen zwischen eigenen Konten: ohne Einfluss auf Einnahmen und Ausgaben'));
--> statement-breakpoint
UPDATE "categories" SET "default_key" = 'da-categorizzare' WHERE "default_key" IS NULL AND "name" IN ('Da categorizzare', 'To categorise', 'Zu kategorisieren') AND "type" = 'voluta' AND "icon" = 'help-circle' AND "is_fallback" = true AND ("description" IS NULL);
--> statement-breakpoint
UPDATE "categories" SET "default_key" = 'stipendio' WHERE "default_key" IS NULL AND "name" IN ('Stipendio', 'Salary', 'Gehalt') AND "type" = 'entrata' AND "icon" = 'banknote' AND "is_fallback" = false AND ("description" IN ('Stipendio, pensione, tredicesima', 'Salary, pension, annual bonus', 'Gehalt, Rente, Sonderzahlungen'));
--> statement-breakpoint
UPDATE "categories" SET "default_key" = 'interessi' WHERE "default_key" IS NULL AND "name" IN ('Interessi & Dividendi', 'Interest & Dividends', 'Zinsen & Dividenden') AND "type" = 'entrata' AND "icon" = 'trending-up' AND "is_fallback" = false AND ("description" IN ('Interessi del conto deposito, dividendi e cedole', 'Savings interest, dividends and coupons', 'Sparzinsen, Dividenden und Kupons'));
--> statement-breakpoint
UPDATE "categories" SET "default_key" = 'rimborsi' WHERE "default_key" IS NULL AND "name" IN ('Rimborsi', 'Refunds', 'Erstattungen') AND "type" = 'entrata' AND "icon" = 'calculator' AND "is_fallback" = false AND ("description" IN ('Resi, rimborsi del 730, soldi restituiti da amici', 'Returns, Italian 730 tax refunds, repayments from friends', 'Retouren, italienische 730-Steuererstattungen, Rückzahlungen von Freunden'));
--> statement-breakpoint
UPDATE "categories" SET "default_key" = 'altre-entrate' WHERE "default_key" IS NULL AND "name" IN ('Altre entrate', 'Other income', 'Sonstige Einnahmen') AND "type" = 'entrata' AND "icon" = 'package' AND "is_fallback" = false AND ("description" IN ('Tutto ciò che non rientra nelle altre entrate', 'Income that does not fit another category', 'Einnahmen, die keiner anderen Kategorie zugeordnet sind'));
--> statement-breakpoint
UPDATE "categories" SET "default_key" = 'figli' WHERE "default_key" IS NULL AND "name" IN ('Figli & Scuola', 'Children & School', 'Kinder & Schule') AND "type" = 'dovuta' AND "icon" = 'graduation-cap' AND "is_fallback" = false AND ("description" IN ('Scuola, libri, mensa, attività dei figli', 'School, books, school meals, children''s activities', 'Schule, Bücher, Schulessen, Kinderaktivitäten'));
--> statement-breakpoint
UPDATE "categories" SET "default_key" = 'animali' WHERE "default_key" IS NULL AND "name" IN ('Animali', 'Pets', 'Haustiere') AND "type" = 'dovuta' AND "icon" = 'paw-print' AND "is_fallback" = false AND ("description" IN ('Cibo, veterinario, accessori', 'Food, vet, accessories', 'Futter, Tierarzt, Zubehör'));
--> statement-breakpoint
UPDATE "categories" SET "default_key" = 'pensione' WHERE "default_key" IS NULL AND "name" IN ('Pensione integrativa') AND "type" = 'futuro' AND "icon" = 'landmark' AND "is_fallback" = false AND ("description" IN ('Versamenti al fondo pensione', 'Pension fund contributions', 'Beiträge zur Altersvorsorge'));
--> statement-breakpoint
UPDATE "categories" SET "default_key" = 'imprevisti' WHERE "default_key" IS NULL AND "name" IN ('Imprevisti', 'Unexpected costs', 'Unvorhergesehenes') AND "type" = 'saltuaria' AND "icon" = 'alert-triangle' AND "is_fallback" = false AND ("description" IN ('Spese che non avevi previsto', 'Unplanned spending', 'Ungeplante Ausgaben'));
--> statement-breakpoint
UPDATE "categories" SET "default_key" = 'lavoro-autonomo' WHERE "default_key" IS NULL AND "name" IN ('Lavoro autonomo', 'Self-employment', 'Selbstständigkeit') AND "type" = 'entrata' AND "icon" = 'briefcase' AND "is_fallback" = false AND ("description" IN ('Fatture, prestazioni occasionali', 'Invoices, occasional work', 'Rechnungen, gelegentliche Tätigkeiten'));
