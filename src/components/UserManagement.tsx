import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Users, UserPlus, Shield, Activity, Trash2, Settings } from 'lucide-react';

interface Profile {
  id: string;
  user_id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  role: 'admin' | 'user' | 'limited';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  created_at: string;
  profiles?: {
    email: string;
    full_name?: string;
  };
}

export function UserManagement() {
  const { isAdmin, profile } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<Profile[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<'users' | 'audit'>('users');

  useEffect(() => {
    if (isAdmin()) {
      fetchUsers();
      fetchAuditLogs();
    }
  }, []);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os usuários.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    try {      
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*, profiles(email, full_name)')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Error fetching audit logs:', error);
        return;
      }
      
      setAuditLogs(data || []);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os logs de auditoria.',
        variant: 'destructive',
      });
    }
  };

  const updateUserRole = async (userId: string, newRole: 'admin' | 'user' | 'limited') => {
    try {
      console.log('Updating user role:', { userId, newRole });
      
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('user_id', userId);

      if (error) {
        console.error('Supabase error updating role:', error);
        throw error;
      }

      console.log('User role updated successfully');

      // Log the activity
      try {
        await supabase.rpc('log_user_activity', {
          p_user_id: profile?.user_id,
          p_action: 'user_role_updated',
          p_resource_type: 'profile',
          p_resource_id: userId,
          p_new_values: { role: newRole }
        });
        console.log('Activity logged successfully');
      } catch (logError) {
        console.error('Error logging activity:', logError);
      }

      setUsers(prev => prev.map(user => 
        user.user_id === userId ? { ...user, role: newRole } : user
      ));

      toast({
        title: 'Sucesso',
        description: 'Função do usuário atualizada com sucesso.',
      });
    } catch (error) {
      console.error('Error updating user role:', error);
      toast({
        title: 'Erro',
        description: `Não foi possível atualizar a função do usuário: ${error.message}`,
        variant: 'destructive',
      });
    }
  };

  const toggleUserStatus = async (userId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: isActive })
        .eq('user_id', userId);

      if (error) throw error;

      // Log the activity
      await supabase.rpc('log_user_activity', {
        p_user_id: profile?.user_id,
        p_action: isActive ? 'user_activated' : 'user_deactivated',
        p_resource_type: 'profile',
        p_resource_id: userId
      });

      setUsers(prev => prev.map(user => 
        user.user_id === userId ? { ...user, is_active: isActive } : user
      ));

      toast({
        title: 'Sucesso',
        description: `Usuário ${isActive ? 'ativado' : 'desativado'} com sucesso.`,
      });
    } catch (error) {
      console.error('Error updating user status:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar o status do usuário.',
        variant: 'destructive',
      });
    }
  };

  const deleteUser = async (userId: string) => {
    try {
      // Log the activity before deletion
      await supabase.rpc('log_user_activity', {
        p_user_id: profile?.user_id,
        p_action: 'user_deleted',
        p_resource_type: 'profile',
        p_resource_id: userId
      });

      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('user_id', userId);

      if (error) throw error;

      setUsers(prev => prev.filter(user => user.user_id !== userId));

      toast({
        title: 'Sucesso',
        description: 'Usuário removido com sucesso.',
      });
    } catch (error) {
      console.error('Error deleting user:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível remover o usuário.',
        variant: 'destructive',
      });
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'destructive';
      case 'user': return 'default';
      case 'limited': return 'secondary';
      default: return 'outline';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'Administrador';
      case 'user': return 'Usuário Padrão';
      case 'limited': return 'Usuário Limitado';
      default: return role;
    }
  };

  if (!isAdmin()) {
    return (
      <Card className="financial-card">
        <CardContent className="pt-6">
          <div className="text-center">
            <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold">Acesso Restrito</h3>
            <p className="text-muted-foreground">
              Você precisa de permissões de administrador para acessar esta área.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Gerenciamento de Usuários</h2>
          <p className="text-muted-foreground">
            Controle total sobre usuários e permissões do sistema
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={selectedTab === 'users' ? 'default' : 'outline'}
            onClick={() => setSelectedTab('users')}
            className="flex items-center gap-2"
          >
            <Users className="h-4 w-4" />
            Usuários
          </Button>
          <Button
            variant={selectedTab === 'audit' ? 'default' : 'outline'}
            onClick={() => setSelectedTab('audit')}
            className="flex items-center gap-2"
          >
            <Activity className="h-4 w-4" />
            Auditoria
          </Button>
        </div>
      </div>

      {selectedTab === 'users' && (
        <Card className="financial-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
              <Users className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="block sm:hidden">Usuários</span>
              <span className="hidden sm:block">Usuários do Sistema</span>
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              <span className="block sm:hidden">Gerencie usuários e permissões</span>
              <span className="hidden sm:block">Gerencie usuários, suas funções e permissões de acesso</span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs sm:text-sm">Usuário</TableHead>
                      <TableHead className="text-xs sm:text-sm hidden sm:table-cell">Função</TableHead>
                      <TableHead className="text-xs sm:text-sm">Status</TableHead>
                      <TableHead className="text-xs sm:text-sm hidden md:table-cell">Criado</TableHead>
                      <TableHead className="text-xs sm:text-sm">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="py-2 sm:py-4">
                          <div className="flex items-center gap-2 sm:gap-3">
                            <Avatar className="h-6 w-6 sm:h-8 sm:w-8">
                              <AvatarImage src={user.avatar_url} />
                              <AvatarFallback className="text-xs">
                                {user.full_name?.charAt(0) || user.email.charAt(0)}
                              </AvatarFallback>
                            </Avatar>  
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-xs sm:text-sm truncate">
                                {user.full_name || 'Sem nome'}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {user.email}
                              </p>
                              <div className="sm:hidden mt-1">
                                <Badge 
                                  variant={getRoleBadgeVariant(user.role)}
                                  className="text-xs"
                                >
                                  {getRoleLabel(user.role)}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell py-2 sm:py-4">
                          <Select
                            value={user.role}
                            onValueChange={(value: 'admin' | 'user' | 'limited') => 
                              updateUserRole(user.user_id, value)
                            }
                            disabled={user.user_id === profile?.user_id}
                          >
                            <SelectTrigger className="w-32 sm:w-40 text-xs sm:text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Administrador</SelectItem>
                              <SelectItem value="user">Usuário Padrão</SelectItem>
                              <SelectItem value="limited">Usuário Limitado</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="py-2 sm:py-4">
                          <div className="flex items-center gap-1 sm:gap-2">
                            <Switch
                              checked={user.is_active}
                              onCheckedChange={(checked) => 
                                toggleUserStatus(user.user_id, checked)
                              }
                              disabled={user.user_id === profile?.user_id}
                              className="scale-75 sm:scale-100"
                            />
                            <Badge 
                              variant={user.is_active ? 'default' : 'secondary'}
                              className="text-xs hidden sm:inline-flex"
                            >
                              {user.is_active ? 'Ativo' : 'Inativo'}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell py-2 sm:py-4 text-xs sm:text-sm">
                          {new Date(user.created_at).toLocaleDateString('pt-BR')}
                        </TableCell>
                        <TableCell className="py-2 sm:py-4">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={user.user_id === profile?.user_id}
                                className="text-destructive hover:text-destructive h-6 w-6 sm:h-8 sm:w-8 p-0"
                              >
                                <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle className="text-sm sm:text-base">
                                  Confirmar Exclusão
                                </AlertDialogTitle>
                                <AlertDialogDescription className="text-xs sm:text-sm">
                                  Tem certeza que deseja remover o usuário {user.email}? 
                                  Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="text-xs sm:text-sm">
                                  Cancelar
                                </AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteUser(user.user_id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs sm:text-sm"
                                >
                                  Remover
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {selectedTab === 'audit' && (
        <Card className="financial-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Log de Auditoria
            </CardTitle>
            <CardDescription>
              Histórico completo de atividades do sistema para monitoramento de segurança
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Recurso</TableHead>
                  <TableHead>Data/Hora</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{log.profiles?.full_name || 'Sistema'}</p>
                        <p className="text-sm text-muted-foreground">{log.profiles?.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {log.action.replace(/_/g, ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>{log.resource_type}</TableCell>
                    <TableCell>
                      {new Date(log.created_at).toLocaleString('pt-BR')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}