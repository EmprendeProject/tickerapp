/**
 * Formatea un monto con su respectiva moneda.
 */
export function formatCurrency(amount, currency = 'USD') {
  if (amount === undefined || amount === null) return ''
  return new Intl.NumberFormat('es-VE', {
    style: 'currency',
    currency: currency,
  }).format(amount)
}

/**
 * Genera el cuerpo HTML para el correo enviado al comprador cuando su pago es aprobado.
 * Incluye los detalles del evento, ticket, y la imagen del código QR.
 */
export function buildTicketApprovalEmail({ event, order }) {
  const eventDate = new Date(event.date)
  const formattedDate = eventDate.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })

  // Generamos el URL del QR usando el servicio gratuito qrserver.com
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&margin=10&data=${encodeURIComponent(order.qr_code)}`

  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Tu Entrada - ${event.name}</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          background-color: #09090b;
          color: #fafafa;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 600px;
          margin: 40px auto;
          background-color: #18181b;
          border-radius: 12px;
          border: 1px solid #27272a;
          overflow: hidden;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        }
        .header {
          background-color: #09090b;
          padding: 30px;
          text-align: center;
          border-bottom: 1px solid #27272a;
        }
        .logo {
          font-size: 24px;
          font-weight: bold;
          color: #fafafa;
          letter-spacing: -0.05em;
        }
        .content {
          padding: 30px;
        }
        .title {
          font-size: 22px;
          font-weight: bold;
          margin-top: 0;
          margin-bottom: 10px;
          color: #ffffff;
          text-align: center;
        }
        .subtitle {
          font-size: 14px;
          color: #a1a1aa;
          text-align: center;
          margin-bottom: 30px;
        }
        .ticket-card {
          background-color: #09090b;
          border: 1px dashed #3f3f46;
          border-radius: 8px;
          padding: 24px;
          margin-bottom: 24px;
        }
        .detail-row {
          margin-bottom: 16px;
        }
        .detail-row:last-child {
          margin-bottom: 0;
        }
        .label {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: #71717a;
          margin-bottom: 4px;
        }
        .value {
          font-size: 15px;
          font-weight: 600;
          color: #fafafa;
        }
        .qr-section {
          text-align: center;
          margin-top: 24px;
          padding-top: 24px;
          border-top: 1px solid #27272a;
        }
        .qr-image {
          background-color: #ffffff;
          padding: 12px;
          border-radius: 8px;
          display: inline-block;
        }
        .qr-code-text {
          font-family: monospace;
          font-size: 12px;
          color: #71717a;
          margin-top: 8px;
        }
        .footer {
          padding: 20px;
          text-align: center;
          font-size: 12px;
          color: #71717a;
          background-color: #09090b;
          border-top: 1px solid #27272a;
        }
        .badge {
          background-color: #22c55e;
          color: #ffffff;
          font-size: 11px;
          font-weight: bold;
          padding: 4px 8px;
          border-radius: 9999px;
          display: inline-block;
          margin-top: 8px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">🎫 TicketShow</div>
        </div>
        <div class="content">
          <h1 class="title">¡Tu entrada está lista!</h1>
          <p class="subtitle">Tu pago ha sido aprobado correctamente. Presenta este código QR en la entrada del evento.</p>
          
          <div class="ticket-card">
            <div class="detail-row">
              <div class="label">Evento</div>
              <div class="value">${event.name}</div>
            </div>
            
            <div class="detail-row">
              <div class="label">Fecha y Hora</div>
              <div class="value">${formattedDate}</div>
            </div>
            
            ${event.location ? `
            <div class="detail-row">
              <div class="label">Lugar</div>
              <div class="value">${event.location}</div>
            </div>
            ` : ''}
            
            <div class="detail-row">
              <div class="label">Tipo de Entrada</div>
              <div class="value">${order.ticket_types?.name || 'Entrada General'}</div>
            </div>

            <div class="detail-row">
              <div class="label">Comprador</div>
              <div class="value">${order.buyer_name}</div>
            </div>
            
            <div class="detail-row">
              <div class="label">Total Pagado</div>
              <div class="value">${formatCurrency(order.total_amount, order.ticket_types?.currency)}</div>
            </div>

            <div class="qr-section">
              <div class="qr-image">
                <img src="${qrUrl}" width="200" height="200" alt="Código QR del Ticket" style="display: block;">
              </div>
              <div class="qr-code-text">${order.qr_code}</div>
              <div class="badge">ENTRADA APROBADA</div>
            </div>
          </div>
        </div>
        <div class="footer">
          Este correo fue enviado automáticamente por TicketShow.<br>
          Por favor, no respondas a este correo.
        </div>
      </div>
    </body>
    </html>
  `
}

