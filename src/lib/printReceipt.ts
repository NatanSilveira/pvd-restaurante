export const printReceipt = (receiptData: any) => {
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  document.body.appendChild(iframe);

  const itemsHtml = receiptData.items.map((item: any) => `
    <div class="item">
      <span class="qty">${item.quantity}x</span>
      <span class="name">${item.name}</span>
      <span class="price">R$ ${(item.price * item.quantity).toFixed(2)}</span>
    </div>
    ${item.notes ? `<div class="notes">* Obs: ${item.notes}</div>` : ''}
  `).join('');

  const dateStr = new Date().toLocaleString('pt-BR');
  const customerName = receiptData.customer || receiptData.customer_name;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>Cupom</title>
        <style>
          @page { margin: 0; size: 80mm auto; }
          body {
            font-family: 'Courier New', Courier, monospace;
            width: 72mm; /* Deixando uma margem de segurança para 80mm */
            margin: 0 auto;
            padding: 4mm 0;
            color: #000;
            background: #fff;
            font-size: 12px;
            font-weight: bold;
          }
          .text-center { text-align: center; }
          .font-bold { font-weight: bold; }
          .text-lg { font-size: 16px; margin-bottom: 4px; }
          .divider { border-top: 1px dashed #000; margin: 6px 0; }
          .item { display: flex; justify-content: space-between; margin-top: 4px; }
          .qty { width: 25px; font-weight: bold; }
          .name { flex: 1; text-align: left; padding-left: 2px; }
          .price { width: 60px; text-align: right; font-weight: bold; }
          .notes { font-size: 11px; padding-left: 27px; font-style: italic; }
          .total { display: flex; justify-content: space-between; font-weight: bold; font-size: 15px; margin-top: 8px; }
          .footer { text-align: center; font-size: 10px; margin-top: 15px; }
        </style>
      </head>
      <body>
        <div class="text-center font-bold text-lg">HAMBURGUERIA</div>
        <div class="text-center">Pedido #${receiptData.id}</div>
        <div class="text-center">Tipo: ${receiptData.type || 'Local'}</div>
        <div class="text-center">Cliente: ${customerName}</div>
        <div class="text-center">${dateStr}</div>
        
        <div class="divider"></div>
        
        ${itemsHtml}
        
        <div class="divider"></div>
        
        ${receiptData.tip ? `
        <div class="item" style="margin-bottom: 4px;">
          <span class="name" style="padding-left: 0;">Subtotal:</span>
          <span class="price">R$ ${(receiptData.total - receiptData.tip).toFixed(2)}</span>
        </div>
        <div class="item" style="margin-bottom: 4px;">
          <span class="name" style="padding-left: 0;">Gorjeta (10%):</span>
          <span class="price">R$ ${receiptData.tip.toFixed(2)}</span>
        </div>
        ` : ''}

        <div class="total">
          <span>TOTAL:</span>
          <span>R$ ${receiptData.total.toFixed(2)}</span>
        </div>
        
        <div class="divider"></div>
        <div class="footer">*** FIM DA IMPRESSAO ***</div>
      </body>
    </html>
  `;

  if (iframe.contentDocument) {
    iframe.contentDocument.open();
    iframe.contentDocument.write(html);
    iframe.contentDocument.close();
  }

  setTimeout(() => {
    if (iframe.contentWindow) {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    }
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 2000);
  }, 500);
};
