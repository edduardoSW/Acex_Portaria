import { supabase } from './supabase';

type PickupResponse = {
  success: boolean;
  packageId?: string;
  emailSent?: boolean;
  reason?: string;
  remainingAttempts?: number;
  retryAfterSeconds?: number;
  message: string;
};

type SendPackageCodeResponse = {
  success: boolean;
  deliveryStatus: 'sent' | 'failed';
  maskedEmail: string;
};

async function invoke(body: Record<string, unknown>): Promise<PickupResponse> {
  const { data, error } = await supabase.functions.invoke('package-pickup', { body });
  if (error) throw new Error('Não foi possível comunicar com o serviço de retirada');
  if (data?.error) throw new Error(data.error);
  return data as PickupResponse;
}

async function sendPackageCode(packageId: string): Promise<PickupResponse> {
  const { data, error } = await supabase.functions.invoke('send-package-code', {
    body: { packageId },
  });
  if (error || data?.error) {
    throw new Error(data?.error ?? 'Não foi possível enviar o código de retirada');
  }

  const response = data as SendPackageCodeResponse;
  const emailSent = response.deliveryStatus === 'sent';
  return {
    success: response.success,
    emailSent,
    message: emailSent
      ? `Código enviado para ${response.maskedEmail}`
      : `Não foi possível enviar para ${response.maskedEmail}`,
  };
}

export const pickupCodeService = {
  async create(residentId: string) {
    const created = await invoke({ action: 'create', residentId });
    if (!created.packageId) {
      throw new Error('A encomenda foi criada sem um identificador válido');
    }

    try {
      const delivery = await sendPackageCode(created.packageId);
      return { ...delivery, packageId: created.packageId };
    } catch {
      // A encomenda permanece pendente e o porteiro pode reenviar pela tela de pendentes.
      return {
        success: true,
        packageId: created.packageId,
        emailSent: false,
        message: 'Encomenda registrada, mas não foi possível enviar o código',
      };
    }
  },
  resend(packageId: string) {
    return sendPackageCode(packageId);
  },
  regenerate(packageId: string) {
    return sendPackageCode(packageId);
  },
  confirm(packageId: string, code: string) {
    return invoke({ action: 'confirm', packageId, code });
  },
};
