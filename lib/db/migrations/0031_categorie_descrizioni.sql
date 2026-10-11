ALTER TABLE "categories" ADD COLUMN "description" text;--> statement-breakpoint
-- Descrizioni per le categorie già create dai default precedenti (solo dove manca): guidano l'assistente.
UPDATE "categories" AS c SET "description" = d.description
FROM (VALUES
  ('Affitto & Mutuo', 'Affitto, rata del mutuo, condominio'),
  ('Bollette & Utenze', 'Luce, gas, acqua'),
  ('Internet & Telefono', 'Internet, cellulare, telefono fisso'),
  ('Spesa alimentare', 'Supermercato, alimentari, casalinghi'),
  ('Trasporti & Carburante', 'Carburante, mezzi pubblici, pedaggi, parcheggi'),
  ('Salute & Farmaci', 'Farmacia, visite, dentista, analisi'),
  ('Assicurazioni', 'Auto, casa, vita, salute'),
  ('Rate & Finanziamenti', 'Finanziamenti, prestiti, acquisti a rate'),
  ('Figli & Istruzione', 'Scuola, libri, mensa, attività dei figli'),
  ('Animali domestici', 'Cibo, veterinario, accessori'),
  ('Ristoranti & Bar', 'Pranzi e cene fuori, bar, caffè, consegne a domicilio'),
  ('Abbonamenti & Streaming', 'Streaming, musica, app, software, giornali'),
  ('Svago & Hobby', 'Cinema, concerti, hobby, giochi, libri'),
  ('Sport & Benessere', 'Palestra, sport, piscina'),
  ('Abbigliamento', 'Vestiti, scarpe, accessori'),
  ('Shopping & Tecnologia', 'Elettronica, acquisti online'),
  ('Cura personale', 'Parrucchiere, estetista, cosmetici'),
  ('Viaggi & Vacanze', 'Voli, treni per le vacanze, hotel, case vacanza'),
  ('Fondo emergenza', 'Versamenti verso il fondo per le emergenze'),
  ('Risparmio per obiettivi', 'Versamenti per un obiettivo: casa, auto, viaggio'),
  ('Investimenti', 'Versamenti al broker, piani di accumulo'),
  ('Pensione integrativa', 'Versamenti al fondo pensione'),
  ('Tasse & Bolli', 'F24, IMU, TARI, bollo auto, canone'),
  ('Manutenzione auto', 'Officina, tagliando, gomme, revisione'),
  ('Casa & Arredamento', 'Mobili, elettrodomestici, lavori in casa'),
  ('Regali & Ricorrenze', 'Regali, ricorrenze'),
  ('Imprevisti', 'Spese che non avevi previsto'),
  ('Stipendio', 'Stipendio, pensione, tredicesima'),
  ('Freelance', 'Fatture, prestazioni occasionali'),
  ('Dividendi e interessi', 'Interessi del conto deposito, dividendi e cedole'),
  ('Rimborsi', 'Resi, rimborsi del 730, soldi restituiti da amici'),
  ('Altre entrate', 'Tutto ciò che non rientra nelle altre entrate')
) AS d(name, description)
WHERE c."name" = d.name AND c."description" IS NULL AND c."is_fallback" = false;
