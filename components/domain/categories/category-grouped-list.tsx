/** Elenco categorie della pagina Categorie, diviso nelle sezioni: quattro gruppi di spesa, "Da categorizzare", Entrate e form di creazione. */

import { EXPENSE_GROUPS, GROUP_DISPLAY, groupCategoriesByType } from "@/lib/categories/groups";
import type { Category } from "@/lib/db/schema/categories";
import { AddCategoryForm } from "./add-category-form";
import { CategoryRow } from "./category-row";
import { CategorySection } from "./category-section";

export interface CategoryGroupedListProps {
  categories: Category[];
}

export function CategoryGroupedList({ categories }: CategoryGroupedListProps) {
  const sections = groupCategoriesByType(categories);

  return (
    <div className="flex flex-col gap-5">
      {sections.groups.map((group) => (
        <CategorySection
          key={group.key}
          title={EXPENSE_GROUPS[group.key].label}
          description={EXPENSE_GROUPS[group.key].shortDescription}
          dotClassName={EXPENSE_GROUPS[group.key].dotClassName}
        >
          {group.categories.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">Nessuna categoria in questo gruppo.</p>
          ) : (
            group.categories.map((category) => <CategoryRow key={category.id} category={category} />)
          )}
        </CategorySection>
      ))}
      {sections.uncategorized.length > 0 && (
        <CategorySection
          title={GROUP_DISPLAY.daCategorizzare.label}
          description="Movimenti non ancora assegnati a una categoria."
          dotClassName={GROUP_DISPLAY.daCategorizzare.dotClassName}
        >
          {sections.uncategorized.map((category) => <CategoryRow key={category.id} category={category} />)}
        </CategorySection>
      )}
      <CategorySection title="Entrate">
        {sections.income.map((category) => <CategoryRow key={category.id} category={category} />)}
      </CategorySection>
      <CategorySection title="Nuova categoria">
        <AddCategoryForm />
      </CategorySection>
    </div>
  );
}
