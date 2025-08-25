import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';
import { format, parse, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Account {
  id: string;
  name: string;
  type: "checking" | "savings" | "credit" | "investment";
  balance: number;
  color: string;
}

interface Transaction {
  id?: string;
  description: string;
  amount: number;
  date: Date;
  type: "income" | "expense" | "transfer";
  category: string;
  accountId: string;
  status: "pending" | "completed";
  installments?: number;
  currentInstallment?: number;
  parentTransactionId?: string;
  createdAt?: Date;
}

interface ImportTransactionsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: Account[];
  onImportTransactions: (transactions: any[]) => void; // Mudança temporária para evitar conflito de tipos
}

interface ImportedTransaction {
  data: string;
  descricao: string;
  categoria: string;
  tipo: string;
  conta: string;
  valor: number;
  status?: string;
  parcelas?: string;
  isValid: boolean;
  errors: string[];
  accountId?: string;
  parsedDate?: Date;
  parsedType?: 'income' | 'expense' | 'transfer';
  parsedStatus?: 'completed' | 'pending';
}

export function ImportTransactionsModal({ 
  open, 
  onOpenChange, 
  accounts, 
  onImportTransactions 
}: ImportTransactionsModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [importedData, setImportedData] = useState<ImportedTransaction[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [validTransactions, setValidTransactions] = useState(0);
  const [invalidTransactions, setInvalidTransactions] = useState(0);
  const { toast } = useToast();

  const validateTransactionType = (tipo: string): 'income' | 'expense' | 'transfer' | null => {
    const normalizedType = tipo.toLowerCase().trim();
    if (['receita', 'income', 'entrada'].includes(normalizedType)) return 'income';
    if (['despesa', 'expense', 'saída', 'saida'].includes(normalizedType)) return 'expense';
    if (['transferência', 'transferencia', 'transfer'].includes(normalizedType)) return 'transfer';
    return null;
  };

  const validateStatus = (status: string): 'completed' | 'pending' | null => {
    if (!status) return 'completed'; // padrão
    const normalizedStatus = status.toLowerCase().trim();
    if (['concluída', 'concluida', 'completed', 'finalizada'].includes(normalizedStatus)) return 'completed';
    if (['pendente', 'pending', 'em andamento'].includes(normalizedStatus)) return 'pending';
    return null;
  };

  const findAccountByName = (accountName: string): Account | null => {
    const normalizedName = accountName.toLowerCase().trim();
    return accounts.find(acc => 
      acc.name.toLowerCase().includes(normalizedName) ||
      normalizedName.includes(acc.name.toLowerCase())
    ) || null;
  };

  const parseDate = (dateString: string): Date | null => {
    // Tentar diferentes formatos de data
    const formats = [
      'dd/MM/yyyy',
      'dd/MM/yy',
      'yyyy-MM-dd',
      'MM/dd/yyyy',
      'dd-MM-yyyy'
    ];

    for (const dateFormat of formats) {
      try {
        const parsed = parse(dateString, dateFormat, new Date(), { locale: ptBR });
        if (isValid(parsed)) {
          return parsed;
        }
      } catch (error) {
        continue;
      }
    }

    // Tentar parseamento automático
    const autoDate = new Date(dateString);
    return isValid(autoDate) ? autoDate : null;
  };

  const validateTransaction = (row: any): ImportedTransaction => {
    const errors: string[] = [];
    let isValid = true;

    // Validar campos obrigatórios
    const data = row.Data || row.data || '';
    const descricao = row.Descrição || row.descricao || row.Descricao || '';
    const categoria = row.Categoria || row.categoria || '';
    const tipo = row.Tipo || row.tipo || '';
    const conta = row.Conta || row.conta || '';
    const valor = parseFloat(row.Valor || row.valor || '0');

    if (!data) {
      errors.push('Data é obrigatória');
      isValid = false;
    }

    if (!descricao) {
      errors.push('Descrição é obrigatória');
      isValid = false;
    }

    if (!categoria) {
      errors.push('Categoria é obrigatória');
      isValid = false;
    }

    if (!tipo) {
      errors.push('Tipo é obrigatório');
      isValid = false;
    }

    if (!conta) {
      errors.push('Conta é obrigatória');
      isValid = false;
    }

    if (isNaN(valor) || valor <= 0) {
      errors.push('Valor deve ser um número positivo');
      isValid = false;
    }

    // Validações específicas
    const parsedDate = parseDate(data);
    if (!parsedDate) {
      errors.push('Formato de data inválido');
      isValid = false;
    }

    const parsedType = validateTransactionType(tipo);
    if (!parsedType) {
      errors.push('Tipo deve ser: Receita, Despesa ou Transferência');
      isValid = false;
    }

    const account = findAccountByName(conta);
    if (!account) {
      errors.push('Conta não encontrada');
      isValid = false;
    }

    const status = row.Status || row.status || 'completed';
    const parsedStatus = validateStatus(status);
    if (!parsedStatus) {
      errors.push('Status inválido');
      isValid = false;
    }

    return {
      data,
      descricao,
      categoria,
      tipo,
      conta,
      valor,
      status,
      parcelas: row.Parcelas || row.parcelas || '',
      isValid,
      errors,
      accountId: account?.id,
      parsedDate: parsedDate || undefined,
      parsedType: parsedType || undefined,
      parsedStatus: parsedStatus || undefined
    };
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.match(/\.(xlsx|xls)$/)) {
      toast({
        title: "Formato inválido",
        description: "Por favor, selecione um arquivo Excel (.xlsx ou .xls)",
        variant: "destructive"
      });
      return;
    }

    setFile(selectedFile);
    setIsProcessing(true);

    try {
      const fileBuffer = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(fileBuffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rawData = XLSX.utils.sheet_to_json(sheet);

      if (rawData.length === 0) {
        toast({
          title: "Arquivo vazio",
          description: "O arquivo não contém dados para importar",
          variant: "destructive"
        });
        setIsProcessing(false);
        return;
      }

      // Validar cada transação
      const validatedData = rawData.map((row, index) => {
        try {
          return validateTransaction(row);
        } catch (error) {
          console.error(`Erro ao validar linha ${index + 1}:`, error);
          return {
            data: '',
            descricao: '',
            categoria: '',
            tipo: '',
            conta: '',
            valor: 0,
            isValid: false,
            errors: ['Erro ao processar linha']
          } as ImportedTransaction;
        }
      });
      const valid = validatedData.filter(t => t.isValid).length;
      const invalid = validatedData.filter(t => !t.isValid).length;

      setImportedData(validatedData);
      setValidTransactions(valid);
      setInvalidTransactions(invalid);

      toast({
        title: "Arquivo processado",
        description: `${valid} transações válidas, ${invalid} com erros`,
      });

    } catch (error) {
      toast({
        title: "Erro ao processar arquivo",
        description: "Não foi possível ler o arquivo Excel",
        variant: "destructive"
      });
    }

    setIsProcessing(false);
  };

  const handleImport = () => {
    const validTransactionsToImport = importedData
      .filter(t => t.isValid && t.parsedType && t.accountId && t.parsedDate && t.parsedStatus)
      .map(t => ({
        description: t.descricao,
        amount: t.valor,
        category: t.categoria, // Manter category como string - será tratado no backend
        type: t.parsedType as 'income' | 'expense' | 'transfer',
        account_id: t.accountId as string,
        date: t.parsedDate?.toISOString().split('T')[0] as string,
        status: t.parsedStatus as 'completed' | 'pending',
        installments: t.parcelas && t.parcelas.includes('/') ? 
          parseInt(t.parcelas.split('/')[1]) || undefined : undefined,
        current_installment: t.parcelas && t.parcelas.includes('/') ? 
          parseInt(t.parcelas.split('/')[0]) || undefined : undefined
      }));

    onImportTransactions(validTransactionsToImport);
    
    toast({
      title: "Transações importadas",
      description: `${validTransactionsToImport.length} transações foram adicionadas com sucesso`,
    });

    // Reset
    setFile(null);
    setImportedData([]);
    setValidTransactions(0);
    setInvalidTransactions(0);
    onOpenChange(false);
  };

  const handleCancel = () => {
    setFile(null);
    setImportedData([]);
    setValidTransactions(0);
    setInvalidTransactions(0);
    onOpenChange(false);
  };

  const downloadTemplate = () => {
    const templateData = [
      {
        'Data': '15/03/2024',
        'Descrição': 'Salário',
        'Categoria': 'Salário',
        'Tipo': 'Receita',
        'Conta': accounts[0]?.name || 'Conta Corrente',
        'Valor': 5000,
        'Status': 'Concluída',
        'Parcelas': ''
      },
      {
        'Data': '16/03/2024',
        'Descrição': 'Supermercado',
        'Categoria': 'Alimentação',
        'Tipo': 'Despesa',
        'Conta': accounts[0]?.name || 'Conta Corrente',
        'Valor': 150.50,
        'Status': 'Concluída',
        'Parcelas': ''
      },
      {
        'Data': '17/03/2024',
        'Descrição': 'Compra parcelada',
        'Categoria': 'Compras',
        'Tipo': 'Despesa',
        'Conta': accounts.find(acc => acc.type === 'credit')?.name || 'Cartão de Crédito',
        'Valor': 300,
        'Status': 'Pendente',
        'Parcelas': '1/3'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Modelo");

    // Configurar largura das colunas
    const colWidths = [
      { wch: 12 }, // Data
      { wch: 30 }, // Descrição
      { wch: 20 }, // Categoria
      { wch: 15 }, // Tipo
      { wch: 25 }, // Conta
      { wch: 15 }, // Valor
      { wch: 12 }, // Status
      { wch: 12 }  // Parcelas
    ];
    ws['!cols'] = colWidths;

    XLSX.writeFile(wb, 'modelo-importacao-transacoes.xlsx');

    toast({
      title: "Modelo baixado",
      description: "Use este arquivo como exemplo para importar suas transações.",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Importar Transações do Excel
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-6">
          {/* File Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Selecionar Arquivo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <Input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileSelect}
                    disabled={isProcessing}
                    className="flex-1"
                  />
                  {file && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <FileSpreadsheet className="h-4 w-4" />
                      {file.name}
                    </div>
                  )}
                </div>

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-2">
                      <p><strong>Formato esperado:</strong> O arquivo deve ter as colunas:</p>
                      <ul className="list-disc list-inside text-sm space-y-1">
                        <li><strong>Data:</strong> dd/MM/yyyy (ex: 15/03/2024)</li>
                        <li><strong>Descrição:</strong> Descrição da transação</li>
                        <li><strong>Categoria:</strong> Categoria da transação</li>
                        <li><strong>Tipo:</strong> Receita, Despesa ou Transferência</li>
                        <li><strong>Conta:</strong> Nome da conta (deve existir no sistema)</li>
                        <li><strong>Valor:</strong> Valor numérico positivo</li>
                        <li><strong>Status:</strong> Concluída ou Pendente (opcional)</li>
                        <li><strong>Parcelas:</strong> Formato 1/3 (opcional)</li>
                      </ul>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadTemplate()}
                        className="mt-2"
                      >
                        Baixar Modelo de Exemplo
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              </div>
            </CardContent>
          </Card>

          {/* Summary Stats */}
          {importedData.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                    <div>
                      <div className="text-2xl font-bold text-success">
                        {validTransactions}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Transações válidas
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    <X className="h-5 w-5 text-destructive" />
                    <div>
                      <div className="text-2xl font-bold text-destructive">
                        {invalidTransactions}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Com erros
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Preview Table */}
          {importedData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Prévia das Transações</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-60 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Conta</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Erros</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importedData.slice(0, 10).map((transaction, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Badge variant={transaction.isValid ? "default" : "destructive"}>
                              {transaction.isValid ? "Válida" : "Erro"}
                            </Badge>
                          </TableCell>
                          <TableCell>{transaction.data}</TableCell>
                          <TableCell>{transaction.descricao}</TableCell>
                          <TableCell>{transaction.categoria}</TableCell>
                          <TableCell>{transaction.tipo}</TableCell>
                          <TableCell>{transaction.conta}</TableCell>
                          <TableCell>R$ {transaction.valor.toFixed(2)}</TableCell>
                          <TableCell>
                            {transaction.errors.length > 0 && (
                              <div className="space-y-1">
                                {transaction.errors.map((error, i) => (
                                  <div key={i} className="text-xs text-destructive">
                                    {error}
                                  </div>
                                ))}
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {importedData.length > 10 && (
                    <p className="text-sm text-muted-foreground mt-2 text-center">
                      Mostrando 10 de {importedData.length} transações
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={handleCancel}>
            Cancelar
          </Button>
          <Button 
            onClick={handleImport}
            disabled={validTransactions === 0 || isProcessing}
          >
            Importar {validTransactions} Transações
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}