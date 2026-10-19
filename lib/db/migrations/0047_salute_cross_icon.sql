-- La categoria "Salute" passa dalla capsula (che a dimensioni ridotte sembra un link) a una croce.
-- Tocca solo le categorie che usano ancora l'icona di default 'pill'; le scelte personalizzate restano intatte.
UPDATE "categories" SET "icon" = 'cross'
WHERE "icon" = 'pill'
  AND (
    "default_key" = 'salute'
    OR "name" IN (
      'Salute', 'Health', 'Gesundheit',
      'Salute & Cura', 'Salute & Farmaci',
      'Health & Care', 'Health & Medicines',
      'Gesundheit & Pflege', 'Gesundheit & Medikamente'
    )
  );
