import html
import json
import os
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler
from typing import Optional, Tuple


def calculate_plan(units: int) -> Tuple[str, Optional[int]]:
    if units <= 150:
        return "Essencial", 199
    if units <= 350:
        return "Profissional", 349
    if units <= 600:
        return "Enterprise", 599
    return "Personalizado", None


class handler(BaseHTTPRequestHandler):
    def _send_json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", os.getenv("ALLOWED_ORIGIN", "*"))
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self) -> None:
        self._send_json(200, {"ok": True})

    def do_POST(self) -> None:
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            if content_length <= 0 or content_length > 20_000:
                self._send_json(400, {"error": "Solicitação inválida."})
                return

            payload = json.loads(self.rfile.read(content_length).decode("utf-8"))

            # Honeypot: bots recebem uma resposta neutra, sem disparo de e-mail.
            if payload.get("website"):
                self._send_json(200, {"success": True})
                return

            name = str(payload.get("name", "")).strip()[:100]
            condominium = str(payload.get("condominium", "")).strip()[:120]
            email = str(payload.get("email", "")).strip().lower()[:160]
            phone = str(payload.get("phone", "")).strip()[:24]
            message = str(payload.get("message", "")).strip()[:1000]
            units = int(payload.get("units", 0))

            if not name or not condominium or not phone or not (1 <= units <= 5000):
                self._send_json(400, {"error": "Preencha os dados obrigatórios corretamente."})
                return
            if "@" not in email or "." not in email.rsplit("@", 1)[-1]:
                self._send_json(400, {"error": "Informe um e-mail válido."})
                return

            api_key = os.getenv("RESEND_API_KEY")
            email_from = os.getenv("EMAIL_FROM")
            sales_email = os.getenv("SALES_EMAIL")
            if not api_key or not email_from or not sales_email:
                self._send_json(503, {"error": "Canal de vendas ainda não configurado."})
                return

            plan_name, plan_price = calculate_plan(units)
            price_text = f"R$ {plan_price}/mês" if plan_price else "Proposta personalizada"
            safe_message = html.escape(message).replace("\n", "<br>")
            message_block = (
                f'<div style="margin-top:22px;padding:18px;background:#f4efe8;border-radius:12px">'
                f'<strong>Mensagem</strong><p style="line-height:1.6;margin-bottom:0">{safe_message}</p></div>'
                if safe_message else ""
            )
            email_html = f"""
            <div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#241e1a">
              <div style="background:#1c1815;padding:24px;border-radius:16px 16px 0 0">
                <strong style="color:#fff;font-size:22px;letter-spacing:2px">ACEX PORTARIA</strong>
                <p style="color:#e87532;margin:8px 0 0">by ACEX Partners · nova solicitação comercial</p>
              </div>
              <div style="border:1px solid #dfe7e7;border-top:0;padding:28px;border-radius:0 0 16px 16px">
                <h1 style="font-size:24px;margin:0 0 22px">{html.escape(condominium)}</h1>
                <p><strong>Responsável:</strong> {html.escape(name)}</p>
                <p><strong>E-mail:</strong> {html.escape(email)}</p>
                <p><strong>Telefone:</strong> {html.escape(phone)}</p>
                <p><strong>Unidades:</strong> {units}</p>
                <p><strong>Plano calculado:</strong> {plan_name} · {price_text}</p>
                {message_block}
              </div>
            </div>
            """

            request_data = json.dumps({
                "from": email_from,
                "to": [sales_email],
                "reply_to": email,
                "subject": f"Novo lead ACEX · {condominium} · {units} unidades",
                "html": email_html,
            }).encode("utf-8")
            request = urllib.request.Request(
                "https://api.resend.com/emails",
                data=request_data,
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(request, timeout=12) as response:
                if response.status >= 300:
                    raise RuntimeError("Falha no provedor de e-mail")

            self._send_json(200, {"success": True, "plan": plan_name, "price": plan_price})
        except (ValueError, TypeError, json.JSONDecodeError):
            self._send_json(400, {"error": "Dados inválidos."})
        except urllib.error.HTTPError as error:
            print(f"Resend HTTP error: {error.code} {error.read().decode('utf-8', errors='replace')}")
            self._send_json(502, {"error": "Não foi possível enviar a proposta agora."})
        except Exception as error:
            print(f"send_sales_lead error: {error}")
            self._send_json(500, {"error": "Não foi possível processar a solicitação."})
