import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Edit, Trash2, Search, Tag, TrendingUp, TrendingDown, ArrowUpDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AddCategoryModal } from "@/components/AddCategoryModal";
import { EditCategoryModal } from "@/components/EditCategoryModal";
import { useChartResponsive } from "@/hooks/useChartResponsive";

interface CategoriesPageProps {}

export function CategoriesPage({}: CategoriesPageProps) {
  const { user } = useAuth();
  const [categories, setCategories] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "income" | "expense" | "both">("all");
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { isMobile } = useChartResponsive();

  useEffect(() => {
    if (!user) return;
    
    const loadCategories = async () => {
      try {
        const { data, error } = await supabase
          .from('categories')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error loading categories:', error);
        } else {
          setCategories(data || []);
        }
      } catch (error) {
        console.error('Error loading categories:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCategories();
  }, [user]);

  const handleAddCategory = async (categoryData: any) => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('categories')
        .insert([{
          ...categoryData,
          user_id: user.id
        }])
        .select()
        .single();

      if (error) {
        console.error('Error adding category:', error);
        toast({
          title: "Erro",
          description: "Erro ao adicionar categoria.",
          variant: "destructive"
        });
        return;
      }

      setCategories(prev => [...prev, data]);
      
      toast({
        title: "Sucesso",
        description: "Categoria adicionada com sucesso!",
      });
    } catch (error) {
      console.error('Error adding category:', error);
      toast({
        title: "Erro",
        description: "Erro inesperado ao adicionar categoria.",
        variant: "destructive"
      });
    }
  };

  const handleEditCategory = async (updatedCategory: any) => {
    if (!user) return;
    
    try {
      const { error } = await supabase
        .from('categories')
        .update(updatedCategory)
        .eq('id', updatedCategory.id)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error updating category:', error);
        toast({
          title: "Erro",
          description: "Erro ao atualizar categoria.",
          variant: "destructive"
        });
        return;
      }

      setCategories(prev => prev.map(cat => 
        cat.id === updatedCategory.id ? { ...cat, ...updatedCategory } : cat
      ));
      setEditingCategory(null);
      
      toast({
        title: "Sucesso",
        description: "Categoria atualizada com sucesso!",
      });
    } catch (error) {
      console.error('Error updating category:', error);
      toast({
        title: "Erro",
        description: "Erro inesperado ao atualizar categoria.",
        variant: "destructive"
      });
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (!user) return;
    
    try {
      // Check if category is being used in transactions
      const { data: transactions, error: transError } = await supabase
        .from('transactions')
        .select('id')
        .eq('category_id', categoryId)
        .eq('user_id', user.id)
        .limit(1);
      
      if (transError) {
        console.error('Error checking transactions:', transError);
        return;
      }

      if (transactions && transactions.length > 0) {
        toast({
          title: "Erro",
          description: "Esta categoria não pode ser excluída pois está sendo usada em transações.",
          variant: "destructive"
        });
        return;
      }

      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', categoryId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error deleting category:', error);
        toast({
          title: "Erro",
          description: "Erro ao excluir categoria.",
          variant: "destructive"
        });
        return;
      }

      setCategories(prev => prev.filter(cat => cat.id !== categoryId));
      
      toast({
        title: "Sucesso",
        description: "Categoria excluída com sucesso!",
      });
    } catch (error) {
      console.error('Error deleting category:', error);
      toast({
        title: "Erro",
        description: "Erro inesperado ao excluir categoria.",
        variant: "destructive"
      });
    }
  };

  const openEditModal = (category: any) => {
    setEditingCategory(category);
    setEditModalOpen(true);
  };

  const filteredCategories = categories.filter(category => {
    const matchesSearch = category.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === "all" || category.type === filterType;
    return matchesSearch && matchesType;
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "income":
        return <TrendingUp className="h-4 w-4" />;
      case "expense":
        return <TrendingDown className="h-4 w-4" />;
      case "both":
        return <ArrowUpDown className="h-4 w-4" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "income":
        return "Receita";
      case "expense":
        return "Despesa";
      case "both":
        return "Ambos";
    }
  };

  const getTypeVariant = (type: string) => {
    switch (type) {
      case "income":
        return "default";
      case "expense":
        return "destructive";
      case "both":
        return "secondary";
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-48 mb-2"></div>
          <div className="h-4 bg-muted rounded w-64"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="spacing-responsive-md fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-title-1">Categorias</h1>
          <p className="text-body text-muted-foreground">
            Gerencie as categorias das suas transações
          </p>
        </div>
        <Button onClick={() => setAddModalOpen(true)} className="gap-2 apple-interaction">
          <Plus className="h-4 w-4" />
          <span>{isMobile ? "Nova" : "Nova Categoria"}</span>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="financial-card">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Tag className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-caption font-medium">Total</p>
                  <div className="text-responsive-xl font-bold leading-tight">{categories.length}</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="financial-card">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="h-5 w-5 text-success" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-caption font-medium">Receitas</p>
                  <div className="text-responsive-xl font-bold balance-positive leading-tight">
                    {categories.filter(c => c.type === "income" || c.type === "both").length}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="financial-card">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
                  <TrendingDown className="h-5 w-5 text-destructive" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-caption font-medium">Despesas</p>
                  <div className="text-responsive-xl font-bold balance-negative leading-tight">
                    {categories.filter(c => c.type === "expense" || c.type === "both").length}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="financial-card">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <ArrowUpDown className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-caption font-medium">Mistas</p>
                  <div className="text-responsive-xl font-bold text-primary leading-tight">
                    {categories.filter(c => c.type === "both").length}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-2 sm:p-3">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="flex-1">
              <Label htmlFor="search" className="text-caption">Buscar categorias</Label>
              <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Digite o nome da categoria..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 touch-target"
                />
              </div>
            </div>
            <div className="sm:w-48">
              <Label htmlFor="filter" className="text-caption">Filtrar por tipo</Label>
              <Select value={filterType} onValueChange={(value: any) => setFilterType(value)}>
                <SelectTrigger className="touch-target mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="income">Receitas</SelectItem>
                  <SelectItem value="expense">Despesas</SelectItem>
                  <SelectItem value="both">Ambos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Categories Grid */}
      <div className="grid-responsive-3 gap-4">
        {filteredCategories.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <Tag className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-headline font-semibold mb-2">Nenhuma categoria encontrada</h3>
            <p className="text-body text-muted-foreground mb-4">
              {searchTerm || filterType !== "all" 
                ? "Tente ajustar os filtros para encontrar categorias." 
                : "Comece criando sua primeira categoria."
              }
            </p>
            {(!searchTerm && filterType === "all") && (
              <Button onClick={() => setAddModalOpen(true)} className="gap-2 apple-interaction">
                <Plus className="h-4 w-4" />
                Criar Primeira Categoria
              </Button>
            )}
          </div>
        ) : (
          filteredCategories.map((category) => (
            <Card key={category.id} className="financial-card apple-interaction group">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div 
                      className="w-4 h-4 rounded-full flex-shrink-0"
                      style={{ backgroundColor: category.color }}
                    />
                    <CardTitle className="text-headline truncate">{category.name}</CardTitle>
                  </div>
                  <Badge variant={getTypeVariant(category.type)} className="gap-1 flex-shrink-0">
                    {getTypeIcon(category.type)}
                    <span className="hidden sm:inline">{getTypeLabel(category.type)}</span>
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                 <div className="flex items-center justify-between">
                   <p className="text-caption">
                     Criada em {new Date(category.created_at).toLocaleDateString('pt-BR')}
                   </p>
                  <div className="flex gap-2 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditModal(category)}
                      className="gap-1 touch-target apple-interaction"
                    >
                      <Edit className="h-3 w-3" />
                      <span className="hidden sm:inline">Editar</span>
                    </Button>
                    
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-1 touch-target text-destructive hover:text-destructive">
                          <Trash2 className="h-3 w-3" />
                          <span className="hidden sm:inline">Excluir</span>
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja excluir a categoria "{category.name}"? 
                            Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteCategory(category.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Modals */}
      <AddCategoryModal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        onAddCategory={handleAddCategory}
      />

      <EditCategoryModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        onEditCategory={handleEditCategory}
        category={editingCategory}
      />
    </div>
  );
}