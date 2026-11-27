import type { Category, Product } from '../types/catalog';

export function sortCategoriesByOrder(categories: Category[]): Category[] {
  return [...categories].sort((a, b) => {
    const orderA = typeof a.displayOrder === 'number' ? a.displayOrder : 9999;
    const orderB = typeof b.displayOrder === 'number' ? b.displayOrder : 9999;
    if (orderA !== orderB) return orderA - orderB;
    return a.name.localeCompare(b.name);
  });
}

export function isTopLevelCategory(category: Category, allCategories: Category[]): boolean {
  const parentId = category.parentId?.trim();
  if (!parentId || parentId === category.id) return true;
  // Treat category as top-level if its referenced parent does not exist (orphan-safe)
  return !allCategories.some((c) => c.id === parentId);
}

export function getTopLevelCategories(categories: Category[]): Category[] {
  return sortCategoriesByOrder(categories.filter((c) => isTopLevelCategory(c, categories)));
}

export function getChildCategories(parentId: string, categories: Category[]): Category[] {
  return sortCategoriesByOrder(
    categories.filter((c) => c.parentId?.trim() === parentId && c.id !== parentId)
  );
}

export function getCategoryDescendantIds(
  rootId: string,
  categories: Category[]
): Set<string> {
  const result = new Set<string>([rootId]);
  const queue = [rootId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const cat of categories) {
      if (cat.parentId?.trim() === current && !result.has(cat.id)) {
        result.add(cat.id);
        queue.push(cat.id);
      }
    }
  }

  return result;
}

export function getCategoryAncestors(
  categoryId: string,
  categories: Category[]
): Category[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const chain: Category[] = [];
  const visited = new Set<string>();
  let current = byId.get(categoryId);

  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    chain.unshift(current);
    const parentId = current.parentId?.trim();
    current = parentId ? byId.get(parentId) : undefined;
  }

  return chain;
}

export function wouldCreateCategoryCycle(
  categoryId: string,
  candidateParentId: string,
  categories: Category[]
): boolean {
  const cleanParent = candidateParentId.trim();
  if (!cleanParent) return false;
  if (cleanParent === categoryId) return true;
  const descendants = getCategoryDescendantIds(categoryId, categories);
  return descendants.has(cleanParent);
}

export function productMatchesCategoryFilter(
  product: Product,
  selectedCategoryId: string,
  categories: Category[]
): boolean {
  if (!selectedCategoryId || selectedCategoryId === 'all') {
    return true;
  }
  const matchingIds = getCategoryDescendantIds(selectedCategoryId, categories);
  if (matchingIds.has(product.categoryId)) {
    return true;
  }
  const subId = product.subcategoryId?.trim();
  if (subId && matchingIds.has(subId)) {
    return true;
  }
  return false;
}
