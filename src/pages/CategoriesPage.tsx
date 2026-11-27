import { ResilientImage } from '../components/ResilientImage';
import type { Category, Product } from '../types/catalog';
import {
  getChildCategories,
  getTopLevelCategories,
  productMatchesCategoryFilter,
} from '../utils/categoryTree';

interface CategoriesPageProps {
  categories: Category[];
  products?: Product[];
  onSelectCategory: (categoryId: string) => void;
}

export function CategoriesPage({
  categories,
  products = [],
  onSelectCategory,
}: CategoriesPageProps) {
  const topLevelCategories = getTopLevelCategories(categories);
  const publishedProducts = products.filter((p) => p.published && !p.archived);

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-10 space-y-4 sm:space-y-5">
      <div className="border-b border-slate-200 pb-3 sm:pb-4">
        <h1 className="font-display text-xl sm:text-3xl font-bold text-slate-900 tracking-tight">
          Categories
        </h1>
      </div>

      {topLevelCategories.length === 0 ? (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-600">
          No categories available yet.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
          {topLevelCategories.map((category) => {
            const subcategories = getChildCategories(category.id, categories);
            const productCount = publishedProducts.filter((p) =>
              productMatchesCategoryFilter(p, category.id, categories)
            ).length;

            return (
              <div
                key={category.id}
                className="bg-white border border-slate-200 rounded-lg overflow-hidden hover:border-slate-300 flex flex-col min-w-0"
              >
                <button
                  type="button"
                  onClick={() => onSelectCategory(category.id)}
                  className="text-left focus-visible:outline-2 focus-visible:outline-orange-600 flex flex-col flex-1 min-w-0"
                >
                  <div className="relative aspect-[4/3] w-full bg-slate-100 overflow-hidden shrink-0">
                    <div className="absolute inset-0">
                      <ResilientImage
                        src={category.image}
                        alt={category.name}
                        fallbackLabel={category.name}
                        sizes="(max-width: 639px) 50vw, (max-width: 1023px) 33vw, 25vw"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                  <div className="p-2.5 sm:p-3 flex-1">
                    <h2 className="text-[13px] sm:text-sm font-semibold text-slate-900 leading-snug line-clamp-2">
                      {category.name}
                    </h2>
                    {publishedProducts.length > 0 && (
                      <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                        {productCount} product{productCount === 1 ? '' : 's'}
                      </p>
                    )}
                  </div>
                </button>

                {subcategories.length > 0 && (
                  <div className="px-2.5 sm:px-3 pb-2.5 sm:pb-3 pt-1.5 border-t border-slate-100 flex flex-wrap gap-1.5">
                    {subcategories.map((sub) => (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => onSelectCategory(sub.id)}
                        className="px-2 py-1 min-h-[32px] text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-orange-50 hover:text-orange-800 border border-slate-200 rounded transition-colors text-left"
                      >
                        {sub.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
