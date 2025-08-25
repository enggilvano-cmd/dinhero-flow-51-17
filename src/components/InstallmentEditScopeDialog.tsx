import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export type EditScope = "current" | "current-and-previous" | "current-and-remaining" | "all";

interface InstallmentEditScopeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScopeSelected: (scope: EditScope) => void;
  currentInstallment: number;
  totalInstallments: number;
}

export function InstallmentEditScopeDialog({
  open,
  onOpenChange,
  onScopeSelected,
  currentInstallment,
  totalInstallments
}: InstallmentEditScopeDialogProps) {
  const handleScopeSelection = (scope: EditScope) => {
    onScopeSelected(scope);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Escopo da Edição</DialogTitle>
          <DialogDescription>
            Esta transação faz parte de um parcelamento ({currentInstallment}/{totalInstallments}). 
            Selecione o escopo da edição:
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-3 pt-4">
          <Button 
            variant="outline" 
            className="w-full justify-start h-auto p-4"
            onClick={() => handleScopeSelection("current")}
          >
            <div className="text-left">
              <div className="font-medium">Apenas esta parcela</div>
              <div className="text-sm text-muted-foreground">
                Editar somente a parcela {currentInstallment}/{totalInstallments}
              </div>
            </div>
          </Button>

          {currentInstallment > 1 && (
            <Button 
              variant="outline" 
              className="w-full justify-start h-auto p-4"
              onClick={() => handleScopeSelection("current-and-previous")}
            >
              <div className="text-left">
                <div className="font-medium">Esta parcela e as anteriores</div>
                <div className="text-sm text-muted-foreground">
                  Editar as parcelas 1 até {currentInstallment} (já processadas)
                </div>
              </div>
            </Button>
          )}

          {currentInstallment < totalInstallments && (
            <Button 
              variant="outline" 
              className="w-full justify-start h-auto p-4"
              onClick={() => handleScopeSelection("current-and-remaining")}
            >
              <div className="text-left">
                <div className="font-medium">Esta parcela e as demais</div>
                <div className="text-sm text-muted-foreground">
                  Editar as parcelas {currentInstallment} até {totalInstallments}
                </div>
              </div>
            </Button>
          )}

          <Button 
            variant="outline" 
            className="w-full justify-start h-auto p-4"
            onClick={() => handleScopeSelection("all")}
          >
            <div className="text-left">
              <div className="font-medium">Todas as parcelas</div>
              <div className="text-sm text-muted-foreground">
                Editar todas as {totalInstallments} parcelas do parcelamento
              </div>
            </div>
          </Button>
        </div>

        <div className="flex gap-3 pt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="flex-1">
            Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}