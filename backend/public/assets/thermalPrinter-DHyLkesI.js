async function x(c,e){const d=((c==null?void 0:c.paperWidth)||"80mm")==="58mm"?32:48,$="-".repeat(d),r=(t,s)=>{const A=d-s.length;return t.length>A?t.substring(0,A-1)+" "+s:t+" ".repeat(A-t.length)+s};if((c==null?void 0:c.connectionType)==="thermal_usb"&&"usb"in navigator)try{const t=await navigator.usb.getDevices();let s=t.find(A=>c.usbVendorId&&A.vendorId===c.usbVendorId);if(!s&&t.length>0&&(s=t[0]),s){await s.open(),s.configuration===null&&await s.selectConfiguration(1),await s.claimInterface(0);const A=new TextEncoder,T=new Uint8Array([27,64]),p=new Uint8Array([27,97,1]),O=new Uint8Array([29,86,0]),a=new Uint8Array([27,112,0,25,250]);let n="";n+=`${e.businessName||"ABASTOS SOFIMAR"}
`,e.taxId&&(n+=`RIF: ${e.taxId}
`),e.fiscalAddress&&(n+=`${e.fiscalAddress}
`),e.fiscalPhone&&(n+=`TEL: ${e.fiscalPhone}
`),n+=`${$}
`,n+=r(`FACTURA #: ${e.invoiceNumber||"FACT-000482"}`,e.date||new Date().toLocaleDateString("es-VE"))+`
`,e.cashierName&&(n+=`CAJERO: ${e.cashierName}
`),e.customerName&&(n+=r(`CLIENTE: ${e.customerName}`,e.customerTaxId||"")+`
`),n+=`${$}
`,n+=r("CANT / DESCRIPCION","TOTAL USD")+`
`,n+=`${$}
`,e.items.forEach(i=>{const f=i.unitPrice||(i.qty?i.total/i.qty:i.total);n+=r(`${i.qty}x ${i.name}`,`$${i.total.toFixed(2)}`)+`
`,n+=`   ${i.qty} x $${f.toFixed(2)} USD
`}),n+=`${$}
`;const u=e.totalUSD/1.16,y=e.totalUSD-u;n+=r("BASE IMPONIBLE (G 16%):",`$${u.toFixed(2)}`)+`
`,n+=r("IVA (16.00%):",`$${y.toFixed(2)}`)+`
`,n+=`${$}
`,n+=r("TOTAL USD:",`$${e.totalUSD.toFixed(2)}`)+`
`,e.totalVES&&(n+=r("TOTAL VES:",`Bs. ${e.totalVES.toFixed(2)}`)+`
`),e.totalCOP&&(n+=r("TOTAL COP:",`$${e.totalCOP.toLocaleString("es-CO")}`)+`
`),e.paymentMethods&&e.paymentMethods.length>0&&(n+=`${$}
`,n+=`FORMAS DE PAGO:
`,e.paymentMethods.forEach(i=>{const f=i.currency==="VES"?`Bs. ${i.amount.toFixed(2)}`:`$${i.amount.toFixed(2)}`;n+=r(`- ${i.type.toUpperCase()} (${i.currency}):`,f)+`
`}),e.changeUSD&&e.changeUSD>0&&(n+=r("- CAMBIO USD:",`$${e.changeUSD.toFixed(2)}`)+`
`)),n+=`${$}
`,n+=`${e.footerMessage||"¡Gracias por su compra! Vuelva pronto"}


`;const h=A.encode(n),m=[T,p,h,O];c.openCashDrawer&&m.push(a);let C=m.reduce((i,f)=>i+f.length,0);const I=new Uint8Array(C);let E=0;for(const i of m)I.set(i,E),E+=i.length;const o=s.configuration.interfaces[0].alternate.endpoints.find(i=>i.direction==="out");if(o)return await s.transferOut(o.endpointNumber,I),{success:!0,method:"webusb",message:`Factura enviada directamente a ${s.productName||c.name} por USB.`}}}catch(t){console.warn("Dispositivo WebUSB no respondió:",t==null?void 0:t.message)}return(c==null?void 0:c.connectionType)==="browser"?(window.print(),{success:!0,method:"browser",message:`Imprimiendo en navegador para ${c.name}`}):{success:!0,method:"none",message:"Venta completada sin impresora configurada."}}async function U(c,e){var T,p,O;const S=e.type==="Z",$=((c==null?void 0:c.paperWidth)||"80mm")==="58mm"?32:48,r="-".repeat($),t=(a,n)=>{const u=$-n.length;return a.length>u?a.substring(0,u-1)+" "+n:a+" ".repeat(u-a.length)+n},s=a=>a.toLocaleString("es-VE",{minimumFractionDigits:2,maximumFractionDigits:2}),A=a=>a?new Date(a).toLocaleString("es-VE"):"-";if((c==null?void 0:c.connectionType)==="thermal_usb"&&"usb"in navigator)try{const a=await navigator.usb.getDevices();let n=a.find(u=>c.usbVendorId&&u.vendorId===c.usbVendorId);if(!n&&a.length>0&&(n=a[0]),n){await n.open(),n.configuration===null&&await n.selectConfiguration(1),await n.claimInterface(0);const u=new TextEncoder,y=new Uint8Array([27,64]),h=new Uint8Array([27,97,1]),m=new Uint8Array([27,97,0]),C=new Uint8Array([29,86,0]),I=new Uint8Array([27,112,0,25,250]);let E="";E+=`${e.businessName||"ABASTOS SOFIMAR"}
`,e.taxId&&(E+=`RIF: ${e.taxId}
`),E+=`${(T=e.branch)!=null&&T.name?`SEDE: ${e.branch.name}`:"SEDE PRINCIPAL"}
`,E+=`${r}
`,E+=S?`--- REPORTE Z (CIERRE) ---
`:`--- REPORTE X (PARCIAL) ---
`,E+=`${r}
`;let o="";o+=t("CAJA ID:",e.registerId.slice(-8).toUpperCase())+`
`,o+=t("CAJERO:",((p=e.user)==null?void 0:p.nombre)||((O=e.user)==null?void 0:O.username)||"SISTEMA")+`
`,o+=t("APERTURA:",A(e.openedAt))+`
`,S&&(o+=t("CIERRE:",A(e.closedAt||new Date))+`
`),o+=`${r}
`,o+=`DESGLOSE DE VENTAS:
`,o+=t("Nº TRANSACCIONES:",String(e.transactionCount))+`
`,o+=t("TOTAL VENTAS:",`$ ${s(e.salesTotal)}`)+`
`,o+=`${r}
`,o+=`FORMAS DE PAGO:
`,o+=t("- EFECTIVO COP:",`$ ${s(e.paymentBreakdown.efectivoCOP)}`)+`
`,o+=t("- EFECTIVO USD:",`$ ${s(e.paymentBreakdown.efectivoUSD)}`)+`
`,o+=t("- EFECTIVO VES:",`Bs. ${s(e.paymentBreakdown.efectivoVES)}`)+`
`,o+=t("- TRANSFERENCIA:",`$ ${s(e.paymentBreakdown.transferencia)}`)+`
`,o+=t("- TARJETA:",`$ ${s(e.paymentBreakdown.tarjeta)}`)+`
`,e.paymentBreakdown.otros>0&&(o+=t("- OTROS:",`$ ${s(e.paymentBreakdown.otros)}`)+`
`),o+=`${r}
`,o+=`RESUMEN FISCAL SENIAT:
`,o+=t("BASE IMPONIBLE (16%):",`$ ${s(e.seniatTax.baseImponible)}`)+`
`,o+=t("IVA (16%):",`$ ${s(e.seniatTax.iva16)}`)+`
`,o+=t("EXENTO (0%):",`$ ${s(e.seniatTax.exento)}`)+`
`,o+=t("TOTAL AUDITADO:",`$ ${s(e.seniatTax.totalVentas)}`)+`
`,o+=`${r}
`,o+=`SALDOS EN CAJA (ESPERADOS):
`,o+=t("MONTO APERTURA:",`$ ${s(e.openingAmount)}`)+`
`,o+=t("TOTAL ESPERADO:",`$ ${s(e.expectedBalances.totalExpectedCOP)}`)+`
`,S&&(o+=`${r}
`,o+=`RESULTADO AUDITORIA CIERRE:
`,e.physicalCounts&&(o+=t("FÍSICO COP:",`$ ${s(e.physicalCounts.countedCOP||0)}`)+`
`,o+=t("FÍSICO USD:",`$ ${s(e.physicalCounts.countedUSD||0)}`)+`
`,o+=t("FÍSICO VES:",`Bs. ${s(e.physicalCounts.countedVES||0)}`)+`
`),o+=t("TOTAL DECLARADO:",`$ ${s(e.closingAmount||0)}`)+`
`,o+=t("RESULTADO:",e.varianceType||"EXACTO")+`
`,e.difference!==void 0&&e.difference!==0&&(o+=t(`DIFERENCIA (${e.varianceType}):`,`$ ${s(Math.abs(e.difference))}`)+`
`),e.notes&&(o+=`OBS: ${e.notes}
`)),o+=`${r}
`,o+=`IMPRESO DESDE SISTEMA ERP MARKET


`;const i=u.encode(E),f=u.encode(o),D=[y,h,i,m,f,C];(S||c.openCashDrawer)&&D.push(I);let b=D.reduce((l,v)=>l+v.length,0);const R=new Uint8Array(b);let w=0;for(const l of D)R.set(l,w),w+=l.length;const g=n.configuration.interfaces[0].alternate.endpoints.find(l=>l.direction==="out");if(g)return await n.transferOut(g.endpointNumber,R),{success:!0,method:"webusb",message:`Reporte ${e.type} enviado a impresora térmica USB.`}}}catch(a){console.warn("Dispositivo WebUSB no respondió:",a==null?void 0:a.message)}return(c==null?void 0:c.connectionType)==="browser"||!c?(window.print(),{success:!0,method:"browser",message:`Imprimiendo Reporte ${e.type} mediante diálogo de navegador.`}):{success:!0,method:"none",message:`Reporte ${e.type} procesado.`}}async function N(c,e){return U(c,{...e,type:"X"})}async function F(c,e){return U(c,{...e,type:"Z"})}export{N as a,F as b,x as p};
