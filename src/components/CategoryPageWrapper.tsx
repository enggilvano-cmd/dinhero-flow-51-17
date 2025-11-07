import { useAccountStore } from "@/stores/AccountStore";
import { CategoriesPage } from "./CategoriesPage";

export function CategoryPageWrapper() {
  const {
    categories,
    addCategory,
    updateCategory,
    deleteCategory,
  } = useAccountStore();

  return (
    <CategoriesPage 
      categories={categories}
      onAddCategory={addCategory}
      onUpdateCategory={updateCategory}
      onDeleteCategory={deleteCategory}
    />
  );
}