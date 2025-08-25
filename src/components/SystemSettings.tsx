import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Settings, Save, Shield } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface SystemSetting {
  id: string;
  setting_key: string;
  setting_value: string;
  description: string;
}

export default function SystemSettings() {
  const [trialDays, setTrialDays] = useState<string>('7');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .eq('setting_key', 'trial_period_days')
        .single();

      if (error) {
        console.error('Error fetching settings:', error);
        toast({
          title: "Erro ao carregar configurações",
          description: "Não foi possível carregar as configurações do sistema.",
          variant: "destructive",
        });
        return;
      }

      if (data) {
        setTrialDays(data.setting_value);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast({
        title: "Erro ao carregar configurações",
        description: "Erro inesperado ao carregar configurações.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async () => {
    if (!trialDays || parseInt(trialDays) < 1) {
      toast({
        title: "Valor inválido",
        description: "O período de trial deve ser de pelo menos 1 dia.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('system_settings')
        .update({ 
          setting_value: trialDays,
          updated_at: new Date().toISOString()
        })
        .eq('setting_key', 'trial_period_days');

      if (error) {
        console.error('Error updating setting:', error);
        toast({
          title: "Erro ao salvar",
          description: "Não foi possível salvar a configuração.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Configuração salva",
        description: `Novos usuários terão ${trialDays} dias de trial.`,
      });
    } catch (error) {
      console.error('Error updating setting:', error);
      toast({
        title: "Erro ao salvar",
        description: "Erro inesperado ao salvar configuração.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Settings className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Configurações do Sistema</h1>
      </div>

      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          Área restrita para administradores. As configurações afetam todos os usuários do sistema.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Período de Trial
          </CardTitle>
          <CardDescription>
            Configure quantos dias os novos usuários podem usar o sistema gratuitamente
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="trial-days">Dias de Trial</Label>
            <Input
              id="trial-days"
              type="number"
              min="1"
              max="365"
              value={trialDays}
              onChange={(e) => setTrialDays(e.target.value)}
              placeholder="7"
            />
            <p className="text-sm text-muted-foreground">
              Número de dias que novos usuários podem usar o sistema após o cadastro
            </p>
          </div>

          <Button 
            onClick={updateSetting} 
            disabled={saving}
            className="w-full"
          >
            {saving ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {saving ? 'Salvando...' : 'Salvar Configuração'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}