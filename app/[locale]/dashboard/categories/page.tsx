import { getDictionary, Locale } from "@/lib/dictionaries";
import Categories from "@/components/categories";

export default async function CategoriesPage({ params }: { params: { locale: string } }) {
   const { locale } = await params;
   const dict = await getDictionary(locale as Locale);

   return (
      <Categories dict={dict} />
   );
}