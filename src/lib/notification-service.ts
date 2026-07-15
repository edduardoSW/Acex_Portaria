import { supabase } from './supabase';
import { Package, Resident, Condominium } from '../types';

type WhatsAppMode = 'manual' | 'evolution';

export class NotificationService {
  private mode: WhatsAppMode;

  constructor() {
    this.mode = (import.meta.env.VITE_WHATSAPP_MODE as WhatsAppMode) || 'manual';
  }

  // Normaliza o número de telefone
  normalizePhone(phone: string): string {
    let normalized = phone.replace(/\D/g, '');
    if (!normalized.startsWith('55')) {
      normalized = '55' + normalized;
    }
    return normalized;
  }

  // Gera a mensagem para a encomenda
  generatePackageMessage(resident: Resident, condominium: Condominium, packageData: Package): string {
    const firstName = resident.name.split(' ')[0];
    const date = new Date(packageData.created_at);
    const formattedDate = date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const formattedTime = date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });

    return `Olá, ${firstName}!

Uma encomenda destinada à sua unidade chegou à portaria.

Condomínio: ${condominium.name}
Unidade: Bloco ${resident.block} - Apto ${resident.apartment}
Recebida em: ${formattedDate} às ${formattedTime}

Por favor, realize a retirada quando possível.

Acex Portaria`;
  }

  // Abre o WhatsApp Web manualmente
  openWhatsAppWeb(phone: string, message: string): boolean {
    try {
      const normalizedPhone = this.normalizePhone(phone);
      const encodedMessage = encodeURIComponent(message);
      const url = `https://wa.me/${normalizedPhone}?text=${encodedMessage}`;
      const newWindow = window.open(url, '_blank', 'noopener,noreferrer');
      return !!newWindow;
    } catch (e) {
      console.error('Failed to open WhatsApp window', e);
      return false;
    }
  }

  // Envia notificação via Evolution API (Edge Function)
  async sendViaEvolution(packageId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-package-notification`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({ packageId }),
        }
      );

      if (!response.ok) {
        throw new Error('Falha ao enviar notificação');
      }

      const result = await response.json();
      return { success: result.sent };
    } catch (error) {
      console.error('Erro ao enviar notificação via Evolution:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      };
    }
  }

  // Atualiza o status da notificação no banco
  async updateNotificationStatus(packageId: string, status: 'pending' | 'opened' | 'sent' | 'failed'): Promise<void> {
    const { error } = await supabase
      .from('packages')
      .update({ notification_status: status })
      .eq('id', packageId);

    if (error) {
      console.error('Erro ao atualizar status da notificação:', error);
    }
  }

  // Cria log de atividade
  async logActivity(action: string, profileId: string, condominiumId: string, packageId?: string): Promise<void> {
    const { error } = await supabase
      .from('activity_logs')
      .insert({
        action,
        profile_id: profileId,
        condominium_id: condominiumId,
        package_id: packageId,
      });

    if (error) {
      console.error('Erro ao criar log de atividade:', error);
    }
  }

  // Método principal para enviar notificação de encomenda
  async sendPackageNotification(
    packageData: Package,
    resident: Resident,
    condominium: Condominium,
    profileId: string
  ): Promise<boolean> {
    if (this.mode === 'manual') {
      // Abre o WhatsApp Web manualmente
      const message = this.generatePackageMessage(resident, condominium, packageData);
      const opened = this.openWhatsAppWeb(resident.whatsapp, message);
      if (opened) {
        await this.updateNotificationStatus(packageData.id, 'opened');
        await this.logActivity('whatsapp_opened', profileId, condominium.id, packageData.id);
      }
      return opened;
    } else if (this.mode === 'evolution') {
      // Envia via Evolution API (através da Edge Function)
      const result = await this.sendViaEvolution(packageData.id);
      return result.success;
    }
    return false;
  }
}
