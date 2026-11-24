import { ResilientImage } from '../components/ResilientImage';
import type { Category } from '../types/catalog';

interface CategoriesPageProps {
  categories: Category[];
  onSelectCategory: (categoryId: string) => void;
}

export function CategoriesPage({ categories, onSelectCategory }: CategoriesPageProps) {
  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-5">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
          Categories
        </h1>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-5">
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => onSelectCategory(category.id)}
            className="bg-white border border-slate-200 rounded-lg overflow-hidden text-left hover:border-slate-300 focus-visible:outline-2 focus-visible:outline-orange-600 flex flex-col min-w-0"
          >
            <div className="relative aspect-[4/3] w-full bg-slate-100 overflow-hidden shrink-0">
              <div className="absolute inset-0">
                <ResilientImage
                  src={category.image}
                  alt={category.name}
                  fallbackLabel={category.name}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
            <div className="p-2 sm:p-3">
              <h2 className="text-xs sm:text-sm font-semibold text-slate-900 leading-tight line-clamp-2">
                {category.name}
              </h2>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