/**
 * Genera el cuerpo HTML para notificar al organizador de una nueva compra registrada (pendiente).
 */
export function buildOrganizerNotificationEmail({ event, buyerName, totalTickets, totalAmount, currency }) {
  const detailUrl = `${window.location.origin}/dashboard` // Enlace de regreso al dashboard del organizador

  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Nueva Compra Registrada - ${event.name}</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          background-color: #09090b;
          color: #fafafa;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 600px;
          margin: 40px auto;
          background-color: #18181b;
          border-radius: 12px;
          border: 1px solid #27272a;
          overflow: hidden;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        }
        .header {
          background-color: #09090b;
          padding: 30px;
          text-align: center;
          border-bottom: 1px solid #27272a;
        }
        .logo {
          font-size: 24px;
          font-weight: bold;
          color: #fafafa;
          letter-spacing: -0.05em;
        }
        .content {
          padding: 30px;
        }
        .title {
          font-size: 22px;
          font-weight: bold;
          margin-top: 0;
          margin-bottom: 10px;
          color: #ffffff;
        }
        .subtitle {
          font-size: 14px;
          color: #a1a1aa;
          margin-bottom: 30px;
        }
        .detail-box {
          background-color: #09090b;
          border: 1px solid #27272a;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 24px;
        }
        .detail-row {
          display: flex;
          justify-content: space-between;
          padding: 10px 0;
          border-bottom: 1px solid #27272a;
        }
        .detail-row:last-child {
          border-bottom: none;
        }
        .label {
          font-size: 13px;
          color: #a1a1aa;
        }
        .value {
          font-size: 13px;
          font-weight: 600;
          color: #fafafa;
        }
        .btn-container {
          text-align: center;
          margin-top: 24px;
        }
        .btn {
          background-color: #ffffff;
          color: #09090b;
          font-weight: 600;
          text-decoration: none;
          padding: 12px 24px;
          border-radius: 6px;
          display: inline-block;
          font-size: 14px;
        }
        .footer {
          padding: 20px;
          text-align: center;
          font-size: 12px;
          color: #71717a;
          background-color: #09090b;
          border-top: 1px solid #27272a;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">🎫 TicketShow</div>
        </div>
        <div class="content">
          <h1 class="title">🎫 ¡Nueva orden de compra!</h1>
          <p class="subtitle">Un usuario ha reportado una transferencia y subido un comprobante para tu evento. Por favor revisa y aprueba el pago para liberar sus tickets.</p>
          
          <div class="detail-box">
            <div class="detail-row">
              <span class="label">Evento:</span>
              <span class="value">${event.name}</span>
            </div>
            <div class="detail-row">
              <span class="label">Comprador:</span>
              <span class="value">${buyerName}</span>
            </div>
            <div class="detail-row">
              <span class="label">Cantidad de Entradas:</span>
              <span class="value">${totalTickets}</span>
            </div>
            <div class="detail-row">
              <span class="label">Monto Reportado:</span>
              <span class="value" style="color: #22c55e;">${formatCurrency(totalAmount, currency)}</span>
            </div>
          </div>

          <div class="btn-container">
            <a href="${detailUrl}" class="btn">Verificar Comprobante →</a>
          </div>
        </div>
        <div class="footer">
          Este correo fue enviado automáticamente por TicketShow para notificar a los organizadores.
        </div>
      </div>
    </body>
    </html>
  `
}
