export class WhatsAppService {
  private apiUrl: string;
  private apiKey: string;
  private instance: string;

  constructor() {
    this.apiUrl = import.meta.env.VITE_EVOLUTION_API_URL || '';
    this.apiKey = import.meta.env.VITE_EVOLUTION_API_KEY || '';
    this.instance = import.meta.env.VITE_EVOLUTION_INSTANCE || '';
  }

  async sendTextMessage(phone: string, text: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.apiUrl || !this.apiKey || !this.instance) {
        throw new Error('Configurações da Evolution API não definidas');
      }

      const response = await fetch(`${this.apiUrl}/message/sendText/${this.instance}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': this.apiKey,
        },
        body: JSON.stringify({
          number: phone,
          text,
        }),
      });

      if (!response.ok) {
        throw new Error(`Falha ao enviar mensagem: ${response.statusText}`);
      }

      return { success: true };
    } catch (error) {
      console.error('Erro no WhatsAppService:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      };
    }
  }

  generatePackageMessage(residentName: string): string {
    return `Olá, ${residentName}!

Informamos que sua encomenda chegou à portaria do condomínio.
Quando possível, realize a retirada.

Obrigado.`;
  }
}
